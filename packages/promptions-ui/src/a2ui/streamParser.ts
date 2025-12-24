import { A2UIStreamMessage, A2UIComponent, A2UIAction, validateStreamMessage, DefaultA2UIConfig, A2UIConfig } from "./protocol";

interface ParsedState {
  components: Map<string, A2UIComponent>;
  rootIds: string[];
  version: number;
}

interface StreamParserOptions {
  config?: Partial<A2UIConfig>;
  onError?: (error: Error, message: unknown) => void;
  onWarning?: (warning: string) => void;
}

export class A2UIStreamParser {
  private config: A2UIConfig;
  private state: ParsedState;
  private buffer: string = "";
  private version: number = 0;
  private onError?: (error: Error, message: unknown) => void;
  private onWarning?: (warning: string) => void;

  constructor(options: StreamParserOptions = {}) {
    this.config = { ...DefaultA2UIConfig, ...options.config };
    this.onError = options.onError;
    this.onWarning = options.onWarning;
    this.state = {
      components: new Map(),
      rootIds: [],
      version: 0,
    };
  }

  /**
   * Process incoming chunk of data from the AI stream.
   * Handles partial JSON and multiple messages.
   */
  processChunk(chunk: string): A2UIStreamMessage[] {
    this.buffer += chunk;
    const messages: A2UIStreamMessage[] = [];
    let boundary = this.buffer.indexOf("\n");

    while (boundary !== -1) {
      const line = this.buffer.slice(0, boundary).trim();
      this.buffer = this.buffer.slice(boundary + 1);

      if (line) {
        try {
          const parsed = JSON.parse(line);
          const validation = validateStreamMessage(parsed);

          if (validation.valid) {
            const message = parsed as A2UIStreamMessage;
            this.applyMessage(message);
            messages.push(message);
          } else {
            this.onWarning?.(`Invalid message: ${validation.errors.join(", ")}`);
          }
        } catch (error) {
          this.onError?.(new Error(`Parse error: ${error}`), line);
        }
      }

      boundary = this.buffer.indexOf("\n");
    }

    return messages;
  }

  /**
   * Apply a validated message to the state.
   */
  private applyMessage(message: A2UIStreamMessage): void {
    this.version++;

    switch (message.type) {
      case "component":
        this.addComponent(message.data);
        break;

      case "update":
        this.updateComponent(message.id, message.props);
        break;

      case "remove":
        this.removeComponent(message.id);
        break;

      case "action":
        // Actions are not stored, they're forwarded
        break;

      case "error":
        this.onError?.(new Error(message.message), message);
        break;
    }

    this.state.version = this.version;
  }

  private addComponent(component: A2UIComponent): void {
    if (this.state.components.size >= this.config.maxComponents) {
      this.onWarning?.("Max components limit reached");
      return;
    }

    if (component.id) {
      this.state.components.set(component.id, component);

      // If no children or root, this might be a root component
      if (!component.children || component.children.length === 0) {
        if (!this.state.rootIds.includes(component.id)) {
          this.state.rootIds.push(component.id);
        }
      }

      // Add children
      if (component.children) {
        for (const child of component.children) {
          this.addComponent(child);
        }
      }
    }
  }

  private updateComponent(id: string, props: Record<string, unknown>): void {
    const component = this.state.components.get(id);
    if (component) {
      component.props = { ...component.props, ...props };
    }
  }

  private removeComponent(id: string): void {
    const component = this.state.components.get(id);
    if (component) {
      // Remove children first
      if (component.children) {
        for (const child of component.children) {
          this.removeComponent(child.id);
        }
      }
      this.state.components.delete(id);
      this.state.rootIds = this.state.rootIds.filter(rootId => rootId !== id);
    }
  }

  /**
   * Get the current parsed state.
   */
  getState(): ParsedState {
    return { ...this.state };
  }

  /**
   * Get a specific component by ID.
   */
  getComponent(id: string): A2UIComponent | undefined {
    return this.state.components.get(id);
  }

  /**
   * Get all root components.
   */
  getRootComponents(): A2UIComponent[] {
    return this.state.rootIds
      .map(id => this.state.components.get(id))
      .filter((c): c is A2UIComponent => c !== undefined);
  }

  /**
   * Get the current version number.
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Clear the parser state.
   */
  reset(): void {
    this.buffer = "";
    this.version = 0;
    this.state = {
      components: new Map(),
      rootIds: [],
      version: 0,
    };
  }
}

/**
 * Create an async generator that yields parsed A2UI messages from a stream.
 */
export async function* parseA2UIStream(
  stream: AsyncIterable<string>,
  options?: StreamParserOptions
): AsyncGenerator<A2UIStreamMessage, void, unknown> {
  const parser = new A2UIStreamParser(options);

  for await (const chunk of stream) {
    const messages = parser.processChunk(chunk);
    for (const message of messages) {
      yield message;
    }
  }
}

/**
 * Parse a complete A2UI JSON string (for non-streaming scenarios).
 */
export function parseA2UIJSON(json: string, options?: StreamParserOptions): ParsedState {
  const parser = new A2UIStreamParser(options);
  parser.processChunk(json + "\n");
  return parser.getState();
}
