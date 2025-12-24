import { useCallback, useRef, useState, useEffect, useReducer } from "react";

// Streaming state types
export interface StreamingState {
  status: "idle" | "preparing" | "streaming" | "complete" | "error" | "cancelled";
  progress: number;
  content: string;
  error: string | null;
  retryCount: number;
}

export type StreamingAction =
  | { type: "START" }
  | { type: "PREPARE" }
  | { type: "STREAM_START" }
  | { type: "CONTENT_UPDATE"; content: string; done: boolean }
  | { type: "PROGRESS"; value: number }
  | { type: "SUCCESS" }
  | { type: "ERROR"; error: string }
  | { type: "CANCEL" }
  | { type: "RETRY" }
  | { type: "RESET" };

// Reducer for streaming state - eliminates impossible states
function streamingReducer(state: StreamingState, action: StreamingAction): StreamingState {
  switch (action.type) {
    case "START":
      return {
        ...state,
        status: "preparing",
        progress: 0,
        error: null,
        retryCount: 0,
      };

    case "PREPARE":
      return {
        ...state,
        status: "preparing",
        progress: 10,
      };

    case "STREAM_START":
      return {
        ...state,
        status: "streaming",
        progress: 20,
      };

    case "CONTENT_UPDATE":
      return {
        ...state,
        content: action.done ? action.content : state.content + action.content,
        progress: action.done ? 95 : state.progress,
      };

    case "PROGRESS":
      return {
        ...state,
        progress: Math.min(action.value, 90),
      };

    case "SUCCESS":
      return {
        ...state,
        status: "complete",
        progress: 100,
      };

    case "ERROR":
      return {
        ...state,
        status: "error",
        error: action.error,
        progress: 0,
      };

    case "CANCEL":
      return {
        ...state,
        status: "cancelled",
        progress: 0,
      };

    case "RETRY":
      return {
        ...state,
        status: "preparing",
        progress: 0,
        retryCount: state.retryCount + 1,
        error: null,
      };

    case "RESET":
      return {
        status: "idle",
        progress: 0,
        content: "",
        error: null,
        retryCount: 0,
      };

    default:
      return state;
  }
}

// Initial state
const initialStreamingState: StreamingState = {
  status: "idle",
  progress: 0,
  content: "",
  error: null,
  retryCount: 0,
};

// Hook options
interface UseStreamingOptions {
  maxRetries?: number;
  onSuccess?: () => void;
  onError?: (error: string, retry: () => void) => void;
  onCancel?: () => void;
}

// Main streaming hook with race condition handling
export function useStreaming(options: UseStreamingOptions = {}) {
  const { maxRetries = 3, onSuccess, onError, onCancel } = options;
  const [state, dispatch] = useReducer(streamingReducer, initialStreamingState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string>("");

  // Check if can transition to a new state
  const canStart = state.status === "idle" || state.status === "complete" || state.status === "error" || state.status === "cancelled";
  const canRetry = state.status === "error" && state.retryCount < maxRetries;
  const canCancel = state.status === "preparing" || state.status === "streaming";

  // Start a new streaming request
  const start = useCallback(async (
    fetchFn: (signal: AbortSignal) => Promise<void>,
    onChunk?: (chunk: string, done: boolean) => void
  ) => {
    if (!canStart) {
      // Queue the request if busy
      console.warn("Streaming busy, request queued");
      return;
    }

    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("New request started");
    }

    abortControllerRef.current = new AbortController();

    dispatch({ type: "START" });

    try {
      dispatch({ type: "PREPARE" });

      await fetchFn(abortControllerRef.current.signal);

      dispatch({ type: "SUCCESS" });
      onSuccess?.();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        dispatch({ type: "CANCEL" });
        onCancel?.();
      } else {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        dispatch({ type: "ERROR", error: errorMessage });
        onError?.(errorMessage, () => retry(fetchFn, onChunk));
      }
    }
  }, [canStart, onSuccess, onError, onCancel]);

  // Retry with exponential backoff
  const retry = useCallback(async (
    fetchFn: (signal: AbortSignal) => Promise<void>,
    onChunk?: (chunk: string, done: boolean) => void
  ) => {
    if (!canRetry) return;

    const delay = Math.min(1000 * Math.pow(2, state.retryCount), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));

    dispatch({ type: "RETRY" });
    await start(fetchFn, onChunk);
  }, [canRetry, state.retryCount, start]);

  // Cancel current request
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("User cancelled");
    }
    dispatch({ type: "CANCEL" });
    onCancel?.();
  }, [onCancel]);

  // Reset state
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("Reset");
    }
    dispatch({ type: "RESET" });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort("Component unmounted");
      }
    };
  }, []);

  return {
    state,
    canStart,
    canRetry,
    canCancel,
    start,
    retry,
    cancel,
    reset,
  };
}

// Hook for handling race conditions in rapid succession
export function useRequestQueue<T>() {
  const [queue, setQueue] = useState<Array<{ id: string; data: T }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef<string>("");

  const enqueue = useCallback((data: T) => {
    const id = crypto.randomUUID();
    setQueue(prev => [...prev, { id, data }]);
    return id;
  }, []);

  const dequeue = useCallback(async (
    processor: (data: T, signal: AbortSignal) => Promise<void>,
    options?: { onComplete?: (id: string) => void; onError?: (id: string, error: Error) => void }
  ) => {
    if (isProcessing) return;

    setIsProcessing(true);

    while (queue.length > 0) {
      const { id, data } = queue[0];
      processingRef.current = id;

      const abortController = new AbortController();

      try {
        await processor(data, abortController.signal);
        setQueue(prev => prev.slice(1));
        options?.onComplete?.(id);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          // Request was cancelled, remove from queue
          setQueue(prev => prev.slice(1));
        } else {
          options?.onError?.(id, error instanceof Error ? error : new Error(String(error)));
          // Keep in queue for retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    setIsProcessing(false);
  }, [isProcessing, queue]);

  const clear = useCallback(() => {
    setQueue([]);
  }, []);

  const cancel = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
    if (processingRef.current === id) {
      processingRef.current = "";
    }
  }, []);

  return { queue, enqueue, dequeue, clear, cancel, isProcessing };
}

// Hook for partial data recovery
export function usePartialRecovery<T>(key: string, maxRetries = 3) {
  const [partialData, setPartialData] = useState<T | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const savePartial = useCallback((data: T) => {
    setPartialData(data);
    try {
      localStorage.setItem(`${key}_partial`, JSON.stringify(data));
    } catch {
      // Storage might be full or unavailable
    }
  }, [key]);

  const loadPartial = useCallback((): T | null => {
    try {
      const saved = localStorage.getItem(`${key}_partial`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, [key]);

  const clearPartial = useCallback(() => {
    setPartialData(null);
    try {
      localStorage.removeItem(`${key}_partial`);
    } catch {
      // Ignore
    }
  }, [key]);

  const incrementRetry = useCallback(() => {
    setRetryCount(prev => Math.min(prev + 1, maxRetries));
  }, [maxRetries]);

  const resetRetry = useCallback(() => {
    setRetryCount(0);
  }, []);

  return {
    partialData: partialData || loadPartial(),
    savePartial,
    clearPartial,
    retryCount,
    incrementRetry,
    resetRetry,
    canRetry: retryCount < maxRetries,
  };
}
