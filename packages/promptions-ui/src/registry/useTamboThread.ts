import { useState, useCallback, useRef, useEffect } from "react";
import { useTambo } from "./TamboProvider";

interface StreamingState<T> {
  data: T;
  isStreaming: boolean;
  progress: number;
}

interface UseTamboThreadOptions {
  componentId: string;
  initialData?: Record<string, unknown>;
  batchUpdates?: boolean;
  batchDelay?: number;
}

/**
 * Hook for progressive/prop streaming from AI to React components.
 * Enables real-time UI updates as the AI streams component props.
 */
export function useTamboThread<T extends Record<string, unknown>>(
  options: UseTamboThreadOptions
): [T, (updates: Partial<T>) => void, StreamingState<T>] {
  const { componentId, initialData = {} as T, batchUpdates = false, batchDelay = 50 } = options;
  const { updateThread, thread } = useTambo();
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState(0);
  const pendingUpdatesRef = useRef<Partial<T>>({});
  const timeoutRef = useRef<number | null>(null);

  const currentData = (thread.get(componentId) || initialData) as T;

  const flushUpdates = useCallback(() => {
    if (Object.keys(pendingUpdatesRef.current).length === 0) return;

    updateThread(componentId, pendingUpdatesRef.current as Record<string, unknown>);
    pendingUpdatesRef.current = {};
    setIsStreaming(false);
    setProgress(100);
  }, [componentId, updateThread]);

  const update = useCallback((updates: Partial<T>) => {
    setIsStreaming(true);
    setProgress(prev => Math.min(prev + 10, 95));

    if (batchUpdates) {
      Object.assign(pendingUpdatesRef.current, updates);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(flushUpdates, batchDelay);
    } else {
      updateThread(componentId, updates as Record<string, unknown>);
      setIsStreaming(false);
      setProgress(100);
    }
  }, [batchUpdates, batchDelay, componentId, updateThread, flushUpdates]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return [currentData, update, { data: currentData, isStreaming, progress }];
}

/**
 * Hook for streaming updates with error handling and retry capability.
 */
export function useStreamingProps<T extends Record<string, unknown>>(
  componentId: string,
  options?: { onError?: (error: Error) => void; onComplete?: () => void }
) {
  const { updateThread, removeFromThread } = useTambo();
  const [error, setError] = useState<Error | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const streamProps = useCallback(async (
    propStream: AsyncIterable<Partial<T>>,
    initialProps?: Partial<T>
  ) => {
    setError(null);
    if (initialProps) {
      updateThread(componentId, initialProps as Record<string, unknown>);
    }

    try {
      for await (const updates of propStream) {
        updateThread(componentId, updates as Record<string, unknown>);
      }
      setIsComplete(true);
      options?.onComplete?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      options?.onError?.(error);
    }
  }, [componentId, updateThread, options]);

  const reset = useCallback(() => {
    setError(null);
    setIsComplete(false);
  }, []);

  return { streamProps, error, isComplete, reset, removeFromThread };
}

/**
 * Hook for managing component state that syncs with the Tambo thread.
 */
export function useComponentState<T extends Record<string, unknown>>(
  componentId: string,
  key: keyof T
): [T[typeof key] | undefined, (value: T[typeof key]) => void] {
  const { thread, updateThread } = useTambo();
  const currentValue = thread.get(componentId)?.[key as string] as T[typeof key] | undefined;

  const setValue = useCallback((value: T[typeof key]) => {
    updateThread(componentId, { [key]: value } as Record<string, unknown>);
  }, [componentId, key, updateThread]);

  return [currentValue, setValue];
}
