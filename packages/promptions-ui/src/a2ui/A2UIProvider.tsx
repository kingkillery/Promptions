import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo, ReactNode } from "react";
import { A2UIStreamMessage, A2UIAction, A2UIComponent, A2UIConfig, DefaultA2UIConfig } from "./protocol";
import { A2UIStreamParser } from "./streamParser";
import { useTambo } from "../registry/TamboProvider";

interface A2UIContextValue {
  isConnected: boolean;
  isStreaming: boolean;
  rootComponents: A2UIComponent[];
  connect: (message?: string) => void;
  disconnect: () => void;
  sendAction: (action: A2UIAction, options?: { stream?: boolean }) => void;
  reset: () => void;
  version: number;
}

const A2UIContext = createContext<A2UIContextValue | null>(null);

interface A2UIProviderProps {
  children: ReactNode;
  config?: Partial<A2UIConfig>;
  endpoint?: string;
  requestBody?: Record<string, unknown> | (() => Record<string, unknown>);
  onError?: (error: Error) => void;
  onWarning?: (warning: string) => void;
}

export function A2UIProvider({ children, config, endpoint = "/api/a2ui", requestBody, onError, onWarning }: A2UIProviderProps) {
  const { registeredComponents } = useTambo();
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [rootComponents, setRootComponents] = useState<A2UIComponent[]>([]);
  const [version, setVersion] = useState(0);

  const parserRef = useRef<A2UIStreamParser | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const connectIdRef = useRef(0);

  const mergedConfig = useMemo(() => ({ ...DefaultA2UIConfig, ...config }), [config]);

  const initializeParser = useCallback(() => {
    if (!parserRef.current) {
      parserRef.current = new A2UIStreamParser({
        config: mergedConfig,
        onError: (err) => onError?.(err),
        onWarning: (warn) => onWarning?.(warn),
      });
    }
    return parserRef.current;
  }, [mergedConfig, onError, onWarning]);

  const processMessages = useCallback((_messages: A2UIStreamMessage[]) => {
    const roots = parserRef.current?.getRootComponents() || [];
    setRootComponents(roots);
    setVersion(parserRef.current?.getVersion() || 0);
  }, []);

  const disconnect = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setIsConnected(false);
  }, []);

  const connect = useCallback((message?: string) => {
    disconnect();
    const parser = initializeParser();
    parser.reset();
    setRootComponents([]);
    setVersion(0);

    const connectId = ++connectIdRef.current;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsStreaming(true);

    (async () => {
      try {
        const extraBody = typeof requestBody === "function" ? requestBody() : requestBody;

        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(extraBody || {}),
            message,
            components: Array.from(registeredComponents.entries()).map(([name, entry]) => ({
              name,
              description: entry.description,
              category: entry.category,
            })),
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        if (connectIdRef.current !== connectId) {
          return;
        }

        setIsConnected(true);

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          if (lines.length) {
            const messages = parser.processChunk(lines.join("\n") + "\n");
            processMessages(messages);
          }
        }
      } catch (error) {
        if (connectIdRef.current !== connectId) {
          return;
        }
        const err = error as { name?: string };
        if (err?.name !== "AbortError") {
          onError?.(error instanceof Error ? error : new Error(String(error)));
        }
        setIsConnected(false);
      } finally {
        if (connectIdRef.current === connectId) {
          setIsStreaming(false);
        }
      }
    })();
  }, [disconnect, endpoint, initializeParser, onError, processMessages, registeredComponents, requestBody]);

  const sendAction = useCallback((action: A2UIAction, options?: { stream?: boolean }) => {
    const extraBody = typeof requestBody === "function" ? requestBody() : requestBody;
    const shouldStream = options?.stream ?? true;

    if (!shouldStream) {
      // Fire-and-forget mode (original behavior)
      fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(extraBody || {}),
          action,
        }),
      }).catch(error => {
        onError?.(new Error(`Failed to send action: ${error}`));
      });
      return;
    }

    // Streaming mode - server responds with UI updates
    const parser = initializeParser();
    const actionAbort = new AbortController();

    (async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(extraBody || {}),
            action,
            components: Array.from(registeredComponents.entries()).map(([name, entry]) => ({
              name,
              description: entry.description,
              category: entry.category,
            })),
          }),
          signal: actionAbort.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Check if it's a streaming response
        const contentType = response.headers.get("Content-Type") || "";
        if (!contentType.includes("ndjson")) {
          // Non-streaming response (204 or similar)
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          if (lines.length) {
            const messages = parser.processChunk(lines.join("\n") + "\n");
            if (messages.length) {
              const roots = parser.getRootComponents();
              setRootComponents(roots);
              setVersion(parser.getVersion());
            }
          }
        }
      } catch (error) {
        const err = error as { name?: string };
        if (err?.name !== "AbortError") {
          onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      }
    })();
  }, [endpoint, initializeParser, onError, registeredComponents, requestBody]);

  const reset = useCallback(() => {
    parserRef.current?.reset();
    setRootComponents([]);
    setVersion(0);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const value = useMemo(() => ({
    isConnected,
    isStreaming,
    rootComponents,
    connect,
    disconnect,
    sendAction,
    reset,
    version,
  }), [isConnected, isStreaming, rootComponents, connect, disconnect, sendAction, reset, version]);

  return (
    <A2UIContext.Provider value={value}>
      {children}
    </A2UIContext.Provider>
  );
}

export function useA2UI(): A2UIContextValue {
  const context = useContext(A2UIContext);
  if (!context) {
    throw new Error("useA2UI must be used within an A2UIProvider");
  }
  return context;
}

// Hook for streaming props from A2UI to a specific component
export function useA2UIStream<T = Record<string, unknown>>(componentId: string) {
  const { rootComponents, sendAction, version } = useA2UI();

  const component = useMemo(() => {
    const findComponent = (components: A2UIComponent[]): A2UIComponent | null => {
      for (const c of components) {
        if (c.id === componentId) return c;
        if (c.children) {
          const found = findComponent(c.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findComponent(rootComponents);
  }, [rootComponents, componentId]);

  const props = component?.props as T | undefined;

  return { props, component, sendAction, version };
}
