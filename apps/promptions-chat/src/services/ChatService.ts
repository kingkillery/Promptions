import type { Provider, ModelInfo } from "../config/ModelConfig";

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface ApiKeys {
    openai?: string;
    gemini?: string;
    openrouter?: string;
}

export interface ChatOptions {
    model?: ModelInfo | null;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
    /** Number of retry attempts for failed requests (default: 3) */
    maxRetries?: number;
    /** Base delay in ms between retries, doubles each attempt (default: 1000) */
    retryDelay?: number;
    /** User-provided API keys (optional, falls back to server keys) */
    apiKeys?: ApiKeys;
}

/** Error types that are safe to retry (excludes 401 auth errors) */
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404];

/** Check if an error is retryable */
function isRetryableError(error: unknown, status?: number): boolean {
    // Don't retry if user aborted
    if (error instanceof DOMException && error.name === "AbortError") {
        return false;
    }
    // Don't retry non-retryable status codes (auth errors, not found, etc.)
    if (status && NON_RETRYABLE_STATUS_CODES.includes(status)) {
        return false;
    }
    // Retry on network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
        return true;
    }
    // Retry on specific HTTP status codes
    if (status && RETRYABLE_STATUS_CODES.includes(status)) {
        return true;
    }
    return false;
}

/** Sleep for a given duration */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Get the API base URL - use relative path in production (same origin)
// or localhost in development
function getApiBaseUrl(): string {
    // In production, use relative path (same server serves API)
    if (import.meta.env.PROD) {
        return "";
    }
    // In development, you can point to a local server or use the Vite proxy
    return import.meta.env.VITE_API_BASE_URL || "";
}

export class ChatService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = getApiBaseUrl();
    }

    /**
     * Execute a fetch request with exponential backoff retry logic.
     * @param fetchFn - Function that performs the fetch
     * @param options - Retry configuration options
     * @returns The successful response
     */
    private async fetchWithRetry(
        fetchFn: () => Promise<Response>,
        options: {
            maxRetries?: number;
            retryDelay?: number;
            signal?: AbortSignal;
            onRetry?: (attempt: number, error: Error) => void;
        } = {},
    ): Promise<Response> {
        const maxRetries = options.maxRetries ?? 3;
        const baseDelay = options.retryDelay ?? 1000;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Check if aborted before attempting
                if (options.signal?.aborted) {
                    throw new DOMException("Request aborted", "AbortError");
                }

                const response = await fetchFn();

                // If response is ok, return it
                if (response.ok) {
                    return response;
                }

                // Check if we should retry this status code
                if (!isRetryableError(null, response.status) || attempt === maxRetries) {
                    return response; // Return the error response for caller to handle
                }

                // Extract error for logging
                const errorData = await response.clone().json().catch(() => ({}));
                lastError = new Error(errorData.error || `HTTP ${response.status}`);

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Don't retry non-retryable errors
                if (!isRetryableError(error) || attempt === maxRetries) {
                    throw lastError;
                }
            }

            // Calculate delay with exponential backoff and jitter
            const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
            console.warn(`Request failed, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})...`);
            options.onRetry?.(attempt + 1, lastError!);

            await sleep(delay);
        }

        throw lastError || new Error("Request failed after retries");
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: ChatOptions,
    ): Promise<void> {
        console.log(JSON.stringify(messages, null, 2));

        // Determine the endpoint and model based on provider
        const model = options?.model;
        const provider = model?.provider || "openai";
        const modelId = model?.id || "gpt-4.1";

        // Map provider to endpoint
        const endpoint = this.getEndpoint(provider, true);

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    messages,
                    model: modelId,
                    provider,
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens ?? 1000,
                    apiKeys: options?.apiKeys,
                }),
                signal: options?.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    throw new Error("Session expired. Please log in again.");
                }
                throw new Error(
                    typeof errorData.error === 'string'
                        ? errorData.error
                        : `HTTP error! status: ${response.status}`,
                );
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("No response body");
            }

            const decoder = new TextDecoder();
            let accumulatedContent = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process SSE events
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") {
                            onContent(accumulatedContent, true);
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            // Handle different response formats
                            const content = this.extractContent(parsed, provider);
                            if (content) {
                                accumulatedContent += content;
                                onContent(accumulatedContent, false);
                            }
                        } catch {
                            // Skip invalid JSON lines
                        }
                    }
                }
            }

            onContent(accumulatedContent, true);
        } catch (error) {
            console.error("Error in streamChat:", error);
            throw error;
        }
    }

    async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
        const model = options?.model;
        const provider = model?.provider || "openai";
        const modelId = model?.id || "gpt-3.5-turbo";

        const endpoint = this.getEndpoint(provider, false);

        try {
            const response = await this.fetchWithRetry(
                () =>
                    fetch(`${this.baseUrl}${endpoint}`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        credentials: "include",
                        body: JSON.stringify({
                            messages,
                            model: modelId,
                            provider,
                            temperature: options?.temperature ?? 0.7,
                            max_tokens: options?.maxTokens ?? 1000,
                            apiKeys: options?.apiKeys,
                        }),
                    }),
                {
                    maxRetries: options?.maxRetries,
                    retryDelay: options?.retryDelay,
                },
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    throw new Error("Session expired. Please log in again.");
                }
                throw new Error(
                    typeof errorData.error === 'string'
                        ? errorData.error
                        : `HTTP error! status: ${response.status}`,
                );
            }

            const data = await response.json();
            return this.extractMessageContent(data, provider);
        } catch (error) {
            console.error("Error in sendMessage:", error);
            throw error;
        }
    }

    private getEndpoint(_provider: Provider, stream: boolean): string {
        // All providers use the same endpoint, server routes based on provider param
        return stream ? "/api/chat/stream" : "/api/chat";
    }

    private extractContent(parsed: unknown, provider: Provider): string {
        const data = parsed as Record<string, unknown>;

        // OpenAI and OpenRouter format
        if (provider === "openai" || provider === "openrouter") {
            const choices = data.choices as Array<{ delta?: { content?: string } }> | undefined;
            return choices?.[0]?.delta?.content ?? "";
        }

        // Gemini format
        if (provider === "gemini") {
            const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
            return candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        }

        return "";
    }

    private extractMessageContent(data: unknown, provider: Provider): string {
        const response = data as Record<string, unknown>;

        // OpenAI and OpenRouter format
        if (provider === "openai" || provider === "openrouter") {
            const choices = response.choices as Array<{ message?: { content?: string } }> | undefined;
            return choices?.[0]?.message?.content || "No response received";
        }

        // Gemini format
        if (provider === "gemini") {
            const candidates = response.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
            return candidates?.[0]?.content?.parts?.[0]?.text || "No response received";
        }

        return "No response received";
    }
}
