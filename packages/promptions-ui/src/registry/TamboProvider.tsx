import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from "react";
import { registry, RegisteredComponent, RegistryEntry } from "./componentRegistry";

interface TamboContextValue {
  registry: typeof registry;
  registeredComponents: Map<string, RegistryEntry>;
  thread: Map<string, Record<string, unknown>>;
  updateThread: (componentId: string, props: Record<string, unknown>) => void;
  removeFromThread: (componentId: string) => void;
  clearThread: () => void;
}

const TamboContext = createContext<TamboContextValue | null>(null);

interface TamboProviderProps {
  children: ReactNode;
  initialThread?: Record<string, Record<string, unknown>>;
}

export function TamboProvider({ children, initialThread = {} }: TamboProviderProps) {
  const [thread, setThread] = useState<Map<string, Record<string, unknown>>>(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const [id, props] of Object.entries(initialThread)) {
      map.set(id, props);
    }
    return map;
  });

  const registeredComponents = useMemo(() => registry.getAll(), []);

  const updateThread = useCallback((componentId: string, props: Record<string, unknown>) => {
    setThread(prev => {
      const next = new Map(prev);
      const existing = next.get(componentId);
      next.set(componentId, existing ? { ...existing, ...props } : props);
      return next;
    });
  }, []);

  const removeFromThread = useCallback((componentId: string) => {
    setThread(prev => {
      const next = new Map(prev);
      next.delete(componentId);
      return next;
    });
  }, []);

  const clearThread = useCallback(() => {
    setThread(new Map());
  }, []);

  const value = useMemo(() => ({
    registry,
    registeredComponents,
    thread,
    updateThread,
    removeFromThread,
    clearThread,
  }), [registeredComponents, thread, updateThread, removeFromThread, clearThread]);

  return (
    <TamboContext.Provider value={value}>
      {children}
    </TamboContext.Provider>
  );
}

export function useTambo(): TamboContextValue {
  const context = useContext(TamboContext);
  if (!context) {
    throw new Error("useTambo must be used within a TamboProvider");
  }
  return context;
}

export function useRegisteredComponents() {
  const { registeredComponents } = useTambo();
  return registeredComponents;
}

export function useThread(): Map<string, Record<string, unknown>> {
  const { thread } = useTambo();
  return thread;
}

export function useThreadItem<T = Record<string, unknown>>(componentId: string): T | undefined {
  const { thread } = useTambo();
  return thread.get(componentId) as T | undefined;
}
