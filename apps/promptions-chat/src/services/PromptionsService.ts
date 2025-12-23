import { ChatService } from "./ChatService";
import { Options, OptionSet } from "@promptions/promptions-llm";

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export class PromptionsService {
    private chatService: ChatService;
    private optionSet: OptionSet<Options>;

    constructor(chatService: ChatService, optionSet: OptionSet<Options>) {
        this.chatService = chatService;
        this.optionSet = optionSet;
    }

    async getOptions(
        chatHistory: ChatMessage[],
        onOptions: (options: Options, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        // Check for deterministic options first
        const deterministicOptions = this.checkDeterministicOptions(chatHistory);
        if (deterministicOptions) {
            onOptions(deterministicOptions, true);
            return;
        }

        const systemPrompt: ChatMessage = {
            role: "system",
            content: `You are an AI assistant that generates interactive, beautiful, and highly context-aware interfaces.

Your goal is to transform the user's needs into a dynamic application.

Output Format:
You must return a single JSON object (within \`\`\`json blocks) that follows this exact schema:
${this.optionSet.getSchemaSpec()}

Capabilities & Guidelines:
1. **Meta-Reasoning (thought):** ALWAYS provide an internal thought process before the UI structure. Interpret the user's hidden intent and explain your chosen design strategy.
2. **Adaptive Layouts (layout):** Choose the best layout for the task:
   - 'sidebar': Standard task-oriented controls.
   - 'main': For data-heavy or primary workspaces.
   - 'full': For immersive experiences or dashboards.
3. **The Sandbox (canvas):** When high-level interactive visualizations, games, or custom simulations are needed, use a 'canvas' control. Generate high-quality raw HTML and JS. You can use Tailwind CSS via CDN classes.
4. **Standard Controls (options):** Use single-select, multi-select, and binary-select for structured data capture.
5. **Interactive Feedback:** If the conversation history includes "[Interaction: ...]", acknowledge the user's specific UI modulation in your thought process and update the UI accordingly.

Design Philosophy:
- **Premium Aesthetics:** Use modern terminology in labels.
- **Micro-Interactions:** When using 'canvas', include hover effects and smooth transitions.
- **Proactive Utility:** Don't just answer; build the tool they didn't know they needed.

Example output format:
\`\`\`json
{
  "thought": "The user is asking about solar data, so I will build a real-time orbit simulator and add controls for planetary scale.",
  "layout": "main",
  "options": [
    { "kind": "canvas", "label": "Solar System Simulator", "code": "..." },
    { "kind": "single-select", "label": "Zoom Level", ... }
  ]
}
\`\`\``,
        };

        const messages: ChatMessage[] = [systemPrompt, ...chatHistory];

        await this.chatService.streamChat(
            messages,
            (content, done) => {
                if (done) {
                    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                    const jsonText = jsonMatch ? jsonMatch[1] : content.trim();
                    const parsedOptions = this.optionSet.validateJSON(jsonText);
                    if (!parsedOptions) {
                        throw new Error(`Invalid options JSON: ${jsonText}`);
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
        existingOptions: Options,
        chatHistory: ChatMessage[],
        onOptions: (options: Options, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        const formattedExistingOptions = existingOptions.prettyPrint();

        const systemPrompt: ChatMessage = {
            role: "system",
            content: `You are an AI assistant that regenerates interactive options based on conversation history and existing options. 

Given a chat conversation and a set of existing options, analyze the updated context and generate new relevant interactive options that the user might want to select from. Consider the existing options as context but generate fresh, contextually appropriate options for the current state of the conversation.

Current existing options:
${formattedExistingOptions}

Your response must be a valid JSON array following this exact schema:
${this.optionSet.getSchemaSpec()}

Guidelines for regenerating options:
1. Analyze the conversation history to understand the updated context and user's evolving needs
2. Consider the existing options but don't feel constrained to replicate them exactly
3. Generate 2-4 relevant option controls that would be useful for the user in the current context
4. For single-select options, provide 3-5 meaningful choices
5. For multi-select options, provide 4-8 options where multiple selections make sense
6. Use clear, descriptive labels for both the controls and their options
7. Make sure the new options are contextually relevant to the current conversation state
8. The new options should reflect any progression or changes in the conversation since the existing options were generated
9. Return ONLY the JSON array in a single json markdown block, without any additional text or explanation.

Example output format:
<example>
\`\`\`json
[
  ...
]
\`\`\`
`,
        };

        const messages: ChatMessage[] = [systemPrompt, ...chatHistory];

        await this.chatService.streamChat(
            messages,
            (content, done) => {
                if (done) {
                    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                    const jsonText = jsonMatch ? jsonMatch[1] : content.trim();
                    const parsedOptions = this.optionSet.validateJSON(jsonText);
                    if (!parsedOptions) {
                        throw new Error(`Invalid options JSON: ${jsonText}`);
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

    private tryParsePartialOptions(optionsStr: string): Options | undefined {
        try {
            const jsonMatch = optionsStr.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
            let jsonStr = jsonMatch ? jsonMatch[1] : optionsStr;
            return this.optionSet.validatePartialJSON?.(jsonStr);
        } catch (error) {
            return undefined;
        }
    }

    private checkDeterministicOptions(chatHistory: ChatMessage[]): Options | undefined {
        const lastMessage = chatHistory[chatHistory.length - 1];
        if (!lastMessage || lastMessage.role !== "user") return undefined;

        const content = lastMessage.content.toLowerCase();

        // Deterministic rules mapping patterns to option JSONs
        const rules: { pattern: RegExp; optionsJson: string }[] = [
            {
                pattern: /^\/settings|show settings/i,
                optionsJson: JSON.stringify([
                    {
                        kind: "single-select",
                        label: "Theme",
                        options: { light: "Light", dark: "Dark", system: "System" },
                        value: "system",
                    },
                    {
                        kind: "binary-select",
                        label: "Notifications",
                        options: { enabled: "On", disabled: "Off" },
                        value: "enabled",
                    },
                ]),
            },
            {
                pattern: /^\/predict|predict mode/i,
                optionsJson: JSON.stringify([
                    {
                        kind: "single-select",
                        label: "Prediction Model",
                        options: { fast: "Fast (Low Latency)", accurate: "Accurate (High Quality)" },
                        value: "fast",
                    },
                    {
                        kind: "multi-select",
                        label: "Data Sources",
                        options: { history: "Chat History", web: "Web Search", docs: "Documentation" },
                        value: ["history"],
                    },
                ]),
            },
        ];

        for (const rule of rules) {
            if (rule.pattern.test(content)) {
                return this.optionSet.validateJSON(rule.optionsJson);
            }
        }

        return undefined;
    }
}
