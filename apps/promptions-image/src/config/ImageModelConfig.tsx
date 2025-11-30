import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Provider = "openai" | "gemini" | "openrouter";

export interface ImageModelInfo {
    id: string;
    name: string;
    provider: Provider;
}

export interface ProviderConfig {
    enabled: boolean;
    models: ImageModelInfo[];
}

export interface ImageModelConfigContextType {
    providers: Record<Provider, ProviderConfig>;
    selectedModel: ImageModelInfo | null;
    setSelectedModel: (model: ImageModelInfo | null) => void;
    addModel: (provider: Provider, model: Omit<ImageModelInfo, "provider">) => void;
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

export const providerDisplayNames: Record<Provider, string> = {
    openai: "OpenAI (DALL-E)",
    gemini: "Gemini (Imagen)",
    openrouter: "OpenRouter",
};

const ImageModelConfigContext = createContext<ImageModelConfigContextType | undefined>(undefined);

const STORAGE_KEY = "promptions-image-model-config";

interface StoredConfig {
    providers: Record<Provider, ProviderConfig>;
    selectedModel: ImageModelInfo | null;
}

function loadStoredConfig(): StoredConfig | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn("Failed to load image model config from localStorage:", e);
    }
    return null;
}

function saveConfig(config: StoredConfig): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
        console.warn("Failed to save image model config to localStorage:", e);
    }
}

export function ImageModelConfigProvider({ children }: { children: ReactNode }) {
    const storedConfig = loadStoredConfig();

    const [providers, setProviders] = useState<Record<Provider, ProviderConfig>>(
        storedConfig?.providers ?? defaultProviders,
    );
    const [selectedModel, setSelectedModel] = useState<ImageModelInfo | null>(storedConfig?.selectedModel ?? null);

    // Persist to localStorage when config changes
    useEffect(() => {
        saveConfig({ providers, selectedModel });
    }, [providers, selectedModel]);

    const addModel = (provider: Provider, model: Omit<ImageModelInfo, "provider">) => {
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
    };

    const removeModel = (provider: Provider, modelId: string) => {
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
        // Clear selection if the removed model was selected
        if (selectedModel?.id === modelId && selectedModel?.provider === provider) {
            setSelectedModel(null);
        }
    };

    const toggleProvider = (provider: Provider, enabled: boolean) => {
        setProviders((prev) => ({
            ...prev,
            [provider]: {
                ...prev[provider],
                enabled,
            },
        }));
    };

    return (
        <ImageModelConfigContext.Provider
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
        </ImageModelConfigContext.Provider>
    );
}

export function useImageModelConfig(): ImageModelConfigContextType {
    const context = useContext(ImageModelConfigContext);
    if (context === undefined) {
        throw new Error("useImageModelConfig must be used within a ImageModelConfigProvider");
    }
    return context;
}
