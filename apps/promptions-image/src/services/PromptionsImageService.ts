import { ImageService } from "./ImageService";
import { BasicOptions, OptionSet } from "@promptions/promptions-ui";

export class PromptionsImageService {
    private imageService: ImageService;
    private optionSet: OptionSet<BasicOptions>;

    constructor(imageService: ImageService, optionSet: OptionSet<BasicOptions>) {
        this.imageService = imageService;
        this.optionSet = optionSet;
    }

    async getPromptOptions(
        prompt: string,
        onOptions: (options: BasicOptions, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        const systemPrompt = `You are an AI assistant that generates interactive options for image generation prompts. 

Given a user's image prompt, analyze it and generate relevant interactive options that would help refine and improve the image generation.

Your response must be a valid JSON array following this exact schema:
${this.optionSet.getSchemaSpec()}

Guidelines for generating options:
1. Analyze the prompt to understand what type of image the user wants
2. Generate 3-5 relevant option controls that would be useful for image refinement
3. Include options for:
   - Art style (photorealistic, cartoon, painting, etc.)
   - Color palette or mood
   - Lighting conditions
   - Composition or perspective
   - Additional elements or details
4. For single-select options, provide 3-6 meaningful choices
5. For multi-select options, provide 4-8 options where multiple selections make sense
6. Use clear, descriptive labels for both the controls and their options
7. Make sure the options are contextually relevant to the image prompt
8. Return ONLY the JSON array in a single json markdown block, without any additional text or explanation.

Example output format:
\`\`\`json
[
  {
    "label": "Art Style",
    "type": "single-select",
    "options": ["Photorealistic", "Digital Art", "Oil Painting", "Watercolor", "Sketch"]
  },
  {
    "label": "Lighting",
    "type": "single-select", 
    "options": ["Natural daylight", "Golden hour", "Dramatic shadows", "Soft studio lighting", "Neon/cyberpunk"]
  }
]
\`\`\``;

        const messages = [
            { role: "system" as const, content: systemPrompt },
            { role: "user" as const, content: `Generate options for this image prompt: "${prompt}"` },
        ];

        await this.imageService.streamChat(
            messages,
            (content, done) => {
                if (done) {
                    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                    const jsonText = jsonMatch ? jsonMatch[1] : content.trim();
                    const parsedOptions = this.optionSet.validateJSON(jsonText);
                    if (!parsedOptions) {
                        console.error(`Invalid options JSON: ${jsonText}`);
                        return onOptions(this.optionSet.emptyOptions(), true);
                    }
                    return onOptions(parsedOptions, true);
                }
                const partialOptions = this.tryParsePartialOptions(content);
                if (partialOptions) {
                    onOptions(partialOptions, done);
                }
            },
            options,
        );
    }

    async refreshOptions(
        existingOptions: BasicOptions,
        prompt: string,
        onOptions: (options: BasicOptions, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        const formattedExistingOptions = existingOptions.prettyPrint();

        const systemPrompt = `You are an AI assistant that regenerates interactive options for image generation prompts based on existing options.

Given a user's image prompt and existing options, analyze the context and generate new relevant interactive options that would help refine and improve the image generation. Consider the existing options as context but generate fresh, contextually appropriate options.

Current existing options:
${formattedExistingOptions}

Your response must be a valid JSON array following this exact schema:
${this.optionSet.getSchemaSpec()}

Guidelines for regenerating options:
1. Analyze the prompt to understand what type of image the user wants
2. Consider the existing options but don't feel constrained to replicate them exactly
3. Generate 3-5 relevant option controls that would be useful for image refinement
4. Include options for:
   - Art style (photorealistic, cartoon, painting, etc.)
   - Color palette or mood
   - Lighting conditions
   - Composition or perspective
   - Additional elements or details
5. For single-select options, provide 3-6 meaningful choices
6. For multi-select options, provide 4-8 options where multiple selections make sense
7. Use clear, descriptive labels for both the controls and their options
8. Make sure the new options are contextually relevant to the image prompt
9. The new options should reflect any refinements or improvements over the existing ones
10. Return ONLY the JSON array in a single json markdown block, without any additional text or explanation.

Example output format:
\`\`\`json
[
  {
    "label": "Art Style",
    "type": "single-select",
    "options": ["Photorealistic", "Digital Art", "Oil Painting", "Watercolor", "Sketch"]
  },
  {
    "label": "Lighting",
    "type": "single-select", 
    "options": ["Natural daylight", "Golden hour", "Dramatic shadows", "Soft studio lighting", "Neon/cyberpunk"]
  }
]
\`\`\``;

        const messages = [
            { role: "system" as const, content: systemPrompt },
            { role: "user" as const, content: `Regenerate options for this image prompt: "${prompt}"` },
        ];

        await this.imageService.streamChat(
            messages,
            (content, done) => {
                if (done) {
                    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                    const jsonText = jsonMatch ? jsonMatch[1] : content.trim();
                    const parsedOptions = this.optionSet.validateJSON(jsonText);
                    if (!parsedOptions) {
                        console.error(`Invalid options JSON: ${jsonText}`);
                        return onOptions(this.optionSet.emptyOptions(), true);
                    }
                    return onOptions(parsedOptions, true);
                }
                const partialOptions = this.tryParsePartialOptions(content);
                if (partialOptions) {
                    onOptions(partialOptions, done);
                }
            },
            options,
        );
    }

    private tryParsePartialOptions(optionsStr: string): BasicOptions | undefined {
        try {
            const jsonMatch = optionsStr.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
            let jsonStr = jsonMatch ? jsonMatch[1] : optionsStr;
            return this.optionSet.validatePartialJSON?.(jsonStr);
        } catch (error) {
            return undefined;
        }
    }
}
