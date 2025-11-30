import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type Provider = "openai" | "gemini" | "openrouter";

export interface ModelInfo {
    id: string;
    name: string;
    provider: Provider;
}

export interface ProviderConfig {
    enabled: boolean;
    models: ModelInfo[];
}

export interface ModelConfigContextType {
    providers: Record<Provider, ProviderConfig>;
    selectedModel: ModelInfo | null;
    setSelectedModel: (model: ModelInfo | null) => void;
    addModel: (provider: Provider, model: Omit<ModelInfo, "provider">) => void;
    removeModel: (provider: Provider, modelId: string) => void;
    toggleProvider: (provider: Provider, enabled: boolean) => void;
}

const defaultProviders: Record<Provider, ProviderConfig> = {
    openai: {
        enabled: true,
        models: [],
    },
    gemini: {
        enabled: true,
        models: [],
    },
    openrouter: {
        enabled: true,
        models: [],
    },
};

const STORAGE_KEY = "promptions-model-config";

function loadFromStorage(): { providers: Record<Provider, ProviderConfig>; selectedModel: ModelInfo | null } {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {
        // Ignore storage errors
    }
    return { providers: defaultProviders, selectedModel: null };
}

function saveToStorage(providers: Record<Provider, ProviderConfig>, selectedModel: ModelInfo | null) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ providers, selectedModel }));
    } catch {
        // Ignore storage errors
    }
}

const ModelConfigContext = createContext<ModelConfigContextType | null>(null);

export function useModelConfig() {
    const context = useContext(ModelConfigContext);
    if (!context) {
        throw new Error("useModelConfig must be used within a ModelConfigProvider");
    }
    return context;
}

export function ModelConfigProvider({ children }: { children: React.ReactNode }) {
    const [providers, setProviders] = useState<Record<Provider, ProviderConfig>>(() => loadFromStorage().providers);
    const [selectedModel, setSelectedModelState] = useState<ModelInfo | null>(() => loadFromStorage().selectedModel);

    // Persist to localStorage whenever state changes
    useEffect(() => {
        saveToStorage(providers, selectedModel);
    }, [providers, selectedModel]);

    const setSelectedModel = useCallback((model: ModelInfo | null) => {
        setSelectedModelState(model);
    }, []);

    const addModel = useCallback((provider: Provider, model: Omit<ModelInfo, "provider">) => {
        setProviders((prev) => {
            const providerConfig = prev[provider];
            // Check if model already exists
            if (providerConfig.models.some((m) => m.id === model.id)) {
                return prev;
            }
            return {
                ...prev,
                [provider]: {
                    ...providerConfig,
                    models: [...providerConfig.models, { ...model, provider }],
                },
            };
        });
    }, []);

    const removeModel = useCallback((provider: Provider, modelId: string) => {
        setProviders((prev) => {
            const providerConfig = prev[provider];
            return {
                ...prev,
                [provider]: {
                    ...providerConfig,
                    models: providerConfig.models.filter((m) => m.id !== modelId),
                },
            };
        });
        // If the removed model was selected, clear selection
        setSelectedModelState((prev) => {
            if (prev && prev.id === modelId && prev.provider === provider) {
                return null;
            }
            return prev;
        });
    }, []);

    const toggleProvider = useCallback((provider: Provider, enabled: boolean) => {
        setProviders((prev) => ({
            ...prev,
            [provider]: {
                ...prev[provider],
                enabled,
            },
        }));
    }, []);

    return (
        <ModelConfigContext.Provider
            value={{
                providers,
                selectedModel,
                setSelectedModel,
                addModel,
                removeModel,
                toggleProvider,
            }}
        >
            {children}
        </ModelConfigContext.Provider>
    );
}

export const providerDisplayNames: Record<Provider, string> = {
    openai: "OpenAI",
    gemini: "Gemini (AI Studio)",
    openrouter: "OpenRouter",
};
