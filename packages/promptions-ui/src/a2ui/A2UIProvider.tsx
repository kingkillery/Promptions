import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo, ReactNode } from "react";
import { A2UIStreamMessage, A2UIAction, A2UIComponent, A2UIConfig, DefaultA2UIConfig } from "./protocol";
import { A2UIStreamParser } from "./streamParser";
import { useTambo } from "../registry/TamboProvider";

interface A2UIContextValue {
  isConnected: boolean;
  isStreaming: boolean;
  rootComponents: A2UIComponent[];
  sendAction: (action: A2UIAction) => void;
  reset: () => void;
  version: number;
}

const A2UIContext = createContext<A2UIContextValue | null>(null);

interface A2UIProviderProps {
  children: ReactNode;
  config?: Partial<A2UIConfig>;
  endpoint?: string;
  onError?: (error: Error) => void;
  onWarning?: (warning: string) => void;
}

export function A2UIProvider({ children, config, endpoint = "/api/a2ui", onError, onWarning }: A2UIProviderProps) {
  const { registeredComponents } = useTambo();
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [rootComponents, setRootComponents] = useState<A2UIComponent[]>([]);
  const [version, setVersion] = useState(0);

  const parserRef = useRef<A2UIStreamParser | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const processMessages = useCallback((messages: A2UIStreamMessage[]) => {
    const roots = parserRef.current?.getRootComponents() || [];
    setRootComponents(roots);
    setVersion(parserRef.current?.getVersion() || 0);
  }, []);

  const connect = useCallback((initialMessage?: string) => {
    const parser = initializeParser();
    abortControllerRef.current = new AbortController();

    const url = new URL(endpoint, window.location.origin);
    if (initialMessage) {
      url.searchParams.set("message", initialMessage);
    }

    fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        components: Array.from(registeredComponents.entries()).map(([name, entry]) => ({
          name,
          description: entry.description,
          category: entry.category,
        })),
      }),
      signal: abortControllerRef.current.signal,
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setIsConnected(true);
        setIsStreaming(true);

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        function read() {
          reader!.read().then(({ done, value }) => {
            if (done) {
              setIsStreaming(false);
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            const messages = parser.processChunk(lines.join("\n") + "\n");
            processMessages(messages);

            if (isConnected) {
              read();
            }
          });
        }

        read();
      })
      .catch(error => {
        if (error.name !== "AbortError") {
          onError?.(error);
          setIsConnected(false);
          setIsStreaming(false);
        }
      });
  }, [endpoint, initializeParser, processMessages, onError, registeredComponents]);

  const sendAction = useCallback((action: A2UIAction) => {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(error => {
      onError?.(new Error(`Failed to send action: ${error}`));
    });
  }, [endpoint, onError]);

  const reset = useCallback(() => {
    parserRef.current?.reset();
    setRootComponents([]);
    setVersion(0);
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      eventSourceRef.current?.close();
    };
  }, []);

  const value = useMemo(() => ({
    isConnected,
    isStreaming,
    rootComponents,
    sendAction,
    reset,
    version,
  }), [isConnected, isStreaming, rootComponents, sendAction, reset, version]);

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
