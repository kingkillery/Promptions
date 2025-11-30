import type { Provider, ModelInfo } from "../config/ModelConfig";

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface ChatOptions {
    model?: ModelInfo | null;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
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
                }),
                signal: options?.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error || `HTTP error! status: ${response.status}`,
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
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error || `HTTP error! status: ${response.status}`,
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
