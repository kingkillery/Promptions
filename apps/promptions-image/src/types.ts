// State type for reactive state management
export type State<T> = { get: T; set: (fn: (prev: T) => void) => void };

// Provider type for image generation
export type ImageProvider = "openai" | "gemini" | "openrouter";

// Image generation parameters
export interface ImageGenerationParams {
    kind: string; // Model ID (e.g., "dall-e-3", "imagen-3.0-generate-001")
    provider?: ImageProvider; // Provider (defaults to "openai")
    prompt: string;
    size?: string;
    quality?: string;
    style?: string;
    n?: number;
    aspectRatio?: string; // For Gemini
}

// Generated image result
export interface GeneratedImage {
    id: string;
    base64String: string;
    prompt: string;
    revisedPrompt?: string;
    timestamp: Date;
}

// Options elaboration parameters
export interface OptionsParams {
    prompt: string;
}

// Generation status
export type GenerationStatus = "idle" | "elaborating" | "generating" | "completed" | "error";

// Error type
export interface GenerationError {
    message: string;
    code?: string;
}
