// State type for reactive state management
export type State<T> = { get: T; set: (fn: (prev: T) => void) => void };

// Image generation parameters
export interface BaseImageGenerationParams {
    prompt: string;
    size?: "1024x1024" | "1024x1792" | "1792x1024";
    quality?: "high" | "medium" | "low";
    n?: number;
}

// GPT Image 1 parameters
export interface GPTImage1Params {
    kind: "gpt-image-1";
    prompt: string;
    size?: "1024x1024" | "1024x1792" | "1792x1024";
    quality?: "high" | "medium" | "low";
    n?: number;
}

// DALL-E 3 parameters
export interface DallE3Params {
    kind: "dall-e-3";
    prompt: string;
    size?: "1024x1024" | "1024x1792" | "1792x1024";
    quality?: "standard" | "hd";
    style?: "vivid" | "natural";
    n?: number;
}

// Union type for all image generation parameters
export type ImageGenerationParams = GPTImage1Params | DallE3Params;

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
