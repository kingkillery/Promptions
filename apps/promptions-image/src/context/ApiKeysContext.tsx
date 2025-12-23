import React from "react";

const STORAGE_KEY = "promptions-api-keys";

// Local type definition (matches @promptions/promptions-ui ApiKeys)
export interface ApiKeys {
    openai?: string;
    gemini?: string;
    openrouter?: string;
}

export interface ServerKeysStatus {
    openai: boolean;
    gemini: boolean;
    openrouter: boolean;
}

interface ApiKeysContextValue {
    apiKeys: ApiKeys;
    setApiKeys: (keys: ApiKeys) => void;
    serverHasKeys: ServerKeysStatus;
    isLoading: boolean;
}

const ApiKeysContext = React.createContext<ApiKeysContextValue | undefined>(undefined);

function loadApiKeys(): ApiKeys {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load API keys from storage:", e);
    }
    return {};
}

function saveApiKeys(keys: ApiKeys): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    } catch (e) {
        console.error("Failed to save API keys to storage:", e);
    }
}

export function ApiKeysProvider({ children }: { children: React.ReactNode }) {
    const [apiKeys, setApiKeysState] = React.useState<ApiKeys>(loadApiKeys);
    const [serverHasKeys, setServerHasKeys] = React.useState<ServerKeysStatus>({
        openai: false,
        gemini: false,
        openrouter: false,
    });
    const [isLoading, setIsLoading] = React.useState(true);

    // Fetch server keys status on mount
    React.useEffect(() => {
        const fetchServerKeys = async () => {
            try {
                const response = await fetch("/api/keys/check", {
                    credentials: "include",
                });
                if (response.ok) {
                    const data = await response.json();
                    setServerHasKeys(data.serverHasKeys);
                }
            } catch (e) {
                console.error("Failed to fetch server keys status:", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchServerKeys();
    }, []);

    const setApiKeys = React.useCallback((keys: ApiKeys) => {
        setApiKeysState(keys);
        saveApiKeys(keys);
    }, []);

    const value = React.useMemo(
        () => ({ apiKeys, setApiKeys, serverHasKeys, isLoading }),
        [apiKeys, setApiKeys, serverHasKeys, isLoading]
    );

    return <ApiKeysContext.Provider value={value}>{children}</ApiKeysContext.Provider>;
}

export function useApiKeys(): ApiKeysContextValue {
    const context = React.useContext(ApiKeysContext);
    if (!context) {
        throw new Error("useApiKeys must be used within an ApiKeysProvider");
    }
    return context;
}
