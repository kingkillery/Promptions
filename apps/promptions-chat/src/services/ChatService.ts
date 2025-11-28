interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
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
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        console.log(JSON.stringify(messages, null, 2));

        try {
            const response = await fetch(`${this.baseUrl}/api/chat/stream`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages,
                    model: "gpt-4.1",
                    temperature: 0.7,
                    max_tokens: 1000,
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
                            const content =
                                parsed.choices?.[0]?.delta?.content ?? "";
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

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages,
                    model: "gpt-3.5-turbo",
                    temperature: 0.7,
                    max_tokens: 1000,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error || `HTTP error! status: ${response.status}`,
                );
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "No response received";
        } catch (error) {
            console.error("Error in sendMessage:", error);
            throw error;
        }
    }
}
