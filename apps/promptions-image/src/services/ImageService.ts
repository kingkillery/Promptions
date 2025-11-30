import { ImageGenerationParams, GeneratedImage } from "../types";

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

export class ImageService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = getApiBaseUrl();
    }

    async generateImage(
        params: ImageGenerationParams,
        options?: { signal?: AbortSignal },
    ): Promise<GeneratedImage[]> {
        try {
            console.log("Generating image with params:", params);

            const response = await fetch(`${this.baseUrl}/api/images/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    model: params.kind,
                    provider: params.provider || "openai",
                    prompt: params.prompt,
                    size: params.size,
                    quality: params.quality,
                    aspectRatio: params.aspectRatio,
                    n: params.n || 1,
                    response_format: "b64_json",
                }),
                signal: options?.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error || `HTTP error! status: ${response.status}`,
                );
            }

            const data = await response.json();

            const images: GeneratedImage[] = (data.data || []).map(
                (image: { b64_json?: string; revised_prompt?: string }) => ({
                    id: crypto.randomUUID(),
                    base64String: image.b64_json!,
                    prompt: params.prompt,
                    revisedPrompt: image.revised_prompt,
                    timestamp: new Date(),
                }),
            );

            console.log("Generated images:", images);
            return images;
        } catch (error) {
            console.error("Error generating image:", error);
            throw error;
        }
    }

    async streamChat(
        messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
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
}
