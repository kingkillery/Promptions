import { useCallback, useRef, useState, useEffect } from "react";

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableStatuses: number[];
  retryableErrors: string[];
}

// Default retry configuration
export const DefaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ["network", "timeout", "ECONNRESET"],
};

// Calculate delay with exponential backoff and jitter
function calculateDelay(config: RetryConfig, attempt: number): number {
  let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  delay = Math.min(delay, config.maxDelay);

  if (config.jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return Math.round(delay);
}

// Check if an error is retryable
export function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return false;
  }

  if (error instanceof Error) {
    // Check for retryable error messages
    const lowerMessage = error.message.toLowerCase();
    if (config.retryableErrors.some(e => lowerMessage.includes(e.toLowerCase()))) {
      return true;
    }
  }

  return false;
}

// Check if a status code is retryable
export function isRetryableStatus(status: number, config: RetryConfig): boolean {
  return config.retryableStatuses.includes(status);
}

// Hook for retry logic with exponential backoff
export function useRetry<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  config: Partial<RetryConfig> = {}
) {
  const mergedConfig = { ...DefaultRetryConfig, ...config };
  const [attempt, setAttempt] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const execute = useCallback(async (...args: Args): Promise<{ success: boolean; data?: T; error?: Error }> => {
    let lastErrorInner: Error | null = null;

    for (let i = 0; i <= mergedConfig.maxAttempts; i++) {
      setAttempt(i);

      try {
        const data = await fn(...args);
        setLastError(null);
        return { success: true, data };
      } catch (error) {
        lastErrorInner = error instanceof Error ? error : new Error(String(error));
        setLastError(lastErrorInner);

        // Check if we should retry
        const isStatusError = error instanceof Response && isRetryableStatus(error.status, mergedConfig);
        const isErrorRetryable = isRetryableError(error, mergedConfig);

        if (!isStatusError && !isErrorRetryable) {
          return { success: false, error: lastErrorInner };
        }

        // Don't delay after the last attempt
        if (i < mergedConfig.maxAttempts) {
          setIsRetrying(true);
          const delay = calculateDelay(mergedConfig, i);
          await new Promise(resolve => {
            timeoutRef.current = window.setTimeout(resolve, delay);
          });
          setIsRetrying(false);
        }
      }
    }

    return { success: false, error: lastErrorInner! };
  }, [fn, mergedConfig]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsRetrying(false);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setAttempt(0);
    setLastError(null);
  }, [cancel]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    execute,
    cancel,
    reset,
    attempt,
    lastError,
    isRetrying,
    canRetry: attempt < mergedConfig.maxAttempts,
  };
}

// Hook for conditional retry based on state
export function useConditionalRetry<T>(
  condition: () => boolean,
  fn: () => Promise<T>,
  options?: { maxRetries?: number; onSuccess?: (data: T) => void; onFail?: (error: Error) => void }
) {
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  const maxRetries = options?.maxRetries ?? 3;

  const retry = useCallback(async () => {
    if (!condition()) {
      return null;
    }

    try {
      const data = await fn();
      setRetryCount(0);
      setLastError(null);
      options?.onSuccess?.(data);
      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setLastError(err);
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        return null;
      }
      options?.onFail?.(err);
      return null;
    }
  }, [condition, fn, options, retryCount, maxRetries]);

  const reset = useCallback(() => {
    setRetryCount(0);
    setLastError(null);
  }, []);

  return { retry, reset, retryCount, lastError, canRetry: retryCount < maxRetries };
}
