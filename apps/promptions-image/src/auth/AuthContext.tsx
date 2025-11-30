import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

function getApiBaseUrl(): string {
    if (import.meta.env.PROD) {
        return "";
    }
    return import.meta.env.VITE_API_BASE_URL || "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const baseUrl = getApiBaseUrl();

    // Check auth status on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch(`${baseUrl}/api/auth/check`, {
                    credentials: "include",
                });
                const data = await response.json();
                setIsAuthenticated(data.authenticated);
            } catch {
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, [baseUrl]);

    const login = useCallback(
        async (username: string, password: string): Promise<boolean> => {
            setError(null);
            try {
                const response = await fetch(`${baseUrl}/api/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                    credentials: "include",
                });

                if (response.ok) {
                    const data = await response.json();
                    // Store token in localStorage as backup for Authorization header
                    if (data.token) {
                        localStorage.setItem("session", data.token);
                    }
                    setIsAuthenticated(true);
                    return true;
                } else {
                    const data = await response.json();
                    setError(data.error || "Login failed");
                    return false;
                }
            } catch (e) {
                setError("Network error. Please try again.");
                return false;
            }
        },
        [baseUrl],
    );

    const logout = useCallback(async () => {
        try {
            await fetch(`${baseUrl}/api/auth/logout`, {
                method: "POST",
                credentials: "include",
            });
        } finally {
            localStorage.removeItem("session");
            setIsAuthenticated(false);
        }
    }, [baseUrl]);

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, error }}>
            {children}
        </AuthContext.Provider>
    );
}
