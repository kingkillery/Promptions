# A2UI Protocol: Advancing Real-Time AI-to-UI Generation

**Real-time streaming UI generation is converging on declarative JSON with typed data parts**—the approach pioneered by Tambo AI and now validated by Vercel AI SDK 6. The key breakthrough: separating AI reasoning from UI rendering through schema-enforced, progressive streaming. This report synthesizes patterns from 15+ frameworks to chart A2UI v2's path to production.

## Executive summary: Top 10 recommendations

The research reveals a clear industry direction. A2UI should adopt these priorities:

1. **Implement ID-based part reconciliation** (Vercel pattern)—update existing components without re-creation
2. **Adopt Pydantic/Zod as schema source of truth** with auto-generated JSON Schema for LLM consumption
3. **Use strict mode structured outputs** (OpenAI/Anthropic)—both now guarantee 100% schema compliance
4. **Add transient vs persistent data part distinction** for ephemeral loading states
5. **Integrate Instructor-style retry logic** at protocol level for schema validation failures
6. **Implement ARIA live regions** with `aria-relevant="additions"` for accessible streaming
7. **Require DOMPurify sanitization** before rendering any AI-generated content
8. **Support progressive rendering via partial JSON parsing** using `best-effort-json-parser`
9. **Define standard part types**: text, tool-call, data, source, error, file
10. **Consider SSE format migration** for standardization, automatic reconnection, and DevTools support

---

## Category analysis

### Priority 1: AI-assisted UI generation patterns

The most actionable patterns come from **Tambo AI**, which provides a production-ready blueprint for A2UI component discovery and selection.

**Tambo's component registration pattern** solves the fundamental challenge of helping LLMs understand which components to use:

```typescript
const components: TamboComponent[] = [{
  name: "WeatherCard",
  description: "Shows weather information. Use for displaying current conditions, forecasts, or weather alerts for any location.",
  component: WeatherCard,
  propsSchema: z.object({
    location: z.string().describe("City name or coordinates"),
    temperature: z.number().describe("Temperature in user's preferred unit"),
    condition: z.enum(["sunny", "cloudy", "rainy", "snowy"]),
  }),
}];
```

**What makes good AI-readable component descriptions** emerged as a key finding. Effective descriptions include: semantic component names (`WeatherCard` not `Card1`), use-case guidance in descriptions ("Use for..." language), typed props with per-field descriptions, and enum constraints for known options. Tambo's approach of registering components with rich Zod schemas enables AI models to select appropriate components **without embedding-based search**—the schema descriptions themselves provide sufficient context.

**Prop inference and schema introspection** benefits from Zod 4's native JSON Schema support. The `zodToJsonSchema()` function with `target: "openAi3_1"` produces schemas compatible with OpenAI's strict mode requirements (all fields required, `additionalProperties: false`). For complex UI trees, recursive schemas using `$ref` and `$defs` work with both OpenAI and Anthropic structured outputs.

**Fallback handling** should implement a three-tier strategy: (1) programmatic JSON repair using `json-repair` library for malformed output, (2) Zod safeParse for validation with partial rendering of valid subtrees, (3) graceful degradation to FallbackCard components with error context. Tambo implements automatic retries for schema validation failures—a pattern A2UI should adopt at the protocol level.

**LangChain and LlamaIndex integration** follows the "tool output as artifact" pattern. LangChain's `@tool(response_format="content_and_artifact")` decorator separates conversational content from structured UI data, enabling clean integration with A2UI streams.

### Priority 2: Streaming and state patterns

**Optimistic updates** are now first-class in React 19 via `useOptimistic`:

```typescript
const [optimisticMessages, addOptimisticMessage] = useOptimistic(
  messages,
  (state, newMessage) => [
    { text: newMessage, sending: true },
    ...state,
  ]
);
```

For A2UI, this enables rendering user intent immediately while streaming the AI response. TanStack Query's rollback pattern (snapshot previous state, optimistically update, restore on error) provides a robust model for handling stream failures.

**Partial streaming** achieves progressive rendering through Vercel's `streamObject` and data part reconciliation. The critical insight: **parts with matching IDs update rather than append**. This enables smooth transitions from loading skeleton → partial data → complete component without re-mounting:

```typescript
// Initial loading state
writer.write({ type: 'data-weather', id: 'weather-1', data: { status: 'loading' } });
// Later updates the same component
writer.write({ type: 'data-weather', id: 'weather-1', data: { status: 'success', temp: 72 } });
```

**React Suspense integration** works best with nested boundaries for progressive loading: shell loads immediately, then secondary content streams in via deferred promises. React 19's `use()` hook simplifies consuming streamed promises within Suspense boundaries.

**Backpressure handling** requires attention at both server and client. Node.js streams with `highWaterMark` control server-side buffering, while client-side token batching (5-10 tokens per batch, 50ms max delay) prevents UI thread overwhelm. The recommended pattern batches updates using `startTransition` for low-priority visual changes.

**Offline support** combines IndexedDB caching (via Dexie) with Service Worker interception. For streaming responses, chunk-by-chunk caching enables partial replay of interrupted streams—critical for mobile scenarios.

### Priority 3: Competitive analysis

**OpenAI vs Anthropic structured outputs** have converged on similar capabilities:

| Capability            | OpenAI                            | Anthropic                           |
| --------------------- | --------------------------------- | ----------------------------------- |
| Schema guarantee      | 100% (strict mode)                | 100% (constrained decoding)         |
| Implementation        | `response_format` + `json_schema` | `output_format` + `json_schema`     |
| Streaming             | Native with partial JSON          | Fine-grained beta available         |
| SDK pattern           | Pydantic/Zod transformation       | Pydantic/Zod transformation         |
| Recursive schemas     | Via `$ref` (limited depth)        | Not supported                       |
| First-request latency | Schema caching (1+ hour)          | Grammar compilation (24 hour cache) |

Both require `additionalProperties: false` and explicit `required` arrays. The key difference: Anthropic's fine-grained tool streaming beta provides lower latency for large parameter blocks, while OpenAI's GPT Actions ecosystem offers more mature integration patterns.

**Vercel AI SDK 6** represents the production-ready approach to streaming UI. The SDK has **paused RSC/`createStreamableUI` development** in favor of typed data streaming via `createUIMessageStream`. Key patterns worth adopting:

- **Typed data parts** with custom `data-*` prefixes for domain-specific components
- **Transient flags** distinguishing ephemeral status from persisted message history
- **Multi-step boundaries** via `start-step`/`finish-step` markers for agent loops
- **Source attribution** for RAG citations built into the stream protocol

**Structured generation libraries** provide inference-layer guarantees unavailable from API-only approaches:

| Library                    | Approach                      | Best for                        |
| -------------------------- | ----------------------------- | ------------------------------- |
| **Instructor** (11k stars) | Pydantic client patch         | Cloud APIs, quick integration   |
| **Outlines** (12.9k stars) | FSA/grammar constraints       | Local models, guaranteed format |
| **Guidance** (21k stars)   | Template-based logit steering | Complex multi-step generation   |
| **Marvin** (4k stars)      | High-level extraction API     | Rapid prototyping               |

Outlines' grammar-based approach achieves **100% schema compliance** at ~40μs/token overhead—relevant for A2UI deployments using local models. Instructor's auto-retry pattern (configurable `max_retries`) is the recommended approach for cloud API integrations.

**Design-to-code tools** (Builder.io, Locofy, Anima) demonstrate the power of multi-stage AI pipelines. Builder.io's approach—Figma design → Mitosis compiler → LLM refinement—shows how A2UI could bridge design systems to AI-generated components. Figma's Dev Mode MCP Server enables AI coding assistants to access design context directly.

---

## Implementation priority matrix

### High priority (weeks 1-4)

| Feature                   | Rationale                                                        | Effort |
| ------------------------- | ---------------------------------------------------------------- | ------ |
| ID-based reconciliation   | Core UX improvement, enables progressive updates                 | Medium |
| Strict schema enforcement | Both major providers now support, eliminates validation failures | Low    |
| DOMPurify integration     | Security-critical, treat all AI output as untrusted              | Low    |
| ARIA live regions         | Accessibility requirement for streaming content                  | Low    |
| Instructor-style retries  | Handles edge cases in schema generation                          | Medium |

### Medium priority (weeks 5-8)

| Feature                   | Rationale                                       | Effort |
| ------------------------- | ----------------------------------------------- | ------ |
| Transient data parts      | Clean separation of loading states from history | Medium |
| Part type standardization | Protocol maturity, interoperability             | Medium |
| Virtualization (TanStack) | Performance for long conversations              | Medium |
| Token batching            | Prevent UI thread overwhelm during fast streams | Low    |
| react-shiki integration   | High-value streaming code highlighting          | Low    |

### Lower priority (weeks 9-12)

| Feature               | Rationale                                     | Effort |
| --------------------- | --------------------------------------------- | ------ |
| SSE format migration  | Standardization benefits, but breaking change | High   |
| Offline caching       | Mobile-first scenarios only                   | High   |
| Design token mapping  | Enterprise theming requirements               | Medium |
| Multi-step boundaries | Agent loop support                            | Medium |
| Source attribution    | RAG integration                               | Low    |

---

## Code examples

### A2UI v2 component registration with Zod

```typescript
import { z } from 'zod';

// Component schema with AI-readable descriptions
const ButtonSchema = z.object({
  label: z.string().describe("Button text, e.g., 'Submit', 'Cancel'"),
  variant: z.enum(["primary", "secondary", "danger"])
    .describe("Visual style: primary for main actions, secondary for alternatives"),
  disabled: z.boolean().optional().describe("Prevents interaction when true"),
  onClick: z.object({
    action: z.string().describe("Action identifier, e.g., 'submit_form'"),
    payload: z.record(z.unknown()).optional()
  }).optional()
});

// Registry with semantic descriptions
const A2UIRegistry = {
  Button: {
    schema: ButtonSchema,
    description: "Clickable action trigger. Use for form submissions, navigation, or triggering operations.",
    examples: [
      { label: "Submit", variant: "primary" },
      { label: "Cancel", variant: "secondary" }
    ]
  },
  // ... other components
};

// Generate JSON Schema for LLM consumption
const jsonSchema = z.toJSONSchema(ButtonSchema, { target: "openAi" });
```

### Progressive streaming with reconciliation

```typescript
import { createUIMessageStream } from '@ai-sdk/ui-utils';

type A2UIMessage = {
  weather: { city: string; status: 'loading' | 'success'; temp?: number };
  chart: { data: number[]; status: 'loading' | 'success' };
};

const stream = createUIMessageStream<A2UIMessage>({
  execute: async ({ writer }) => {
    // Initial loading states (transient)
    writer.write({
      type: 'data-weather',
      id: 'weather-sf',
      data: { city: 'San Francisco', status: 'loading' },
      transient: true
    });

    const weather = await fetchWeather('San Francisco');
    
    // Update same ID with complete data (persistent)
    writer.write({
      type: 'data-weather',
      id: 'weather-sf',
      data: { city: 'San Francisco', status: 'success', temp: weather.temp }
    });
  }
});
```

### Schema validation with retry logic

```typescript
import { safeParse } from 'zod';
import { repair } from 'json-repair';

async function parseA2UIResponse(
  rawResponse: string,
  schema: z.ZodSchema,
  maxRetries = 3
): Promise<z.infer<typeof schema>> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Step 1: Try direct parse
      const json = JSON.parse(rawResponse);
      const result = schema.safeParse(json);
      if (result.success) return result.data;
      lastError = new Error(result.error.message);
    } catch (parseError) {
      // Step 2: Attempt JSON repair
      try {
        const repaired = repair(rawResponse);
        const json = JSON.parse(repaired);
        const result = schema.safeParse(json);
        if (result.success) return result.data;
        lastError = new Error(result.error.message);
      } catch {
        lastError = parseError as Error;
      }
    }
    
    // Step 3: Request retry from LLM with error context
    if (attempt < maxRetries - 1) {
      rawResponse = await requestRetry(rawResponse, lastError.message);
    }
  }
  
  throw lastError;
}
```

### Accessible streaming with ARIA live regions

```tsx
function StreamingMessage({ content, status }: { content: string; status: string }) {
  return (
    <div>
      {/* Visually rendered content */}
      <div className="message-content">{content}</div>
      
      {/* Screen reader announcements - must exist before content updates */}
      <div 
        aria-live="polite" 
        aria-atomic="false"
        aria-relevant="additions"
        className="sr-only"
      >
        {status === 'streaming' && content}
        {status === 'complete' && 'Response complete'}
      </div>
    </div>
  );
}
```

---

## Competitive analysis table

| Feature            | A2UI (Current)   | Vercel AI SDK 6     | Tambo AI              | OpenAI GPTs        | Anthropic           |
| ------------------ | ---------------- | ------------------- | --------------------- | ------------------ | ------------------- |
| **Format**         | NDJSON           | SSE typed parts     | NDJSON                | Structured outputs | Structured outputs  |
| **Components**     | 12 built-in      | Bring your own      | Registry-based        | None (text/files)  | None (tool outputs) |
| **Schema**         | Zod              | Zod/Pydantic        | Zod                   | JSON Schema        | JSON Schema         |
| **Streaming**      | FSM-based        | Part reconciliation | Progressive props     | Partial JSON       | Delta streaming     |
| **Validation**     | Client-side      | Client-side         | Client + retries      | Server-guaranteed  | Server-guaranteed   |
| **Bi-directional** | Actions          | Server Actions      | Tools + interactables | Function calls     | Tool use            |
| **State**          | Provider context | AI/UI state split   | Thread state          | Conversation       | Messages            |
| **Offline**        | Not built-in     | Not built-in        | Not built-in          | N/A                | N/A                 |
| **Accessibility**  | Manual           | Manual              | Manual                | N/A                | N/A                 |

---

## Proposed A2UI v2 extensions

### 1. Schema versioning

```typescript
interface A2UIEnvelope {
  version: "2.0";
  timestamp: number;
  message: A2UIMessage;
}
```

### 2. Standardized part types

```typescript
type A2UIPart =
  | { type: 'text'; id: string; content: string }
  | { type: 'component'; id: string; name: string; props: Record<string, unknown> }
  | { type: 'tool-call'; id: string; name: string; input: unknown; status: 'pending' | 'running' | 'complete' | 'error'; output?: unknown }
  | { type: 'source'; id: string; sourceType: 'url' | 'document'; title: string; url?: string }
  | { type: 'file'; id: string; url: string; mediaType: string; filename?: string }
  | { type: 'error'; id: string; code: string; message: string };
```

### 3. Reconciliation support

```typescript
interface A2UIStreamOptions {
  // Parts with same ID update instead of append
  reconcile: boolean;
  // Transient parts excluded from message history
  transient?: boolean;
}
```

### 4. Resource limits schema

```typescript
const A2UILimits = z.object({
  maxComponents: z.number().default(100),
  maxNestingDepth: z.number().default(10),
  maxPayloadBytes: z.number().default(102400),
  maxStringLength: z.number().default(10000),
  maxArrayItems: z.number().default(1000),
});
```

### 5. Plugin architecture

```typescript
interface A2UIPlugin {
  name: string;
  components?: Record<string, A2UIComponentDefinition>;
  middleware?: (part: A2UIPart, next: () => void) => void;
  validators?: Record<string, z.ZodSchema>;
}

// Usage
const chartPlugin: A2UIPlugin = {
  name: '@a2ui/charts',
  components: {
    LineChart: { schema: LineChartSchema, component: LineChart },
    BarChart: { schema: BarChartSchema, component: BarChart },
  }
};
```

---

## Library recommendations

### Core dependencies

| Package                   | Purpose                 | Size  |
| ------------------------- | ----------------------- | ----- |
| `zod`                     | Schema validation       | ~3KB  |
| `best-effort-json-parser` | Partial JSON parsing    | ~2KB  |
| `json-repair`             | Malformed JSON recovery | ~5KB  |
| `dompurify`               | XSS prevention          | ~15KB |
| `zustand`                 | FSM state management    | ~3KB  |
| `jotai`                   | Fine-grained UI state   | ~3KB  |

### Streaming and UI

| Package                         | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `ai` (Vercel)                   | Reference implementation for streaming patterns |
| `@tanstack/react-virtual`       | Virtualization for long conversations           |
| `react-shiki`                   | Streaming code syntax highlighting              |
| `react-markdown` + `remark-gfm` | Markdown rendering                              |
| `react-error-boundary`          | Streaming error handling                        |

### Structured generation (server-side)

| Package      | Use case                            |
| ------------ | ----------------------------------- |
| `instructor` | Cloud API integration with retries  |
| `outlines`   | Local models with guaranteed format |
| `guidance`   | Complex multi-step generation       |

---

## Research links

### Primary documentation
- **Tambo AI**: https://docs.tambo.co, https://github.com/tambo-ai/tambo
- **Vercel AI SDK**: https://ai-sdk.dev/docs, https://github.com/vercel/ai
- **OpenAI Structured Outputs**: https://platform.openai.com/docs/guides/structured-outputs
- **Anthropic Structured Outputs**: https://docs.anthropic.com/en/docs/build-with-claude/structured-outputs

### Structured generation
- **Instructor**: https://github.com/jxnl/instructor (11k stars)
- **Outlines**: https://github.com/dottxt-ai/outlines (12.9k stars)
- **Guidance**: https://github.com/guidance-ai/guidance (21k stars)
- **Awesome LLM JSON**: https://github.com/imaurer/awesome-llm-json

### Design and tooling
- **Figma Dev Mode MCP**: https://www.figma.com/plugin-docs/codegen-plugins/
- **Builder.io Visual Copilot**: https://www.builder.io
- **Style Dictionary**: https://amzn.github.io/style-dictionary/

### Streaming patterns
- **React Suspense Architecture**: https://github.com/reactwg/react-18/discussions/37
- **Node.js Backpressure**: https://nodejs.org/en/learn/modules/backpressuring-in-streams
- **Vercel Stream Protocol**: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol

### Security and accessibility
- **DOMPurify**: https://github.com/cure53/DOMPurify
- **OWASP XSS Prevention**: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- **ARIA Live Regions**: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions

---

## Answers to specific research questions

**1. What features should A2UI v2 include?**

Schema versioning with envelope format, plugin architecture for extensibility, ID-based reconciliation, transient/persistent part distinction, standardized part types (text, component, tool-call, source, file, error), resource limits, and Instructor-style retry middleware.

**2. How would A2UI work for multi-user real-time collaboration?**

Adopt CRDT-based state synchronization (consider Yjs or Automerge) with component-level conflict resolution. Each user session maintains local optimistic state; server reconciles via operational transforms. Stream protocol would add `userId` and `sequenceNumber` to each part for ordering.

**3. What are the best practices for AI function/tool calling that generates UI?**

Use `strict: true` mode for guaranteed schema compliance, separate content from artifacts (LangChain pattern), implement max_retries at integration layer, support human-in-the-loop approval for sensitive actions, and stream tool inputs progressively for responsive UX.

**4. What JSON schema patterns work best for LLM structured output representing UI?**

Keep nesting under 5 levels (OpenAI limit), use enums for component types, require `additionalProperties: false`, make all fields required (use nullable for optional), leverage `$ref`/`$defs` for recursive UI trees, and include descriptions for every property to guide LLM selection.

---

## Conclusion

A2UI's current architecture aligns well with industry direction—the declarative JSON approach is validated by Tambo, Vercel, and the structured generation ecosystem. The path to production requires four key additions: **ID-based reconciliation** for smooth progressive rendering, **strict mode integration** with major LLM providers, **security hardening** via DOMPurify and resource limits, and **accessibility compliance** through ARIA live regions.

The research reveals a maturing ecosystem where schema-enforced generation has moved from experimental to production-ready. Outlines and Guidance offer **100% format guarantees** at the inference layer, while OpenAI and Anthropic now provide **server-side schema enforcement**. A2UI v2 should embrace this reliability while adding the progressive rendering and reconciliation patterns that Vercel has validated.

The 3-6 month production path: implement high-priority features (weeks 1-4), integrate with one structured generation library for reliability (Instructor recommended), build comprehensive test coverage including streaming edge cases, and deploy with feature flags for gradual rollout.

---

Advancing A2UI: A Comprehensive Architectural Roadmap for Real-Time Generative UI Systems1. Executive SummaryThe transition from static, imperative user interfaces to dynamic, intent-driven generative systems represents a paradigm shift in software engineering comparable to the move from server-side rendering to single-page applications. The "A2UI" (AI-to-UI) protocol sits at the epicenter of this transformation, tasked with the complex orchestration of bridging the deterministic world of React rendering with the probabilistic, often non-deterministic output of Large Language Models (LLMs). While the initial implementation of A2UI established a functional baseline using Newline Delimited JSON (NDJSON) streaming and a core set of twelve components, the subsequent phase of development—A2UI v2—must address profound challenges related to scale, interactivity, and enterprise-grade reliability. The current Finite State Machine (FSM) model—traversing states of idle, preparing, streaming, and complete—while functionally sound for basic chat interactions, is increasingly insufficient for complex, multi-step agentic workflows that require optimistic state management, partial hydration of deep component trees, and real-time multi-user collaboration.This research report provides an exhaustive, expert-level analysis of the technical requirements, architectural patterns, and strategic implementations necessary to elevate A2UI into a robust, production-ready protocol. The analysis synthesizes data from over 700 technical sources, ranging from Vercel’s AI SDK architecture and OpenAI’s GPT Action patterns to Google’s GenUI methodologies and emerging standards in Conflict-free Replicated Data Types (CRDTs). The findings indicate a critical need to move beyond simple text streaming toward a structured, multiplexed event stream that supports out-of-band data, including annotations and reasoning traces, alongside UI component chunks. This evolution allows for "shadow updates" where the AI can refine properties without triggering destructive full re-renders.1Furthermore, the research strongly advocates for a rejection of raw HTML/JS string generation in favor of a strict, Zod-schema-backed registry. Insights from Google’s GenUI and Tambo AI demonstrate that constraining the LLM to a "UI Kit" via rigid tool definitions significantly reduces hallucinations and visual regression, ensuring strict adherence to Design Systems.3 This shift requires treating system prompts and component schemas not as mere configuration, but as versioned code artifacts subject to strict semantic versioning to prevent "prompt drift," where model updates inadvertently break UI rendering.6The roadmap explicitly prioritizes the integration of useOptimistic patterns to bridge the inherent latency of LLM inference, often referred to as Time to First Token (TTFT). By enabling the UI to assume success states based on user prompts before server confirmation, the system can mask latency and provide a snappy, app-like experience.8 Additionally, to support the growing demand for collaborative intelligence, the A2UI state must transition from ephemeral to durable and mergeable. Integrating CRDTs like Y.js will allow multiple agents—both human and synthetic—to manipulate the same UI context simultaneously, a pattern emerging in platforms like Liveblocks.10This report is structured to serve as a definitive guide for the engineering team over the next 3-6 months. It dissects these recommendations across eight core research objectives, providing specific library recommendations, code patterns, and security protocols to ensure the successful delivery of A2UI v2.2. Category Analysis: Protocol & Architecture2.1 The Streaming Protocol: Beyond Basic NDJSONThe current implementation of A2UI relies on Newline Delimited JSON (NDJSON) to stream responses from the AI to the UI. While NDJSON is efficient for simple text completion, analyzing the trajectory of advanced frameworks like Vercel's AI SDK reveals that a monolithic JSON stream is insufficient for the complex orchestration required by generative interfaces. The Vercel AI SDK has pioneered a pattern of "stream parts," where different types of data—text deltas, tool calls, reasoning traces, and custom data payloads—are multiplexed into a single transport stream.1 This multiplexing is critical because it decouples the rendering of the UI from the generation of the content.In a monolithic stream, if the LLM halts generation to perform a tool call (e.g., fetching weather data), the UI stream typically freezes. In a multiplexed architecture, the server can emit a tool_call_start event, allowing the client to render a "Thinking" skeleton or a specific tool UI, while keeping the connection alive. A2UI v2 should adopt a Multiplexed Event Stream protocol. Instead of a single JSON object that grows over time, the stream should emit discrete, typed events.The proposed protocol structure includes specific event types such as text_delta for conversational text, ui_component_start to identify the component type (e.g., <Card>), and ui_prop_delta for incremental updates to specific properties. This granularity solves the "Partial Parsing" problem. By isolating property updates, the system can utilize a specialized parser—such as partial-json-parser or custom logic derived from the Vercel AI SDK internals—to render a component while its internal data is still being generated.12 For instance, a Chart component can render its axes and title immediately upon receiving the type and title props, even before the dataset array is fully populated. This perceived performance improvement is significant, as the user sees the structure of the answer forming instantly.Furthermore, the protocol must support Out-of-Band (OOB) Data. Complex generative UIs often require data that is not directly rendered but controls behavior—for example, a transaction_id for a payment form or a confidence_score for a generated insight. In the current NDJSON model, this metadata is often awkwardly stuffed into the component props, polluting the DOM. A multiplexed stream allows for a data_annotation event type, which carries this metadata separately, updating a hidden state store (like a React Context or Zustand store) without forcing a visual re-render of the component tree.12.2 Raw HTML vs. Declarative Component RegistryA fundamental architectural divergence in Generative UI is the decision between allowing the LLM to generate raw HTML/JavaScript strings (the "Artifacts" or "v0" model) versus restricting it to a pre-defined set of React components (the "GenUI" or "Tambo" model).Research into Google’s GenUI and Tambo AI strongly suggests that the Declarative Component Registry pattern is superior for enterprise applications where brand consistency, security, and maintainability are paramount.3 Generating raw HTML via dangerouslySetInnerHTML introduces severe security risks, primarily Cross-Site Scripting (XSS), where a hallucinating model might inject malicious scripts.14 More importantly, raw HTML generation breaks the "single source of truth" provided by a Design System. If the LLM generates a button with hardcoded Tailwind classes, that button will not automatically update when the Design System's primary button style changes.The recommended approach for A2UI v2 is the Declarative Component Registry. In this pattern, the client application maintains a map of Component Name -> { Implementation, Zod Schema }. The Zod schemas are converted to JSON Schema and injected into the LLM's system prompt or tool definitions.16 When the LLM determines a UI element is needed, it "calls" the component as if it were a tool function, returning a structured JSON object of props. The client interceptor then validates this JSON against the Zod schema before rendering.This mechanism acts as a runtime type-checker for the AI. If the LLM attempts to invent a property—for example, passing backgroundColor="neon-green" to a component that only accepts semantic tokens like primary or muted—the Zod validation layer intercepts the error. The system can then either sanitize the input (falling back to a default) or trigger a "correction" loop where the error is fed back to the LLM to regenerate a valid response. This ensures that the UI remains strictly compliant with the design system, regardless of the model's creative deviations.2.3 Schema Versioning and EvolutionAs the application grows, the Design System will inevitably evolve. A component that accepted a simple string for a title in v1 might require a complex object with text and icon in v2. This introduces the problem of Prompt Drift: a model trained or prompted on v1 component definitions might hallucinate or fail when presented with v2 schemas.To mitigate this, A2UI v2 must implement Semantic Prompt Versioning.6 System prompts and component schemas should be treated as versioned code artifacts. Once a system prompt version is locked (e.g., v1.2.0), it should generally be immutable. New component features should trigger a new prompt version (v1.3.0).This versioning strategy extends to data persistence. If the application stores historical A2UI messages in a database, a conversation from six months ago might contain JSON payloads structured for v1 components. If the frontend code has updated to v2 components, attempting to render that history will crash the application. Therefore, the architecture must include a Runtime Transformer Layer.19 This layer sits between the database fetch and the UI rendering, detecting legacy message versions and mapping old props to the new component structures on the fly. This ensures backward compatibility and prevents the corruption of valuable user chat history.3. Component Ecosystem & Advanced Rendering3.1 Data Visualization: The Reliability ChallengeData visualization represents one of the highest-value yet most fragile aspects of Generative UI. Large Language Models are generally proficient at generating semantic data (e.g., "Sales for Q1: $100k") but notoriously poor at calculating precise layout coordinates (e.g., "Draw a path 'M10 10 L50 50'"). Therefore, the A2UI protocol must explicitly forbid the AI from generating visual primitives like SVG path data or canvas instructions.The recommendation is to utilize Recharts or Visx over canvas-based libraries like Nivo.21 Recharts is favored for its composable, declarative API which aligns perfectly with the component registry pattern. The AI should output a high-level configuration object—{ type: "bar", keys: ["revenue", "cost"], data: [...] }—rather than low-level rendering instructions. The client-side wrapper then maps this configuration to the specific Recharts implementation, automatically applying design system colors, tooltips, and axes.This abstraction layer allows the "AI Developer" to focus on what data to show, while the "Client Runtime" controls how it looks, ensuring visual consistency and accessibility compliance. Visx is a strong alternative if highly custom visualizations are required, but its lower-level API requires more complex prompt engineering to ensure the model configures it correctly. Nivo, while beautiful, relies heavily on a monolithic configuration object which can be token-expensive and harder to partially stream.3.2 Complex Forms: The Multi-Step WizardGenerating complex, multi-step forms (wizards) is a common requirement for agentic workflows, such as onboarding users or configuring complex settings. The "Formity" pattern offers a compelling architectural model for this.23 Instead of asking the AI to generate a single, massive form schema, the AI should generate a State Machine Definition for the form flow.This definition includes Nodes (individual steps like "Personal Info", "Payment"), Edges (conditional logic such as "If age < 18, skip Payment"), and Validation (Zod schemas for each step). This decoupling allows the UI to handle navigation logic client-side, ensuring instant transitions between steps without round-tripping to the server. The AI acts as the "architect" defining the flow structure, while the client runtime executes the wizard. This approach supports complex branching logic and conditional rendering that would be fragile if managed purely through server-side stream updates.3.3 Rich Content: Markdown & LaTeXFor applications in scientific, financial, or technical domains, standard text blocks are often insufficient. The integration of Markdown and LaTeX support is mandatory. The standard pattern involves integrating react-markdown with remark-math and rehype-katex plugins.24However, streaming mixed content introduces the "Broken Token" challenge. A partial LaTeX string, such as $\sqrt{, arriving at the end of a chunk will likely cause the renderer to crash or display broken syntax. To solve this, A2UI v2 must implement a Safe Render Boundary. This logic buffers incoming tokens and only passes them to the markdown parser when a complete, valid syntax block is detected. If the parser throws an error on the last chunk, the system falls back to rendering the raw text of that chunk until the closing delimiter (e.g., }$) arrives, ensuring the UI never crashes due to incomplete mathematical expressions.4. Streaming & State Management4.1 Optimistic Updates & The "Phantom" StateIn a conversational interface, latency is the enemy of engagement. Waiting 2-3 seconds for an LLM to acknowledge a user action, such as clicking "Add to Cart" or "Schedule Meeting," feels sluggish and breaks the illusion of intelligence. To counter this, A2UI v2 must implement aggressive Optimistic UI patterns.8The proposed protocol extension involves a "Phantom State" mechanism. When a user triggers an action via a UI component, the client immediately generates a temporary transaction ID and updates the local A2UI state to reflect the success of that action—for example, showing a "Booking Confirmed" card. This update happens synchronously, creating an immediate feedback loop. Simultaneously, the action is sent to the server for processing.When the server eventually streams the authoritative response, the client performs a Reconciliation. It matches the server response to the temporary transaction ID and replaces the phantom state with the verified server state. If the server returns an error, the phantom state is rolled back, and a toast notification informs the user of the failure, offering a "Retry" option. This pattern, widely used in standard web development, is critical for AI interfaces where backend latency is variable and often high.4.2 Offline Support: IndexedDB & CRDTsObjective 2 of the research mandate highlights the need for offline support. In an AI-driven application, this is challenging because the "brain" (the LLM) is typically server-side. However, the context—the conversation history, the state of the widgets, and the user's data—must be accessible and mutable even without a network connection.Local storage solutions like localStorage are insufficient due to size limits (typically 5MB) and synchronous blocking behavior. IndexedDB is the only browser storage capable of handling the volume of vector data, large conversation histories, and complex component trees required by A2UI.26For synchronization, the research points towards CRDTs (Conflict-free Replicated Data Types), specifically libraries like Y.js or Automerge. By backing the A2UI state with a CRDT, users can interact with widgets (e.g., checking items off a list, editing a draft) while offline. When connectivity is restored, these changes merge seamlessly with the server state. This avoids the "last write wins" data loss common in simpler synchronization strategies and enables the multi-user collaboration features discussed in Section 8.115. AI-Assisted UI & Context Engineering5.1 Component Discovery & Prop InferenceThe "Context Window" of an LLM is a scarce and expensive resource. Dumping the documentation for an entire Design System (which could contain hundreds of components) into the system prompt is inefficient and degrades model performance. The solution is a Retrieval-Augmented Generation (RAG) pipeline specifically for UI components.The strategy involves creating vector embeddings for every component in the library, indexing their semantic descriptions ("Use this for showing trends over time") and usage examples. When a user prompt arrives (e.g., "Show me sales data for the last quarter"), the system performs a semantic search to retrieve the most relevant component definitions—in this case, BarChart, Table, and KPICard.The system then Dynamically Injects only the Zod schemas of those relevant components into the context window for that specific turn of the conversation.28 This "Just-in-Time" context injection keeps the prompt lean, reduces token costs, and minimizes the chance of the model hallucinating by restricting its "tool belt" to only what is necessary for the current task.5.2 Design Tokens as First-Class CitizensTo ensure the AI respects the brand identity, Design Tokens (colors, spacing, typography) must be treated as first-class citizens in the prompting strategy. It is not enough to simply ask for "a blue button." The AI must understand which blue.The research recommends injecting design tokens as "constants" in the system prompt. For example:"You are a UI generator. You MUST use the following tokens: Primary Color: 'var(--color-brand-500)', Spacing: multiples of 4px (e.g., 'p-4', 'm-8'), Corner Radius: 'rounded-lg'. Do not use arbitrary hex codes."This instruction maps the AI's output directly to the CSS variables defined in the Design System. This ensures that features like Theming (Light/Dark mode) work automatically because the AI is outputting semantic variable references rather than hardcoded color values.30 This aligns the generative output with the existing, hand-coded parts of the application.6. Accessibility & Internationalization (i18n)6.1 WCAG & The "Talking" InterfaceStreaming interfaces present a unique challenge for accessibility, particularly for screen reader users. As content appears incrementally, standard announcements can become noisy or confusing. The A2UI implementation must use Live Regions judiciously. The container for streaming text should be marked with aria-live="polite". This setting ensures that the screen reader announces updates when the user is idle, rather than interrupting their current focus or navigation.32Furthermore, Debouncing DOM updates is critical. Updating the DOM on every single character token (which might happen every 20-50ms) can crash or overwhelm assistive technology. The text renderer should buffer tokens and update the DOM at a slower cadence (e.g., every 100-200ms) or at natural word boundaries to ensure a stable and readable experience for accessibility tools.6.2 Internationalization (i18n)Hardcoding English strings in the AI output is a major technical debt. A2UI v2 should enforce a pattern where the AI generates Translation Keys instead of raw text. For example, instead of generating { title: "Revenue" }, the AI should generate { title: "dashboard.revenue_title" }.The client application then resolves these keys using the existing i18n framework (like react-i18next). To handle cases where the AI needs to generate dynamic text that doesn't exist in the translation files, the protocol should support a fallback structure: { title: { key: "dynamic_text", default: "Specific Analysis of Q3" } }. This allows the UI to display the generated text while logging the "missing translation" for future localization efforts.7. Performance Optimization7.1 Virtualization & Bundle ImpactWhile the initial set of twelve components is manageable, a mature system with 50+ components will significantly bloat the initial JavaScript bundle. To mitigate this, the A2UIProvider must support Lazy Loading (Code Splitting). Components should only be loaded when the LLM requests them. If the stream includes a <MapWidget>, the client should dynamically fetch that component's chunk at that moment.For the chat interface itself, specifically long conversation histories containing complex generative UIs, Virtualization is mandatory. react-virtuoso is the recommended library over react-window because it handles items with dynamic heights—common in chat interfaces where message length varies wildly—much more gracefully. It prevents the "scroll jumping" behavior often seen when images or charts load within a chat stream.348. Security Considerations8.1 Input Sanitization & Content Security Policy (CSP)Even with a declarative registry, prompt injection attacks remain a threat. A malicious user could trick the model into generating a component with dangerous properties, such as a link with href="javascript:alert(1)".Zod schemas must use Refinement (.refine()) to enforce strict validations. For example, URL props should be validated to ensure they start with https:// or a trusted internal protocol like app://.Furthermore, if the application renders any user-generated HTML (such as in Markdown previews within a chat bubble), this rendering must occur inside a Sandboxed Iframe or Shadow DOM with a strict Content Security Policy (CSP). The CSP should explicitly disallow script execution (script-src 'none') and restrict where resources can be loaded from (frame-src and img-src), neutralizing the impact of any potential XSS payload injected via the LLM.369. Developer Experience (DX)To accelerate the adoption of A2UI v2, the "black box" nature of AI generation must be made transparent to developers. The roadmap includes the development of two key DX tools:Visual Stream Debugger: A browser extension or a dedicated DevTools panel that visualizes the incoming NDJSON/Multiplexed stream in real-time. This tool would highlight chunk boundaries, identify JSON parse errors, and show the delta updates as they are applied to the component tree.38Schema Playground: An auto-generated interface (similar to Swagger/OpenAPI UI) where developers can test their Zod component schemas against the LLM. This allows them to verify if the model correctly "understands" the component's instructions and descriptions before deploying them to production.10. Specific Implementation Priority (Next 3-6 Months)High Priority (Months 1-2): FoundationMigrate to Multiplexed Streaming: Abandon simple NDJSON for a tagged event stream (Text + UI + Data). This is the prerequisite for all advanced features.Implement Zod-to-Schema Pipeline: Automate the generation of OpenAI function definitions from your existing component props to ensure the LLM and Client are always in sync.Optimistic State Machine: Build the client-side hooks to handle pending -> success states for actions to fix the latency perception issue.Medium Priority (Months 3-4): Scale & ContextRAG for Components: Implement the vector retrieval system for handling large component libraries without blowing up the context window.Virtualization: Integrate react-virtuoso for the main chat interface to ensure performance stability as conversation length grows.Visual Debugger: Build a basic stream inspector to aid the engineering team in debugging the new protocol.Low Priority (Months 5-6): Advanced InteractionMulti-user Collaboration: Implementing CRDTs / Y.js. This is complex and requires significant backend changes, so it should be tackled after the single-player experience is robust.Advanced Animations: framer-motion integration for generative layouts to add polish and delight.11. Code Examples11.1 The Multiplexed Stream Parser (Pseudocode)TypeScript// A2UI Stream Parser - Handling Multiplexed Events
async function parseA2UIStream(reader: ReadableStreamDefaultReader) {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() |

| ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const event = JSON.parse(line);
      
      switch (event.type) {
        case 'text_delta':
          // Append text to the current text block
          updateCurrentTextBlock(event.content);
          break;
          
        case 'component_start':
          // Initialize a new component placeholder
          // event.id is crucial for identifying this specific instance
          initComponent(event.id, event.componentName);
          break;
          
        case 'prop_delta':
          // Merge partial JSON into the component's props
          // Using a partial JSON parser here is key
          const currentProps = getComponentProps(event.id);
          const newProps = partialJsonParse(event.delta); 
          updateComponent(event.id, deepMerge(currentProps, newProps));
          break;
          
        case 'component_end':
          // Mark component as complete - enables interactivity
          finalizeComponent(event.id);
          break;
      }
    }
  }
}
11.2 Zod Schema with AI DescriptionsTypeScript// Component Definition with AI Hints
import { z } from 'zod';

export const KPICardSchema = z.object({
  title: z.string().describe("The label of the metric, e.g., 'Total Revenue'"),
  value: z.string().describe("The formatted value, e.g., '$1.2M'"),
  trend: z.enum(['up', 'down', 'neutral']).describe("Direction of the trend arrow"),
  trendValue: z.string().optional().describe("The percentage change, e.g., '+12%'"),
  color: z.enum(['primary', 'secondary', 'danger', 'success'])
   .describe("Semantic color mapping. Use 'success' for positive financial trends.")
});

// This schema is then automatically transpiled to the JSON format LLMs expect
12. ConclusionA2UI v2 represents more than a mere iterative upgrade; it marks the transition to a Managed Generative Runtime. By formalizing the contract between the probabilistic reasoning of AI and the deterministic rendering of React, we can construct interfaces that possess the dynamic flexibility of conversation while retaining the reliability and polish of a hand-coded application. The recommended path forward—characterized by rigid schema enforcement, intelligent multiplexed streaming, and a "design-first" context injection strategy—positions the platform to lead in the emerging and transformative field of Generative UI. This roadmap provides a clear, actionable path to realizing that potential over the coming quarters.

Advancing A2UI Realtime UI Generation
Executive Summary

Examples of AI-generated UI cards using A2UI, ranging from flight status and task lists to user profiles and e-commerce. These dynamic interfaces are composed by an AI from a predefined component catalog, then rendered with native styling on the client. They illustrate the potential of generative UI to tailor layouts to each context while maintaining design consistency.

A2UI v2 should significantly expand capabilities in component variety, streaming interactivity, and developer tooling. We recommend adding advanced UI components (charts, maps, rich media, multi-step forms, navigation elements) to cover more use cases. The streaming protocol can be enhanced with partial rendering (displaying intermediate results as they stream in) and optimistic updates (updating the UI immediately on user actions before server confirmation). An AI-assisted UX is key – by providing semantic component descriptions and examples, the LLM can better choose which UI elements to use and infer sensible properties. Robust error handling is needed so if the model produces invalid UI JSON, the system can correct or fall back gracefully. Accessibility should be baked in (ARIA labels, screen reader support for live updates) and interfaces should adapt to i18n (internationalization) needs and user preferences (e.g. dark mode, reduced motion). Performance optimizations like list virtualization and image lazy-loading will ensure UIs remain snappy even with large or complex data. A2UI v2 should align with design system tokens so generated UIs match the brand’s typography, spacing, and themes out-of-the-box. Developer experience can be improved with debugging tools (like a live JSON stream viewer and component preview sandbox) and clear documentation (perhaps auto-generating schema docs from Zod definitions). Security remains paramount: the protocol must enforce that only known-safe components render (to avoid XSS), apply resource limits (preventing overly large UIs or deep nesting), and possibly integrate content security policy for any web views. Finally, as AI-driven UIs become more collaborative and real-time, A2UI should consider multi-user session support – allowing an agent to generate an interface that multiple users can interact with simultaneously, with state changes synchronized across clients. In summary, A2UI v2 should evolve into a more extensible, robust framework that not only matches the emerging standards (OpenAI’s Open-JSON-UI, Microsoft’s MCP-UI, etc.) but leads in features like streaming updates, rich component support, and safety. Below we dive into each area, then compare approaches and propose concrete next steps.

Category Analysis
Advanced Components

A2UI’s current component set can be extended to enable richer, more complex UIs. High-value additions include data visualization components (charts, graphs, calendars, timelines, heatmaps) so the AI can present analytical insights visually. For example, an agent could answer “Sales trends this quarter” by returning a LineChart component with data points, rather than a text description. Google’s internal usage shows agents embedding interactive charts and maps via custom components
developers.googleblog.com
, confirming the need for graphs and geospatial views. Rich text and media are also crucial: components for formatted Markdown or code blocks (with syntax highlighting), LaTeX math rendering, image galleries, audio/video players, etc., would let the AI produce more engaging content. Imagine a coding assistant agent that can return a CodeBlock component with runnable code or a tutoring agent that returns a VideoPlayer with an instructional clip.

Complex forms and dialogs are another area – multi-step form wizards, modals or drawers for focused tasks, and conditional form sections that appear based on prior inputs. This would improve conversational flows like the restaurant reservation example, where instead of back-and-forth text, the agent can generate a form with date/time pickers and validate inputs on the fly
developers.googleblog.com
. Navigation components like tab views, accordions, breadcrumbs, or menus would allow the AI to organize information into sections, rather than a single long scroll. Layout components should support more flexible arrangements: today A2UI uses a flex layout, but adding grid or masonry layouts and responsive breakpoints would ensure UIs look good on both desktop and mobile (the AI could specify that cards wrap into a single column on small screens, for instance). Container queries could even let the agent tailor component appearance if it knows the available viewport size.

To implement these, we can draw on existing libraries. For charts, a lightweight JS charting library (like Chart.js or D3) can be integrated under a new Chart component – the agent would specify data and type (e.g. line, bar) and the renderer calls the chart library. Maps could be handled via an MapView component that wraps something like Leaflet or Google Maps API (with safe constraints, e.g., map tiles only). For calendars and timelines, there are open-source React components (e.g. FullCalendar for calendars) that could be adapted. It’s important that each new component is clearly described to the LLM (what it does and what props it accepts) so it uses them correctly. The CopilotKit team emphasizes focusing on “predefined components, tested and reliable, ready to snap together” rather than free-form UI generation
tambo.co
tambo.co
. By growing the component catalog thoughtfully, we maintain the safety of the declarative approach while greatly expanding expressiveness. Advanced components should also be designed to fit into the data binding model of A2UI – for instance, a Chart component might bind to a data series in the shared data model, updating automatically if that data changes.

Finally, responsive design for mobile support (“mobile too”) means ensuring our components are flexible in size and layout. The AI could be encouraged via prompt guidelines to favor fluid layouts that adapt. We may introduce properties like responsive: true or allow the agent to specify style hints (e.g., “span 2 columns on large screens”). The A2UI front-end renderer can also enforce mobile-friendly defaults (tap targets size, use CSS flex-wrap or media queries). The goal is that an agent-generated UI looks “native” on any device, fulfilling the promise of interfaces dynamically tailored to the user’s context
tambo.co
.

Streaming & State

Streaming UI updates are a core part of A2UI’s design, but there are opportunities to make it even more interactive and resilient. Currently, the protocol streams NDJSON messages that the client incrementally applies to build the UI. We can enhance this with partial rendering and optimistic state updates:

Partial Rendering & Incremental JSON Parsing: The agent should be able to send a complex UI in pieces, which the frontend can render as each piece arrives. This is useful if generating a large interface or performing a multi-step reasoning process. Research prototypes have shown how to parse JSON before it’s fully complete – using a “parsePartialJson” technique to handle incomplete streams without waiting for a perfect JSON end bracket
github.com
github.com
. By implementing a streaming JSON parser on the client, we could start rendering a list as soon as the first few list items stream in, improving time-to-first-paint. This aligns with Mastra’s multi-agent workflow demo, which forwarded high-value intermediate events (like web search results) to the UI immediately, while the rest of the agent’s answer was still being assembled
github.com
github.com
. For A2UI v2, we should consider a standard way to mark partial data (maybe an updateComponents message with a flag indicating “more coming” or using the existing message types to progressively build a collection).

Optimistic Updates: In interactive apps, when a user clicks a button or submits a form, the UI should respond instantly. A2UI could allow the client to apply a predicted UI update even before the server (agent) confirms it. For instance, if the user ticks a checkbox, we might immediately show it checked and disabled, while sending the action to the agent. If the agent then streams an updated UI state (or an error), the client reconciles that. This pattern is common in modern web apps for responsiveness and can be supported by A2UI’s state model. One approach is to allow the client to locally modify the data model or component state and render those changes, but tag them as “optimistic”. If the server’s next updateDataModel/updateComponents message diverges, the client either merges or overrides the optimistic state. We should design clear semantics for this, possibly leveraging unique component IDs. Since A2UI already uses IDs to reference components in updates
developers.googleblog.com
, the client can match incoming updates to the affected components and only override if different from the optimistic value.

Error Handling & Recovery: Streaming networks can fail mid-way or the AI might output invalid JSON that the client rejects. To handle this, A2UI v2 could introduce error boundaries in the UI – e.g., a container component that can display a fallback UI if its children fail to render. On the protocol level, the agent could be notified of a ValidationFailed error (as the spec suggests)
a2ui.org
a2ui.org
 and then attempt to resend a corrected message. The system prompt can include instructions for the LLM to self-correct JSON format or component usage errors if a validation error message is returned
a2ui.org
a2ui.org
. In practice, our renderer might implement a try-catch around applying updates and, on failure, send a structured error message back to the agent (which A2UI supports) so that the agent can re-generate the UI properly
a2ui.org
a2ui.org
. Users should see a graceful fallback (e.g., an “Oops, retrying…” message or a preserved last valid UI) instead of a broken interface.

Suspense and Loading States: While waiting for streamed content, the UI should indicate loading for a better UX. We can incorporate suspense-style placeholders – e.g., a Skeleton component that shows a shimmer preview of content that’s coming. The agent could include placeholder components initially (like an empty table with a loading spinner), then replace them via updateComponents once real data is ready. Alternatively, the client could automatically inject a generic loading indicator for any component that hasn’t filled its data yet. Pamela Fox notes that streaming reduces time-to-first-answer and engages users
blog.pamelafox.org
; adding explicit loading states would enhance this by assuring users that “something is happening” even if parts of the UI are not yet populated. A2UI could define a convention (perhaps a boolean loading prop on certain components or dedicated LoadingSpinner component) that agents can use to communicate this.

State Management: A2UI already has a concept of a data model separate from the UI structure, allowing two-way binding (input components update the data model, and UI reflects model changes)
a2ui.org
a2ui.org
. In a streaming context, maintaining this state consistency is tricky. We should ensure that partial updates and optimistic changes all reconcile through the same data model. One idea is to treat the data model like a single source of truth: e.g., an optimistic UI change first updates the data model locally, which in turn updates bound components; when the server responds with an authoritative updateDataModel, we diff and merge. The protocol already has updateDataModel messages with operations like “replace” vs “insert”
a2ui.org
a2ui.org
 – using these intelligently can let the agent send minimal diffs (for example, only the field that changed, rather than resending the whole model). This reduces bandwidth and allows more fluid updates.

Offline and Reconnection: Though not an initial focus, we should consider how the UI behaves if connectivity drops. For instance, if using HTTP streaming and the connection is interrupted, can the client recover? A design could be to have each surface or UI “session” identified, so the agent can re-send the current state if a client reconnects. Caching the last known UI state in IndexedDB on the client is another strategy, so if the user reloads or goes offline, they see the last UI and maybe a message “attempting to reconnect.” Offline support is a challenging stretch goal, but it aligns with providing a resilient UX. Even simply ensuring that if the stream breaks, the UI doesn’t freeze (e.g. client times out and shows a “refresh to try again” alert) would be an improvement.

In summary, streaming in A2UI v2 should move beyond just token-by-token text – it should enable continuous UI interactions. The user shouldn’t feel like they’re waiting on a monolithic answer, but instead observing and even interacting with a UI that the AI is constructing in real time. As one best practice, Steve Steiner at Azure suggests streaming more of the process (like showing intermediate steps: “Searching for results… Generating answer…”) to keep users engaged
blog.pamelafox.org
blog.pamelafox.org
. We can generalize that idea to UIs: for example, an agent could first stream a “searching…” view, then update it with results. A2UI v2’s protocol and rendering pipeline must make these transitions seamless.

AI-Assisted UI

One of A2UI’s key advantages is enabling the AI to design the UI. To make the most of this, we need to assist the AI in understanding what components are available and how to use them effectively:

Component Discovery & Descriptions: The AI should have clear, concise descriptions of each component’s purpose. Good AI-readable descriptions focus on semantics (what the component represents or does) rather than visual details (since the model can’t see the actual UI). For example, instead of “a blue button with rounded corners,” we’d describe a Button as “a clickable button that triggers an action (like form submission).” The Tambo framework demonstrates this: when registering components in Tambo’s React SDK, you provide a name and a human-friendly description (e.g., "WeatherDisplay" – A display of the weather in a city") and a props schema for what data it needs
tambo.co
. These descriptions go into the prompt so the LLM knows which component matches a given scenario. We should refine our component docs given to the model – possibly adopting a pattern where each component entry in the system prompt has an example usage. For instance: “Component: LineChart – Description: Displays a data series as a chart. Props: title (string), data (array of {x,y} points), xLabel, yLabel. Example: A chart of monthly sales.” This way, the model can learn by example and be more likely to output the correct JSON for that component.

Prop Inference and Defaults: Even with schema validation, the model might not always supply every prop perfectly. We can help by providing default values and type hints. The A2UI v1 approach used Zod to validate components – v2 can extend this by allowing some props to be optional with defaults. For instance, if an agent outputs a Table without an explicit column width, the renderer can assume an auto width. The AI might also guess at valid combinations: for example, if it uses a DatePicker component, it should know it likely pairs with a text field or has a format prop. Documentation given to the model can include these hints (“e.g., DatePicker must be used inside a Form or accompanied by a Submit button”). In v0.9 of the spec, an interesting addition is a standard_catalog_rules.txt – a text with rules like “Button must have an action property describing what happens when clicked”
a2ui.org
. Such rule-based guidance helps the LLM avoid nonsensical combinations. We should develop a similar set of prompt-level guardrails for A2UI components, encapsulating best practices and constraints that are hard to enforce via JSON Schema alone. This can cover things like “Use a Carousel component only if you have multiple images to show” or “A Form should contain at least one input and a submit button.”

Layout Suggestions: The LLM currently decides on layout by constructing parent/child relations and maybe using flex properties. But we can give it higher-level advice. For example, if multiple components are in a container, the model might benefit from knowing it can use a Grid vs a Column layout. By adding a few common layout patterns in the system prompt (like “For side-by-side content, use a horizontal Flex; for sections stacked vertically, use a vertical Box” etc.), we guide the model to better structure. Over time, the AI could even learn to recommend improvements – e.g., if it generates a very tall list, maybe it “knows” to put it inside a ScrollContainer component to avoid overflow. Another idea is AI-driven layout optimization: after initial generation, the agent could have a second pass where it evaluates the UI (maybe by simulating a rendering in its “mind”) and then adjusts. While true self-refinement is complex, a simpler approach is to include constraints in the prompt about responsive design (“Ensure the UI fits in a mobile screen by wrapping elements if needed”) so it inherently makes good layout choices. The CopilotKit blog on generative UI notes that declarative UI hits a sweet spot by giving variety without chaos
copilotkit.ai
 – we maintain guardrails via the fixed components, but layout can be flexible. We should continue to curate those guardrails in the AI prompt.

Context Awareness: The agent’s UI generation should utilize conversation context and user profile when available. A2UI doesn’t directly handle conversation memory (that’s on the agent side), but from a UI perspective, the AI can tailor the interface if it knows more. For instance, if the conversation history indicates the user is visually impaired (or on a slow connection), perhaps the AI chooses components accordingly (like high-contrast mode or avoids heavy images). This sort of adaptation could be achieved by passing relevant context into the system prompt that describes the user’s environment or preferences (with user consent). Additionally, the AI can reference previous UIs it made in the session – e.g., maintaining consistency. If earlier in the chat the agent presented a list of items and the user asked to refine one, the new UI might reuse the same component types to keep the experience coherent. Multi-turn UI is a challenge: the AI must decide whether to update an existing surface or create a new one on each user turn. We should define a strategy (perhaps using the surfaceId concept
a2ui.org
): the agent can target updates to an existing surface if the UI should persist and change, or end one surface and start a fresh one. Teaching the model when to do which (e.g., if the user query is a follow-up, modify the current UI; if it’s a new topic, createSurface a new UI) will improve the fluidity of multi-turn interactions.

Fallback Handling: Inevitably, there will be times the model doesn’t adhere to the UI schema. We need robust fallbacks. One approach is graceful degradation: if the model outputs something that can’t be parsed as valid A2UI JSON, the client could interpret it as plain text and just show it in a chat bubble (so the user still gets an answer). We should log such incidents and possibly feed that back for fine-tuning or prompt adjustments. Another fallback could be a minimal “I’m sorry, I can’t display that” UI if the requested operation is beyond the model’s abilities. For example, if a user asks for an intricate UI that our component set can’t fulfill, the agent might respond with a message or a simpler UI acknowledging the limitation. Ensuring the AI doesn’t endlessly apologize or get stuck is also important – our system prompt should encourage the model to always produce something (even if just a Text component with a message) rather than failing silently. In testing phase, we might deliberately break some outputs to ensure the system handles it.

In summary, AI-assisted UI generation works best when the AI is given a well-defined playground: a catalog of allowed components (with clear descriptions and examples), rules of use, and knowledge of the user’s needs. A2UI v2 should focus on tightening this feedback loop – essentially training the AI (via prompt engineering and possibly fine-tuning on examples) to be a competent UI designer. The good news is that other industry players are converging on this idea. OpenAI’s forthcoming “Open JSON UI” spec is essentially their version of a declarative UI schema for models
docs.ag-ui.com
, meaning we should expect models to increasingly support structured UI output natively. By staying LLM-friendly (e.g., using flat JSON lists rather than deeply nested structures
a2ui.org
a2ui.org
), A2UI can leverage the strengths of GPT-4 and beyond in generating valid interfaces.

Accessibility & i18n

Accessibility (a11y) and internationalization (i18n) are non-negotiable for a modern UI framework, and generative UIs present unique challenges and opportunities for both.

Accessibility: Since A2UI UIs are generated on the fly, we must ensure that every component rendered is accessible by default. This involves multiple strategies:

Semantic HTML & ARIA: The renderer should use semantic HTML elements for each component where possible (e.g., <button> for Button, <h1>-<h6> for Heading, <img alt="..."> for Image with the alt text property). Many accessibility features come free with correct semantics. For dynamic or custom components, we should add ARIA attributes. For example, if we have a Alert component that pops up with a message, it should have role="alert" so screen readers announce it immediately. Live regions are particularly important for streaming content: as tokens or partial answers come in, a screen reader might not announce them unless we mark the container as an ARIA live region (e.g., aria-live="polite" for incremental updates). We should test scenarios like a user who relies on a screen reader hearing a gradually appearing answer. Perhaps we provide a mode where streaming text is accumulated off-screen and only announced sentence by sentence to avoid overwhelming the user – these are details we can refine with user testing.

Keyboard Navigation: All interactive components need to be operable via keyboard alone. This likely means ensuring proper tabindex order, focus management when modals open (trap focus inside, return focus on close), etc. Since the structure is generated, the framework (renderer) must enforce these patterns. For example, if a Drawer component opens, our code should automatically shift focus to it and trap focus inside until closed. If the AI forgets to consider it, the client should handle it. We may also expose some focus-control APIs to the agent (though it’s tricky for an LLM to micromanage focus). Simpler is ensuring our components do the right thing. The Tambo blog highlights patterns like “Focus control: UI that tells the LLM which component or area to focus on next”
tambo.co
 – while that is more about the AI’s logic than DOM focus, it reminds us that the AI could potentially influence UI focus if needed (e.g., after creating a form, it might want the cursor in the first field – our renderer could automatically do that).

Screen Reader Guidance: We might consider giving the AI the ability to provide additional context for screen readers. For instance, a Chart component might not be fully perceivable to a blind user; the AI could accompany it with a textual summary or provide an alternative view (like a data table) if it knows the user’s accessibility settings. This ties into context awareness – if we had a user profile flag for “screenReader=true” or similar, the agent could adjust output accordingly (ex: use simpler layouts, or more descriptive text). A straightforward step is requiring that all Image components from the AI include alt text in their props (we enforce alt as required). If the model doesn’t supply it, maybe we automatically fill with a generic description or request the model to “describe the image for accessibility” as a follow-up.

Reducing Motion & High Contrast: Users with motion sensitivity or low vision have preferences like prefers-reduced-motion and high-contrast mode. The client can detect these via CSS media queries or OS settings. We should allow those to influence the rendering – e.g., if an agent requests an animated component or auto-scrolling, the renderer could disable it when prefers-reduced-motion is on. High contrast themes might swap out colors; if our design system tokens have high-contrast variants, the renderer can apply them. The AI itself might not know these settings, but the client can simply render using a different CSS theme. However, we could inform the agent (“User is in high-contrast mode”) so it, for instance, avoids using a Badge component that relies solely on color coding without text. Generally, our components should convey information in more than just color to meet WCAG guidelines – e.g., a Status indicator should have an icon or text plus color.

Internationalization: Generative UI adds an interesting twist to i18n. The AI can presumably output text in the user’s language if prompted accordingly, but how do we handle things like labels and format?

Language of AI Output: If the user is conversing in Spanish, ideally the AI’s UI labels (button text, column headers, etc.) should also be in Spanish. GPT-4 is capable of translating its content; we just need to ensure it gets the instruction. The system prompt can include the conversation locale or an instruction like “Respond with interface text in the user’s language.” Since A2UI transmits data separate from presentation, one option is to have components identified by keys and have a translations catalog. However, because the UI is generated dynamically, a static translation file might not have all phrases the AI decides to use. More feasible is to rely on the AI’s multilingual abilities for on-the-fly translation. In other words, treat it like any response – if the user speaks French, the model describes the UI in French. This should cover most dynamic text.

Static vs Dynamic Text: Some UI text might come from the client (for example, a generic “Submit” label or an error message template). For those, we should use localization frameworks (like react-i18next or similar) to render the appropriate translation. If the AI specifically outputs a component property that is a known message key, the renderer could recognize it. For instance, maybe we decide that if the model sets label: "__SUBMIT__" on a Button, our client will swap in the localized word (Submit/Enviar/提交 depending on locale). Defining such conventions might be useful to avoid minor translation errors from the LLM. But this adds complexity in prompt (the model would have to know to output keys). Alternatively, the agent itself could be given a library of common UI terms in various languages to use – likely overkill. A simpler approach: let the AI handle all user-facing text in the moment, and ensure it’s consistent.

Formatting (Dates, Numbers): The client-side can format data if provided in a standard form. For example, an agent might output a timestamp or a number, and a component could format it according to locale. If we have a DatePicker or Calendar component, it should show Monday vs Sunday first based on locale, etc. These concerns are typically handled by libraries like date-fns or Intl API in JavaScript. We should incorporate that into components – essentially, components that display dates/times or currencies should use the user’s locale (which the client knows). We might not need the AI to worry about it, other than providing raw data. For instance, the AI can provide totalPrice: 1188.72 and the Table or Card component can localize it (to $1,188.72 in en-US vs 1.188,72 € in de-DE).

In conclusion, accessibility and i18n are about extending trust: users need to trust that these AI-generated UIs are as usable as hand-crafted ones. We have to proactively bake these features into the renderer because an LLM, left on its own, won’t know all the nuances of WCAG or localization. By making the default components accessible and translatable, we minimize the risk of exclusion. Notably, Google’s Generative UI research found users strongly prefer AI-generated UIs when done right, with big improvements in usability and satisfaction
emergentmind.com
emergentmind.com
. “Done right” must include for everyone, including those with disabilities or who speak other languages. We should test A2UI outputs with accessibility evaluation tools (like axe-core) and with speakers of different languages to ensure v2 can truly serve a broad audience.

Performance

Performance considerations ensure that even complex UIs generated by an agent remain fast and responsive. There are a few main areas: rendering performance (in the browser or app), network efficiency, and overall system throughput.

Virtualization of Large Lists: If an AI generates a very large list or table (imagine a table of 1000 rows of data), a naive renderer would try to create 1000 DOM elements, which could bog down the UI or even crash lower-end devices. We should integrate windowing/virtual scrolling for such cases. This could be an internal detail of components like Table or List – if the number of children exceeds some threshold, the component only renders a window of them and recycles the DOM elements on scroll. Libraries like React Window or Virtuoso can help implement this. The key is that this should be transparent to the agent; the agent just says “here are 1000 items” and the client handles it efficiently. By doing so, we keep memory and layout costs down. We should also consider chunking the stream of such content – e.g., the agent might stream 100 items at a time to avoid huge JSON payloads, and the client appends incrementally, which combined with virtualization, means it could start showing the first items while later ones are still coming. This ties back to streaming improvements.

Image Optimization: Agents may return images (like Image component with a URL). We can optimize these by leveraging lazy-loading (only load images that are in or near the viewport). Most browsers support loading="lazy" on <img> which covers this easily. For high resolution images, we might also use a technique like serving a low-res placeholder first (perhaps the agent could even provide one, or the client could use a service to blur it) – this is similar to the “blurhash” approach used in some image-heavy apps. Additionally, if the same image is used multiple times, caching is important. The client should reuse the fetched image data. We should instruct agents to provide image sizes if known, so the UI can reserve space and avoid reflow when image loads. If using Next.js or similar frameworks, their built-in Image component could help with some of these optimizations (though A2UI aims to be platform-agnostic, the concept of responsive image sizes and lazy load is universal).

Batching and Chunk Sizes: We need to consider the optimal chunk size for NDJSON streaming. If an agent sends one JSON message per token (too granular), the overhead and render thrash would be high. If it waits to send a huge JSON blob, the interactivity drops. Striking a balance is key. Perhaps for text generation within a Text component, the agent streams every few words or sentences (OpenAI’s own streaming often sends chunks of a few tokens at a time). The Pamela Fox blog noted that browsers tend to batch DOM updates – even if you append one word at a time, the user might see a chunk of a sentence appear due to repaint throttling
blog.pamelafox.org
. In our renderer, we could explicitly yield to the browser (e.g., using setTimeout(…, 0) or requestAnimationFrame) to control chunking and ensure smooth typing effect. Pamela’s colleague forced repaint every ~33ms to achieve a true “word by word” effect in a chat answer
blog.pamelafox.org
. We might not need that level for all UIs, but if we implement a typewriter effect for streaming text, we can consider a similar approach (with caution to not degrade performance with too many reflows).

Minimizing Bundle Size: With many new components and features, we should monitor the bundle size impact on the host application. Including entire chart or map libraries can bloat an app if not managed. A strategy is to load heavy dependencies on demand. For instance, the Chart component could dynamically import the charting library the first time it’s used. This way, if a particular session never uses charts, the code isn’t loaded. Similarly, if we integrate with something like Google Maps API, we might only fetch the script when a Map component is about to mount. The design system tokens or theming support likely won’t add much overhead as it’s mostly static styles or context. We should also tree-shake any unused components – if someone builds an app with A2UI but their use-case never calls for, say, the VideoPlayer component, an optimized build might drop it (assuming we provide modular imports). We can document how to include only needed components if we modularize the library.

Back-end Throughput and Backpressure: Performance isn’t just client-side. If multiple UI updates stream in faster than the client can apply them, we could get a backlog. We might implement a simple form of backpressure: e.g., the client acknowledges each message after processing, and the server (agent orchestrator) slows down if the client is lagging. However, in practice the network and JSON parsing are likely the bottlenecks rather than DOM updates, unless updates are extremely large. Agents also need to be optimized – generating massive JSON is slower for a model than generating text typically. We might consider compressing repetitive structures. For example, if the agent wants to create 50 identical cards with different data, ideally it shouldn’t have to repeat the full component JSON 50 times. This is something A2UI’s flat model doesn’t naturally allow (since each component is listed). A future extension could be a template-plus-data approach, but that complicates the spec. For now, ensuring the model is capable of handling moderate UI sizes is enough. We should test how GPT-4 performs with, say, 100-component JSON output – likely it’s fine, given its structured output abilities.

Profiling and Optimization: As we implement new features, we should profile example sessions on both desktop and mobile. Measure things like time to first render, time to fully render, memory usage for large interfaces, etc. This will identify bottlenecks (e.g., perhaps our diffing algorithm for updateComponents is slow for large JSON – we might need to optimize that). Using tools like the browser dev tools Performance tab or React Profiler on rendered UIs will help. For React, too many state updates could cause re-renders – we should batch JSON updates into as few React state updates as possible to avoid “render waterfalls.” If using something like a reconciler that directly manipulates the DOM, we might have more control. Either way, we ensure A2UI is not just flexible, but efficient, so it can be used in production at scale.

Design System and Theming

A2UI should not generate a “Frankenstein UI” that looks out of place in the host application – it needs to seamlessly blend in. This is where design tokens and theming come in. Essentially, we separate style from structure: the AI describes the structure (components, layout, content) and the client applies the theme (colors, fonts, spacing).

Design Tokens Mapping: Many organizations use design tokens (for colors, font sizes, spacing, etc.). We can align A2UI’s component library with these by using tokens for all styling in our renderer. For example, instead of a Button having a hardcoded background color, it might use --primary-color CSS variable which the host app can set. The agent might not know about specific colors, but it can request a semantic variant (like Button color “primary” vs “secondary”). The mapping of “primary” to an actual hex value comes from the theme. In practice, we’ll likely define a default theme (maybe similar to Material or a neutral style) and allow injection of a custom theme. If the host app is dark mode, they can supply a dark theme tokens set – and all generated UIs will automatically use those colors, since the components are tokenized. Google’s A2UI approach emphasizes that the client retains full control over styling, ensuring the agent’s output feels native to your app
developers.googleblog.com
developers.googleblog.com
. This likely means an agent doesn’t specify exact CSS, just component types and maybe style hints. A2UI v2 can introduce more theme awareness: perhaps the agent can query what theme is active or at least know if it’s “light” or “dark” (if provided in prompt). But even if not, the components should adapt. For example, a Chart component might automatically choose a palette that matches the theme (light background vs dark background variant). Using CSS variables or context providers in React for theme is a straightforward way to accomplish this.

Typography and Spacing Scale: We will embed a typography scale into components – e.g., Heading component could support levels (h1, h2, etc.) that correspond to font sizes from the theme’s scale. The AI just picks “Heading level 1” and the theme decides that’s 32px font vs 24px, etc. This ensures consistency with the rest of the app. Similarly for spacing: rather than allowing arbitrary pixel values, we might restrict the AI to use a spacing token (small, medium, large gap). In structured output, enforcing that might be tricky, but if we catch a spacing value that is not a token, we could round it or map it. Perhaps in the component schema, instead of a numeric padding: number, we define an enum like padding: ["none","xs","s","m","l"] mapping to actual values. This would gently push the model to use those terms. In prompt, we could describe them (“‘m’ padding means use medium standard spacing ~16px”). That way, the UI layout it generates is likely to already align with the design system scale.

Light/Dark Mode: The components should automatically adjust to light or dark mode as set by the user or system. If the host app supports both, our theme can have two variants. The agent doesn’t necessarily need to know the difference, but if it picks images or emojis it might matter (e.g., a sun icon might look better on dark background if filled vs outlined). However, that’s edge. The main thing is enabling easy switching. We should implement theme switching at the provider level (e.g., <A2UIProvider theme={darkTheme}>). Additionally, if the user toggles dark mode during a session, the UI should restyle without needing a whole new agent response. Since components use CSS variables, toggling the theme context could restyle everything instantly. This again reinforces that style is client-controlled.

Custom Themes: Developers may want to plug their own theme (with brand colors, etc.). We should expose an interface for that. Perhaps a simple JSON of tokens or a mechanism to map our default tokens to theirs. If our standard catalog has components like Card that have a certain look, maybe they want to override it (e.g., make corners more rounded or change shadows). This starts to encroach on design system territory – one solution is to allow overriding component implementations. For instance, if using a component library (like MUI or Chakra under the hood), one could wrap A2UI’s components in theme providers of those libraries. Alternatively, if we built our own lightweight components, provide CSS-in-JS or classNames to let the host override styles. The Google Dev Blog notes A2UI can render via various frameworks (Lit, Angular, Flutter, etc.) and integrate into branded UX
developers.googleblog.com
developers.googleblog.com
. For our context (likely React/web), we ensure that theming is at least as flexible as typical React component libraries.

Variant and Style Props for AI: While style is mostly on the client, we might let the AI choose among predefined style variants. For example, a Button might have variants like “primary”, “secondary”, “outline”. The AI can set variant: "outline" to convey intent (e.g., a less emphasized action). The actual rendering of “outline” vs “primary” is defined by the theme. This gives the AI some design control without raw CSS. Similarly, maybe a Card component could have a appearance: "elevated" | "flat" etc., if that’s meaningful. We must document these clearly to the model. The CopilotKit blog about generative UI emphasizes balancing creativity with safety – allowing mix-and-match of components is good, but freeform styling is risky
copilotkit.ai
copilotkit.ai
. Sticking to variant enums is a safe compromise.

In summary, A2UI v2 should act as a smart “skin”: the AI provides the skeletal interface, and the client’s design system skin renders it beautifully and consistently. This way, any interface the AI generates looks like it was hand-crafted for that app. It increases user trust (“this doesn’t look auto-generated; it fits in!”) and avoids jarring transitions. Practically, this means heavy use of theming techniques and likely close collaboration with design teams to ensure the components and tokens align with their guidelines. It may also be worthwhile to provide a design mode where a designer can see all A2UI components and verify they meet branding – perhaps using our component preview tool in Developer Experience.

Developer Experience

To drive adoption and make building with A2UI enjoyable, we need to cater to developers with better tooling, documentation, and testing capabilities.

Visual Debugger / Stream Viewer: When developing an AI agent that outputs UI, it can be difficult to understand what went wrong if the UI isn’t as expected. A visual debugger would display the JSON messages being streamed and how they translate into UI in real-time. We could build a dev mode in the client that, for example, shows a panel with the raw NDJSON messages, and highlights components on the UI when you hover over the JSON and vice versa. This is somewhat analogous to React DevTools but for the A2UI layer. It will help debug issues like “the model tried to update a component that doesn’t exist” or “the JSON was malformed at chunk X”. Even a simple console log of each message and applying it step by step is useful, but a nice UI would be ideal. LangChain’s Agent Chat UI includes advanced debugging features like time-travel (replaying an agent’s steps)
docs.langchain.com
 – for A2UI, a replay tool could allow stepping through each streamed message to observe state changes. This would greatly aid in refining prompts and agent logic.

Schema Documentation and Autocomplete: Since A2UI uses schemas (Zod, JSON Schema), we can auto-generate reference docs for the component catalog. We should publish a Component Reference (like the one in the spec site
a2ui.org
a2ui.org
) that clearly lists all components, their props, types, and example JSON. This helps developers writing system prompts or function-call specs for the LLM. We might also provide a TypeScript interface for the UI spec so that if a developer wants to manually craft or validate UI messages, they get type hints. If using OpenAI function calling, we could supply the JSON Schema definition of A2UI to OpenAI – though v0.9 spec indicates moving away from strict function calling to prompt-first
a2ui.org
, devs might still want it for validation.

Component Playground / Preview: Similar to Storybook, having a way to see each component in isolation is valuable. We could create a simple web app where all standard components are listed and can be interacted with. More ambitiously, a sandbox where a developer (or even the LLM itself with some guidance) can assemble components to see how they look. This could double as a testing tool for the AI – e.g., feed it some sample data and see if it produces a decent UI. Possibly integrate with the concept of “Prompt-Generate-Validate loop”
a2ui.org
 – a developer could iterate on the prompt with a preview of what UI it generates. It might also be useful to have a prompt template builder that helps include the component docs and examples.

Stream Replay & Logs: Capturing the conversation and UI stream is useful not just for debugging but for improving the agent. We should encourage or provide a means to log each session’s messages. Then a developer can replay it either stepwise or feed it into a test. For instance, if a certain user query consistently breaks the UI, having the log of what the agent tried to output allows offline analysis. A replay tool could let you modify the agent’s response JSON and see if it would fix the issue, which you can then feed back into prompt engineering. Over time, this could evolve into a training dataset of “good UI output” vs “bad output” to fine-tune the model, but that’s beyond immediate scope.

Hot Reload and Development Mode: If developers are customizing components or theme, they should be able to see changes without restarting everything. Standard webpack/Vite hot module reload would apply to our components. If the agent logic is being tweaked, maybe a mock agent can be used that reads from a file of test prompts for quick iteration. We might package some example agents or mock JSON to simulate various UIs for development purposes.

Integration Guides: Since A2UI can be used with different backends and frontends, we should provide guides for common setups. For example: “Using A2UI with OpenAI API (function calling vs prompt)”, “Using A2UI with LangChain/AGI frameworks”, “Embedding A2UI in a React app with Vercel’s AI SDK” etc. Each guide can highlight any gotchas. If we make A2UI interoperable with frameworks like AG-UI (which focuses on connecting agent to UI), we should document that. For instance, AG-UI can carry A2UI messages over its protocol
docs.ag-ui.com
docs.ag-ui.com
, so show how to plug that in. The easier we make it, the more developers will try A2UI v2.

Community and Examples: Encourage contributions of new components or integrations through an open repo. Provide example apps (like a To-Do list agent that uses a checklist UI, or a data dashboard agent that outputs charts and tables). These real examples help devs understand the power and edge cases. In the open-source spirit, Google has open-sourced A2UI and invited collaboration
developers.googleblog.com
developers.googleblog.com
 – we should do likewise in practice by actively maintaining the repo, responding to issues, etc.

By improving DX, we shorten the feedback loop for building AI-driven UI features. Currently, building such UI might feel “magical” but also inscrutable when it fails. With better tooling, we demystify it and give developers confidence. In a sense, we want to make developing an agent with A2UI as straightforward as developing a regular React app: inspectable, testable, and with plenty of resources to draw on.

Security

Security is critical because A2UI is effectively allowing a remote AI to shape part of the user interface. We must prevent any possibility of the AI doing something malicious or leaking sensitive data through the UI channel.

Sandboxed Execution vs Declarative Format: A2UI’s philosophy is to treat UI instructions as data, not code, precisely for security
developers.googleblog.com
developers.googleblog.com
. Unlike sending HTML/JS which could execute arbitrary script, our JSON components are rendered by the trusted client code. We should continue to enforce that no component can run custom scripts. Even components that might involve dynamic behavior (like a Map showing interactive panning) should be coded in advance by us, not by the AI. This means no eval or injection of model-provided code. It’s worth threat-modeling: for instance, could the model output something that exploits our renderer? If a component expects a string but the model cleverly inserts a <script> tag in a Text component, our renderer should treat it as plain text (escaping it if inserting into innerHTML). Using proper DOM text node insertion or sanitization libraries for any HTML content will guard against XSS. Essentially, treat all strings from the model as untrusted. This is a basic rule but easy to overlook if, say, we allowed a Markdown component – we’d need to use a safe Markdown parser that doesn’t allow raw HTML by default, or sanitizes it.

Resource Limits: We should impose limits on how much UI an agent can create to prevent denial of service or crashes. For example, cap the total number of components in a surface (perhaps a few hundred, or dynamically based on type). If the model tries to output 10,000 rows, the client might truncate or ask for confirmation. Similarly, limit nesting depth – a malicious or buggy model could produce infinitely nested containers that could blow the call stack or memory. We can define a maximum JSON depth (maybe 10 levels) and drop further nesting. The A2UI spec v0.9 likely addresses some limits, and indeed we see mention of validation and a feedback loop on failure
a2ui.org
. We could incorporate such checks either in JSON schema or manual post-parse checks. Also limit frequency of updates – e.g., an agent shouldn’t be allowed to send 1000 updateComponents per second. Rate limiting or debouncing on the client can help if an agent goes haywire.

Authentication and Permissions: In multi-agent scenarios or third-party agents (via A2A protocol), we must be careful which agents can render what. The host app might only allow certain component types from external agents, especially custom components. The A2UI blog suggests clients can advertise a set of custom components and only those are allowed
developers.googleblog.com
. This is good – the agent can’t just invent a <WebhookComponent> and steal data; if it’s not in the allowed list, the client ignores it. We should ensure the client-side renderer strictly ignores or errors on unknown component types. Also, consider if any component might access user data (for example, a hypothetical component that shows the user’s file system or location). We wouldn’t want an AI to suddenly display sensitive info that the user didn’t ask for. Ideally, components remain purely presentational and any data displayed is explicitly provided by the agent or user, not pulled from client without permission.

Content Security Policy (CSP): If A2UI is used in web contexts, using a strong CSP can mitigate many issues. Because our model outputs might include image URLs or iframes (in custom HTML component if we ever allow that), we should restrict domains. Perhaps images are proxied or require HTTPS. If we allow an iframe component (e.g., showing an external site or a video embed), it should have sandbox attributes (no scripts, same-origin blocked, etc., unless explicitly needed). At present, A2UI does not focus on embedding arbitrary external content, and that’s by design to keep security tight. We might in v2 allow safe media embeds (like YouTube videos) but we must use the provider’s recommended embed snippet which usually includes sandboxing.

Actions and Side Effects: The agent can trigger actions through components (like a Button with an action that might call a function). We need to guard what those actions can do. Typically, those actions route back to the agent (like telling the agent “user clicked X”) rather than directly doing something on the client. If we allow some actions to call client code (maybe to integrate with client features), those should be whitelisted and not allow arbitrary parameters from the model. For example, if there is a “download file” action, the agent should not be able to craft a path that reads sensitive local files – that sort of thing. Keeping the agent’s reach minimal protects against it being hijacked or mis-optimizing.

Rate Limiting and Abuse: Consider that malicious users might try to prompt the AI to output huge UIs or rapidly update to stress the system. While the above limits handle the AI side, we should also ensure the whole pipeline is robust. On the server side, whichever service hosts the agent should have rate limiting (to prevent excessive requests). On the client, if a user somehow triggers continuous streaming beyond normal, we might break or alert. These are more general platform concerns but relevant if A2UI is open in a user-driven environment.

Privacy: If the AI is populating UI with user data (like names, emails in a Table), ensure that no sensitive info is inadvertently revealed. This is more on the agent’s logic side (ensuring it doesn’t leak data from one user’s session to another). But from the UI side, using components that hide or mask sensitive fields where appropriate (e.g., a PasswordInput component that doesn’t reveal text) could be considered. Logging and debugging tools we create should also sanitize any PII in captured JSON if logs are shared.

In summary, A2UI’s declarative, controlled approach already has a strong security model – v2 should double down on that by eliminating any remaining vectors for code injection or misuse. It’s worth mentioning that alternative approaches like fully generating HTML are far riskier (OpenAI’s Eli Berman notes raw HTML generation is “brittle” and unsafe at runtime
copilotkit.ai
). By sticking to a vetted component catalog and strict message schema, A2UI avoids whole classes of exploits. We just need to carefully implement client rendering and not introduce new risks as we add features. A security review for each new component (e.g., could a Chart component be misused to exfiltrate data via URL parameters? we should check that) is prudent. Given this is intended for production use, perhaps we also consider an external security audit once v2 features are in place.

Multi-User Real-Time Collaboration

Looking ahead, we may want A2UI to support scenarios where multiple users interact with the same AI-generated interface simultaneously. This could be, for example, a collaborative document editing assistant where two users are in a session with an AI, or any multi-user application where the UI is partly AI-driven (think Google Docs with an AI helper that inserts UI suggestions for all participants).

This is a complex extension, but we can outline how it might work:

Shared UI State: We’d need a concept of a shared surface that is synchronized across clients. The agent would send UI updates tagged for that shared session, and the server would broadcast them to all connected users’ clients. Each client would then render the update so everyone sees the same change. Essentially, this requires moving from the current one-to-one (one agent -> one UI) model to one-to-many. The A2UI protocol can remain mostly the same; it’s more about how the orchestrator distributes messages. Utilizing a pub/sub or WebSocket server could push updates in realtime.

Conflict Resolution: If multiple users can also input (e.g., both click different buttons), how to handle that? Possibly funnel all user actions back to the agent which arbitrates. We might implement a simple lock or turn-taking (maybe the AI or system sets a component as “in use by Alice” visually). For text inputs, a collaborative approach could use CRDTs or operational transform so that two users typing in an AI-generated form won’t clobber each other’s input. However, having the AI involved in every keystroke might be too slow; more feasible is to let the input sync peer-to-peer or via server, and only send final submission to AI. In other words, A2UI could integrate with existing collab tech for the input stage (like Y.js for a text area content). The AI’s role would then be to react to the final combined state or explicit user submissions.

Awareness & Multi-user UI Elements: In collab scenarios, new UI needs emerge: user cursors, presence indicators, etc. It’s an open question if the AI should generate those or the system provides them. Likely the system (client) handles baseline presence (e.g., showing avatars of who is online, etc.), while the AI could be aware and maybe tailor responses (“I see you and Bob are working on this…”). If we wanted, the AI could even act as a facilitator, adding UI prompts like “Waiting for Bob to confirm” with a Yes/No button for Bob. Supporting that means the AI might target a specific user’s view or send a message requesting a specific user action. This drifts toward multi-user conversation management which might be beyond A2UI’s scope. But it’s interesting to consider that the AI’s UI output might incorporate references to users.

Technical Implementation: We’d likely create a session ID concept and have createSurface(sessionId) that ties a UI to a collaborative session. The server (or a new “session manager” service) would cache the state of that surface. When a new user joins, it can send the current UI state to them (maybe via a replay of the last known messages or a snapshot). Then as any user triggers actions, the agent updates the UI and broadcasts diffs. We should ensure updates are atomic and applied in order. Using something like WebSockets would allow low-latency sync, which is needed for a real-time feel.

Inspiration from Others: Google’s GenAI research hints at multi-user support as a future direction, noting the need for collaborative modes and cloud-based interaction for generative interfaces
emergentmind.com
emergentmind.com
. This suggests that no one has fully cracked it yet, but it’s on the horizon. There might be parallels to how Google Docs (multi-user editing) or Figma (multi-user design) maintain state – those use OT/CRDT algorithms to merge concurrent changes. In our case, since the AI is central, we might simplify to a turn-taking model: e.g., user A asks AI something, AI generates UI, then user B clicks something, AI updates UI, and so on. If truly simultaneous inputs, we’d rely on server ordering (timestamp or queue).

Use Cases: A concrete scenario: a team meeting assistant where everyone sees an agenda UI the AI created, and they can all add topics or vote (via UI buttons) and the AI updates the agenda. Multi-user A2UI would enable such collaborative AI workflows. It could also be used in education (teacher and students interact with the same AI-driven lesson interface).

Challenges: Security and privacy become even more important – you wouldn’t want one user to craft a prompt that causes the AI to reveal another user’s data. The agent would need context of who is asking what. Possibly separate per-user system messages or persona. Also, UI updates might need to label which user did an action (like “Bob chose option 2”). We might introduce a way for the AI to output attributions or the client to annotate changes with user IDs.

Given the complexity, multi-user support might be a long-term goal for A2UI. For the next 3-6 months, we can design the basics (session ID, broadcasting) and perhaps implement a prototype for a simple case (two users, one counter button that increments for both when either clicks). This will teach us about needed changes in the protocol (maybe none at the JSON level, but some at transport). It’s an exciting frontier: making generative UIs not just personalized, but shared experiences. As the Emergent Mind analysis puts it, a future trajectory is supporting multi-user scenarios and distributed editing in generative UIs
emergentmind.com
. If A2UI v2 lays the groundwork, it could become one of the first frameworks to explore collaborative AI-driven interfaces.

Implementation Priority (High/Med/Low)

To focus our efforts in the next 3–6 months, we categorize proposed features into priorities:

High Priority:

Expanded Component Catalog (Charts, Forms, Media): High impact on use cases, relatively straightforward to add using existing libraries. Will unlock new capabilities (e.g. data visualization)
developers.googleblog.com
. Also includes layout components for responsive design.

Improved Streaming (Partial UI, Error Handling): Directly improves UX by reducing latency and providing feedback during long operations
github.com
blog.pamelafox.org
. Partial JSON parsing and progressive rendering are critical for complex multi-step agents.

AI Prompt Enhancements for UI Generation: Crafting better system prompts with component descriptions, examples, and rules is high priority because it dramatically improves output quality
tambo.co
a2ui.org
. This is a low-code but high-impact task.

Theming Integration: Ensuring theme tokens and light/dark mode support is ready. Important for adoption – devs need to easily match UIs to their brand. Likely achievable with moderate effort using CSS variables or context.

Developer Tools – Basic Stream Logger & Docs: Shipping at least a basic NDJSON logger and comprehensive schema docs/TypeScript types is high priority to aid developers from day one. These reduce friction in debugging and integration.

Medium Priority:

Optimistic UI and Advanced State Management: While valuable for UX, optimistic updates add complexity in sync. We can target a basic version (e.g., for form submissions) after core streaming is stable.

Accessibility Features: Many a11y improvements (ARIA labels, keyboard focus management) can be done in parallel with component development. Medium priority because core functionality can work without them, but should be addressed before production. Possibly phase in (e.g. ensure screen reader announces streamed text).

Performance Optimizations (Virtualization, lazy-load): Medium priority because they matter mainly in heavy scenarios. Implement after verifying that heavy scenarios (large lists, many images) are actually needed in near term. We can prototype virtualization with existing libraries in parallel.

Security Auditing & Hardening: Some security measures (sanitization, limiting unknown components) are straightforward and high priority to do immediately. Others like thorough penetration testing might be medium priority (to be done as features stabilize).

Plugin/Custom Component API: Allowing developers to add their own components (with AI descriptions) is a medium priority. It can greatly extend A2UI but requires careful design (to ensure the AI understands new components). Perhaps we tackle this after solidifying the core catalog.

Integration with Frameworks (AG-UI, LangChain): Medium priority – useful to demonstrate A2UI in various environments. We should allocate time to write adapters or guides but after internal features are near complete.

Low Priority:

Multi-User Collaboration: Important future goal, but likely beyond 6-month horizon to do fully. We can do initial design work (as described) but not full implementation yet. Mark as experimental if attempted.

Offline Support: A niche concern; nice to have but not critical in initial version. Could be explored later (maybe as part of multi-user sync persistence).

Highly Complex Components (e.g., rich text editors, code editors): These are tricky to integrate and for the AI to drive. Low priority for now; focus on simpler components first.

Full Build-Time Codegen Mode: Allowing AI to output raw HTML/CSS for export (like a design tool) – this is not our primary goal and covered by other tools
copilotkit.ai
. Low priority for runtime A2UI, might consider as separate mode much later.

Additional Transports (gRPC, etc.): Currently, NDJSON over HTTP or WebSocket suffices. Other transports (MCP, etc.) can be added later or by community if needed
developers.googleblog.com
developers.googleblog.com
. Low priority for core team right now.

This prioritization ensures we first nail the fundamentals (rich components, streaming UX, theming, and prompt tuning) which will make A2UI v2 immediately useful and impressive. Medium items improve robustness and breadth, and low items are forward-looking to keep in mind but not block v2’s release.

Code Examples

To illustrate some of the proposed patterns, here are a few pseudocode examples:

1. Partial Streaming and Progressive Rendering:
Below is a simplified loop of how the client might handle streaming JSON messages and apply them:

// Pseudocode for streaming JSON parsing and UI update
let buffer = "";
const decoder = new TextDecoder();
const stream = fetch('/agent-stream').body.getReader();

while (true) {
  const {done, value} = await stream.read();
  if (done) break;
  buffer += decoder.decode(value, {stream:true});
  // Try to split complete JSON objects from the buffer
  let boundary;
  while ((boundary = buffer.indexOf("\n")) !== -1) {
    const jsonStr = buffer.slice(0, boundary);
    buffer = buffer.slice(boundary+1);
    if (jsonStr.trim().length === 0) continue;  // skip heartbeats
    try {
      const msg = JSON.parse(jsonStr);
      applyA2UIMessage(msg);  // handle createSurface/updateComponents/etc.
    } catch(e) {
      console.warn("Partial JSON, waiting for more...");
      // If JSON is incomplete, break to read more from stream
      buffer = jsonStr + "\n" + buffer;
      break;
    }
  }
}


In the applyA2UIMessage(msg) function, we would handle the message types. For example, for updateComponents, we merge new component definitions into the current UI. If a component is incomplete (e.g., missing some children that might come later), the UI renderer could create a placeholder. This allows the UI to progressively appear without waiting for the entire JSON. The above loop uses newline-delimited JSON (NDJSON)
blog.pamelafox.org
. It tries to parse each line as JSON and only delays if a line isn’t complete JSON yet.

2. Optimistic UI Update Example:
Suppose we have a form and a Submit button. When clicked, we want to show feedback immediately:

// User clicks submit
button.onClick = () => {
  // Optimistically update UI: disable form fields and show a "Submitting..." message
  form.components.forEach(c => c.disabled = true);
  statusText.text = "Submitting...";  // a Text component in the UI for status
  render();

  // Send action to agent
  sendUserAction({type: 'formSubmit', data: form.getData()})
    .catch(err => {
      // If network/agent fails, roll back optimism
      form.components.forEach(c => c.disabled = false);
      statusText.text = "Submission failed, please try again.";
      render();
    });
};


When the agent receives the formSubmit action, it might respond with an updateComponents that, for example, replaces the form with a confirmation message. The optimistic state will last only a short time until that arrives. We assume the agent will either confirm or send validation errors. (In case of validation errors, the agent could send updateComponents that highlights the offending fields and re-enables them, etc.) The optimistic pattern makes the app feel snappy.

3. AI Prompt Component Definition (Tambo-style):
Here’s how we might define a new component and describe it to the LLM:

// Define a new ProgressBar component for A2UI
const ProgressBarProps = z.object({
  label: z.string().describe("Optional text label describing the progress"),
  value: z.number().describe("Current progress value (0-100)"),
  color: z.string().optional().describe("Color name or token for the bar")
});
type ProgressBarProps = z.infer<typeof ProgressBarProps>;

// Register in component catalog (for prompt and validation)
A2UI.registerComponent({
  name: "ProgressBar",
  propsSchema: ProgressBarProps,
  description: "A horizontal bar indicating progress from 0 to 100%. Useful for long-running tasks.",
  example: {
    component: "ProgressBar",
    id: "progress1",
    label: "Upload progress",
    value: 45
  }
});


In the system prompt to the LLM, we might include a representation like:

ProgressBar: "A horizontal progress bar showing completion percentage. Properties: label (text) – e.g. 'Upload progress'; value (number 0-100) – how much is done. The bar fills proportionally. Use this to indicate waiting or progress."

By providing an example JSON as well
copilotkit.ai
, the LLM is more likely to emit the correct format. The above TypeScript/Zod snippet ensures at runtime any ProgressBar JSON matches our expectations (value in range, etc.). This component could then be used by the AI to, say, stream progress of a file upload or a lengthy computation.

4. Multi-User Update Broadcast (conceptual):
If implementing a multi-user collab, the server might do:

# Pseudo-Python: broadcasting an update to all session clients
def handle_agent_message(session_id, message_json):
    # Validate/transform message as needed
    for client in session_clients[session_id]:
        client.send(message_json)

# When a user action comes in
def handle_user_action(session_id, user_id, action):
    # Optionally annotate action with user_id
    action['user'] = user_id
    agent_response = agent_service.send_action(session_id, action)
    # agent_service would produce messages for the session which get broadcast via handle_agent_message


This shows how an action from one user flows to the agent and then the resulting UI goes out to all users. The agent itself could incorporate the user info (maybe to personalize the UI or tag who did what).

These examples are simplified but capture the essence of improvements: streaming parsing logic, optimistic UI patterns, structured component definitions for AI, and the idea of session broadcasts. In a real implementation, many edge cases (error handling, ordering, etc.) would be addressed, but these give a flavor of the changes.

Library Recommendations

To implement the above features effectively, we can leverage several libraries and tools:

Charts & Graphs: Use a proven charting library like Chart.js or Recharts for React. These provide accessible SVG charts out of the box. We can wrap them in our Chart component (e.g., a lightweight wrapper that maps A2UI’s JSON data format to the library’s data structure). For more custom visualization, D3.js could be used, but Chart.js/Recharts will cover common cases with less effort.

Maps: Leaflet is a good choice for web maps (lightweight, open-source). We can pair it with something like Mapbox or OpenStreetMap tiles. For React, react-leaflet can integrate easily. Alternatively, Google Maps API is an option, but since we prefer open solutions (per user: "Opensource / our own creations"), Leaflet fits better. We’ll create a Map component that under the hood initializes a Leaflet map in a container.

Calendar/Date Picker: flatpickr (for date picking) or React DatePicker can provide calendar popups. For full calendar views, FullCalendar library is robust. We might start with a simple date/time picker input using a small library or the built-in <input type="date"> for basic needs.

Multi-step Forms & Validation: We already use Zod for JSON validation; we can extend that for runtime form validation as well. The agent can do some validation (e.g., highlight errors), but for basic checks (like required fields, number ranges) the client can give instant feedback. React Hook Form or Formik could manage form state and integrate with Zod schemas to validate on the fly. These would wrap around our Input components.

Virtualized List: react-virtual or React Window for windowing large lists/tables. React Virtual is a new-ish library that’s lightweight and flexible. We can incorporate it into components like Table or a ScrollList component.

Accessibility Testing: axe-core (perhaps via React axe or browser extension) can be used during development to catch a11y issues. Not a runtime library but a dev recommendation so we ensure compliance.

i18n: i18next for general internationalization if needed, but we may rely on LLM for dynamic text. However, using i18next for static labels and providing language dictionaries might be useful if we decide to have key-based translations. Also Intl API for formatting dates/numbers based on locale.

Theming: If we choose a CSS-in-JS solution, styled-components or Emotion could help define themes and provide theming context. But using plain CSS variables in a global stylesheet might be simplest for an open-source project. In that case, no heavy library needed – just define :root variables for light and dark and let the host override. If a more structured approach is preferred, Style Dictionary could manage tokens (converting a design tokens JSON to CSS vars).

Dev Tools: For the stream debugger UI, building custom is likely, but we can use React Developer Tools for profiling. Also, jsondiffpatch could be handy if we want to show diffs between consecutive JSON messages in the debugger.

Testing: Use Jest + jsdom for unit testing components and maybe snapshot tests of sample JSON to UI rendering. For integration tests, Playwright or Cypress can simulate user interactions on generated UIs to ensure the whole loop (agent to UI to action to agent) works.

Security: DOMPurify to sanitize any HTML if we ever allow rich text from AI. It’s a reliable library for XSS prevention. If we use Markdown, marked with the sanitize option or remark can ensure safe output.

Collaboration (future): If we venture into multi-user, Y.js or Automerge are popular CRDT libraries for real-time sync. We might use Y.js to sync form fields or text input content in real-time. For transport, Socket.IO or ws (native WebSockets) on server to broadcast messages.

By choosing these libraries, we avoid reinventing the wheel. Each recommended library is fairly mature and widely used, which de-risks our implementation. They also align with an open-source stack, and many integrate nicely with React which seems to be our primary target for the web client (given file names like .tsx in the prompt). Of course, we will abstract usage so that in future we can swap libraries if needed (for example, using an interface for charts so we could replace Chart.js with Vega or similar).

Competitive Analysis

Generative UI is a hot area, and several players have emerged with different approaches. Understanding how others solve this helps inform A2UI’s roadmap:

OpenAI (GPTs and “Open-JSON-UI”): OpenAI has been enabling structured outputs through function calling and the newer responses.parse API with schema definitions
platform.openai.com
platform.openai.com
. They even give an example of UI generation by defining a recursive JSON schema for HTML elements
platform.openai.com
platform.openai.com
. Their approach currently either has the model output raw HTML (as in Code Interpreter environment where it can render charts or tables in the ChatGPT UI) or use an internal schema for safe UI (OpenAI’s Open-JSON-UI spec was mentioned as an open standardization of their internal schema
docs.ag-ui.com
). The indications are that OpenAI might not release a full UI kit but rather allow the model to output something like our JSON which then the developer renders. They also introduced “GPTs” (custom ChatGPT personalities) that can have tooling and UI. For example, the Canva plugin in ChatGPT allowed a mini UI for selecting template types. They likely hard-coded those UIs, but future OpenAI tools may support returning a UI description that ChatGPT can render. MCP (Model Context Protocol) mentions consolidation with OpenAI on UI as resource via ui:// URIs
developers.googleblog.com
, meaning OpenAI considered a scheme where a function returns a URL to an HTML UI, shown in an iframe. That’s more like the iframe sandbox approach (similar to MCP-UI by Microsoft). In summary, OpenAI’s philosophy seems twofold: for trusted internal tools, they might let the model output HTML (since they can sanitize and control environment, as seen in Code Interpreter showing matplotlib charts in an iframe sandbox). For external usage, they lean towards structured safe outputs and leaving rendering to developers. A2UI aligns with the latter and can position itself as the go-to standard that OpenAI devs can adopt. If OpenAI releases Open-JSON-UI officially, we should ensure A2UI is compatible or at least easily translatable to it. It’s worth noting that function calling in OpenAI could directly target an A2UI generation function (we could provide a JSON schema for the full UI, though that might be too large). Instead, we may follow A2UI spec v0.9 approach of prompt-based generation
a2ui.org
 for flexibility. OpenAI’s own UI in ChatGPT uses nice rendering for certain outputs (like markdown tables, code, images) – they achieved it by tightly integrating format parsing in the client. We want to offer similar richness but in any app.

Microsoft MCP and Adaptive Cards: Microsoft (with partners like Shopify) has the Model Context Protocol (MCP) and specifically MCP-UI, which treats UI as a resource loaded in iframes
docs.ag-ui.com
. This is akin to returning a mini web app. It’s powerful (the model can generate complete HTML/JS which the client sandbox executes) but, as noted, heavy and with potential styling mismatches
developers.googleblog.com
. Microsoft also has Adaptive Cards – a JSON format for cross-platform UI (used in Teams, Outlook etc.). One could compare A2UI to Adaptive Cards: both use JSON for UI. Adaptive Cards have a fixed set of elements (text, images, buttons, etc.) and focus on being lightweight and host-controlled styling. A2UI is like an AI-driven, streaming version of that concept, with more complex state handling. Microsoft could integrate generative AI with Adaptive Cards (e.g., letting GPT create an Adaptive Card on the fly). If that happens, A2UI might need to interoperate or at least learn from their component set. For example, Adaptive Cards have good support for templating and data binding now; A2UI’s data model approach is similar. Our advantage is being designed for incremental assembly and AI friendliness. But for enterprise adoption, aligning with something like Adaptive Cards (or making it easy to convert A2UI JSON to an Adaptive Card) could help, since enterprises may already trust that tech.

Vercel AI SDK (Generative UI pattern): The Vercel AI SDK, particularly through their useChat and tools system, champions a pattern where the model calls tools and the UI is updated based on tool results
ai-sdk.dev
. For instance, the model might decide to call a “getWeather” tool, which returns structured data, and then the developer’s code maps that to a WeatherCard React component
ai-sdk.dev
ai-sdk.dev
. This is a slightly different paradigm: rather than the model explicitly describing UI layout, it indirectly causes UI by invoking functions. The advantage is more deterministic control – the developer defines what each tool does UI-wise. It’s essentially a semantic UI generation: the model says “I want to show weather for SF” by calling a tool, and the app knows that means render <WeatherCard city="SF" data=... />. This approach is safer in that the model can’t arbitrarily combine UI elements in unexpected ways; it’s limited to the pre-defined tool->component mappings. However, it’s also less flexible – the model needs to decide exactly which tool (component) to use and can’t, for example, compose multiple tools into a new layout easily. Vercel’s docs even show generating UI as connecting tool calls to components
ai-sdk.dev
ai-sdk.dev
. I’d classify this as a declarative actions approach vs our declarative UI spec approach. Both have merit. A2UI could actually be used within Vercel’s framework: one could conceive an A2UI tool that a model uses to output a whole layout at once, rather than many micro tool calls. That might be complex, but possible. Alternatively, A2UI could adopt some ideas: we could incorporate the concept of “if the model calls a function X, map it to UI Y”. Perhaps as a backup: if model struggles to emit full JSON, one could fall back to tool calls that produce parts of UI. But that complicates agent design. In practice, Vercel’s pattern works well for known tasks (like getWeather -> show weather card). A2UI is better for open-ended scenarios where the UI structure isn’t predetermined by a fixed set of tools. So, we differentiate by offering more freedom (the model can design new combinations), while still controlling via schema.

CopilotKit and Tambo: These are startups/projects directly tackling generative UI for React apps. CopilotKit appears to integrate with both A2UI and AGI frameworks. Their blog categorizes generative UI approaches and clearly favors the declarative mix-and-match approach as the sweet spot
copilotkit.ai
. In fact, CopilotKit partnered with Google to support A2UI at launch
copilotkit.ai
, so they are likely building tooling around it. This could mean that CopilotKit provides higher-level APIs or additional middleware to use A2UI more easily (they mention typed actions, state management helpers
copilotkit.ai
). If so, A2UI can remain the underlying spec, and CopilotKit might be complementary (not a competitor per se, but an ecosystem contributor). We should follow their updates; if they add features like debugging tools or multi-agent workflows (they mention LangGraph integration in a dev.to article
dev.to
dev.to
), we might leverage or contribute. Tambo is another React SDK focusing on letting LLMs control UIs safely
tambo.co
. They emphasize using existing components and tools, similar to our goals. Tambo seems to abstract some complexities: for example, they handle formatting tool results for display automatically
tambo.co
tambo.co
. We might examine Tambo’s API – they have a TamboProvider where you register components and tools
tambo.co
tambo.co
, very analogous to what we envision for A2UI’s context. The difference is that Tambo may handle the prompting of the LLM behind the scenes (giving it instructions about the components). A2UI could adopt a similar developer-friendly API (so you don’t manually craft the giant prompt – the library does it using the registry info). It would be wise to keep an eye on Tambo’s progress and maybe test it out to see its strengths. Possibly, A2UI can integrate ideas like the focus control or context selection patterns they discuss
tambo.co
. Competitive edge of A2UI is that it’s an open format with multi-framework potential (web, Flutter, etc.), whereas Tambo is React-specific. Also, A2UI as a Google-driven spec might attract community contributions more widely.

Google’s Generative UI (Gemini AI Mode): Google’s announcement of generative UI with Gemini (as of Nov 2025) is essentially validation of our approach
research.google
research.google
. They showed examples of AI fully designing interfaces on the fly for various tasks
research.google
research.google
. It sounds like Google’s Gemini can literally produce code (they mention “Gemini designs and codes a fully customized interactive response”
research.google
). That suggests a fully-generated UI route (though perhaps constrained by an internal library). If Google open-sources parts of this (they did open A2UI presumably as part of that effort, since the Google blog on A2UI came a month after the research blog
developers.googleblog.com
), we’re aligned. A2UI is probably the safer subset of the grand vision (i.e., not letting the AI produce arbitrary code, but use a templating system). Google’s internal use might push boundaries: for example, iterative improvement of UI through reward modeling as described in the research paper
emergentmind.com
emergentmind.com
. That’s cutting-edge and not in our 6-month scope, but our design should not preclude future integration of such techniques. We might glean from their paper that representing UI as a graph of states (FSMs per component) was useful
emergentmind.com
. Perhaps in A2UI v3+ we could incorporate state machines for complex components (for now, we rely on simpler prop/state model). For now, our competitive stance is to be the go-to open implementation of these ideas. If Google Search and others roll out these dynamic UIs, developers will want to emulate that in their own apps – A2UI can be the toolkit to do so.

Traditional Design-to-Code Tools: Tools like Figma’s AI features (Figma Make) and Builder.io’s AI can generate UI layouts from descriptions or designs
figma.com
figma.com
. However, those are mostly for building static UIs or code – e.g., “Prompt to UI in Figma” will create a design that a human can tweak
figma.com
, or Builder.io converts a given design into code
dev.to
. They’re not aimed at runtime adaptation or conversational use. The key difference: A2UI is about real-time, contextual interface generation for an active session, whereas design-to-code is about speeding up development of fixed interfaces. One pattern in those tools is they ensure output quality by leveraging existing components as well – e.g., Builder’s component mapping to reuse code, or Locofy’s detection of design patterns
dev.to
dev.to
. This reinforces that using a registry of known components is the sustainable way (the “Lego bricks” analogy
tambo.co
). We should reassure that, unlike design-to-code which might produce brittle code that still needs polishing (and often lacks logic), our approach produces functional UIs on the fly for each user. It’s complementary: a designer could use Galileo AI to sketch a UI concept, and an app could use A2UI to actually generate variations of it per user input.

In summary, A2UI’s niche is providing a standard, streaming, safe UI description format for agents, positioned between the extremes of rigid predefined UIs and free-form generated code
copilotkit.ai
copilotkit.ai
. Competitors like OpenAI and Microsoft acknowledge the need for such a middle ground, and A2UI (with backing from Google) is poised to set the standard. Our plan to improve it aligns with staying ahead: e.g., streaming updates (others haven’t showcased that as much), richer component set (others currently do fairly basic cards/tables), and cross-platform ambition (web, mobile via Flutter’s GenUI SDK
github.com
blog.flutter.dev
). If we execute well, developers will adopt A2UI v2 to build ChatGPT-like or Gemini-like experiences in their own products, without waiting for big tech to package it for them.

Proposed A2UI Extensions

Building on all the above, we propose several concrete extensions and changes for A2UI v2:

Schema Versioning and Negotiation: Introduce a clear version field in the A2UI protocol messages or handshake. For instance, when the client starts, it can send a message like {type: "handshake", a2uiVersion: "0.9"} to the agent or include it in the system prompt so the LLM knows which spec it should follow. This prevents mismatches as the spec evolves. We should maintain backward compatibility where possible, or at least provide a translation layer from older versions to new (the Evolution Guide 
a2ui.org
a2ui.org
 outlines changes 0.8 -> 0.9; we might do similar for 0.9 -> 1.0). Also, consider semantic versioning for the component catalog separately from core protocol. A2UI v2 (maybe we’ll call it 1.0) could support multiple catalogs (e.g., “standard v1”, “enterprise extended v1”) and the client and agent agree on which set to use. This negotiation could simply be in prompt (client tells LLM which components are available), but a formal JSON message listing supported components could be used in non-LLM contexts.

Custom Component Plugins: Develop a mechanism for developers to add their own components to A2UI without forking the core. This might be through a plugin registration on the client side and a way to inform the agent. For example, a developer could define a MyCustomChart component with certain props. They then extend the prompt to describe it. Possibly the agent could query the client for a list of custom components (if using a function-call approach). Simpler is documentation: we provide guidelines how to extend (like how to structure the description for the LLM). We could also allow the agent to ask if a component exists (“do you have a component that does X?”) via some reflection tool, but that’s overkill. Initially, just ensure our architecture loads additional components and that the validation schema can be extended (the v0.9 spec’s modular schema design
a2ui.org
 is promising here – swap out standard_catalog for a custom one without altering core). This encourages community contributions and specialized use (e.g., a biotech company might add a DNASequenceViewer component for their AI to use).

Enhanced Messaging (New Message Types or Fields): Consider adding fields like partial: true on update messages to indicate more coming, as discussed. Or a message type for validation errors: e.g., a ValidationFailed message that the client can send back if it cannot render something, prompting the agent to fix it
a2ui.org
. Also, possibly a message for theme or context info – e.g., contextUpdate that informs the agent of certain client-side changes (user toggled dark mode, or user’s locale changed). This could be out-of-band or just via userAction, but a defined type might be cleaner.

Stateful Components & FSMs: As we broaden components, some might have internal state beyond just props (think of a Carousel which has current slide index). Right now, the agent would have to manage that (update the index prop on swipe). Perhaps introducing a concept of component-managed state with limited autonomy could reduce message chatter. For example, a Carousel component might handle local swipe events and only notify agent on significant events (like user clicked a particular item). The spec could allow some event types to not go to the agent but be handled by client (like pure UI events). We must be cautious not to diverge from the “agent is in control” philosophy, but trivial UI interactions (expanding accordion panels, etc.) might be allowed to happen without a round-trip. We can define which components can self-manage minor state transitions. If we formalize it, it’s almost like small state machines per component that the agent trusts the client to handle. This ties to the research notion of FSM-modeled components
emergentmind.com
. For now, we might just pick a few cases (like a form input local state) and say agent doesn’t need to approve every character typed.

Multi-Surface and Modal Workflows: Extend the protocol to handle multiple surfaces more fluidly. We have createSurface and deleteSurface already
a2ui.org
a2ui.org
. We could add a notion of modal surfaces (e.g., a surface that is a dialog on top of another). The agent could then say createSurface(id:"modal1", modalOf:"main") to indicate hierarchy. Or simpler, have a Modal component container within the same surface. But giving surfaces relationships could be neat. Also ensure surfaces can be updated independently. Maybe allow the agent to target specific surface in updates without referencing it every time (if the conversation is within one surface context until closed).

Rich Text Content: Add a property or sub-component spec for rendering rich text (like Markdown support within a Text component, or an HTML subset). We kept everything strict to avoid injection, but we can carefully allow bold, italic, lists, etc. Possibly define a RichText component that takes a simplified markup (like Markdown or an AST structure). The agent then can produce formatted explanations easily (like a list of steps as bullet points). This is user-requested often (they mentioned “markdown, math/LaTeX” in objectives). We can do it safely by parsing via a library on client side (with sanitization). So propose adding TextBlock component with a format: "markdown" | "html" prop and content, which the client will parse safely. This avoids the agent manually creating list components for everything (though it could).

Action Enhancements: Currently, agent-to-UI is one way except for user actions. We might refine how actions are specified. Perhaps allow an action to directly carry a small payload of data (e.g., a Button’s action could indicate “submitForm” and the client will bundle form data automatically). Or define a standard response for certain actions (like file upload could be an action where client returns a file object, possibly not applicable in all contexts). Essentially bridging more tools: if the AI requests a user upload or capture something (photo, etc.), A2UI could define components that trigger those native actions and then feed result back. That’s more on agent-tools side, but we can specify it (for example a FileInput component could on user file selection send a userAction with a file link or data).

Logging and Monitoring Hooks: For enterprise use, provide hooks to tap into the message flow for analytics or auditing. E.g., a callback on the client that fires whenever a new component is rendered or a user clicks something, so devs can log metrics (like which AI-generated UIs are used most, or track errors). Essentially observer pattern on the A2UI stream.

Testing Utilities: Perhaps provide a mode where the agent can run in a deterministic way (maybe using recorded responses) to facilitate automated testing of UIs. Also a validator tool that can run through a sample JSON and point out likely issues (like using unknown components or missing required props).

Many of these extensions aim to make the system more robust and flexible without altering the core philosophy. As we implement v2, we should keep the spec documentation updated and maybe start drafting a formal v1.0 spec based on these ideas, moving from draft 0.9 to a stable release. Engaging the community (via the open-source repo and Linux Foundation’s A2A initiative) will help refine these extensions too.

Research Links

Google Developers Blog – Introducing A2UI (Dec 2025): Announcement of A2UI, detailing its purpose, security model (declarative, not code), and multi-framework approach
developers.googleblog.com
developers.googleblog.com
. Useful for understanding A2UI’s core principles and examples of use cases (like restaurant reservation UI)
developers.googleblog.com
.

A2UI Protocol Specification v0.9 (Draft): Technical spec for A2UI’s JSON message structure (createSurface, updateComponents, etc.) and component model
a2ui.org
a2ui.org
. Includes changes from v0.8 to 0.9, highlighting shift to prompt-first generation and more modular schema
a2ui.org
a2ui.org
. This is crucial for implementing v2 in alignment with official spec.

CopilotKit Blog – Three Types of Generative UI (Sep 2025): Excellent overview of static vs declarative vs fully generated UI, arguing that declarative (mix & match from a component registry) is the sweet spot
copilotkit.ai
copilotkit.ai
. Reinforces many design decisions of A2UI (using guardrails and pre-built components) and highlights pros/cons of each approach
copilotkit.ai
copilotkit.ai
.

Tambo Blog – “Let LLMs Control Your UI” (Nov 2025): Describes patterns for LLM-driven UIs and how the Tambo SDK lets developers register components and tools for the LLM
tambo.co
tambo.co
. Provides insight into how to describe components to AI and why certain UI interactions are better than pure chat. Good reference for AI prompting techniques and component registration.

Pamela Fox Blog – Streaming UI Best Practices (Sept 2023): Though focused on chat apps, it gives practical tips on using NDJSON streaming and achieving smooth token-by-token rendering
blog.pamelafox.org
blog.pamelafox.org
. Supports our streaming enhancements (like forcing frequent repaints for the illusion of continuous typing)
blog.pamelafox.org
.

Mastra Workflow Streaming Example (GitHub, 2023): Implementation notes on multi-agent streaming with NDJSON, partial JSON parsing, and progressive UI
github.com
github.com
. Validates our approach for partial rendering and shows the importance of streaming intermediate tool results to avoid “frozen UI” during long agent reasoning
github.com
.

Vercel AI SDK Docs – Generative UI & Tools: Documentation showing how a tool call can be mapped to a React component to produce generative UI experiences
ai-sdk.dev
. Useful to compare an alternate pattern where the AI triggers UI indirectly. It helped us articulate differences and potential integrations with A2UI.

Emergent Mind Article – Generative Interfaces for LMs (2025): Summarizes academic work (Chen et al. 2025) on generative UIs, including state graphs and iterative refinement
emergentmind.com
emergentmind.com
. Offers a forward-looking perspective (like multi-user support and FSM modeling)
emergentmind.com
 that influenced our future considerations for A2UI.

Figma Make Announcement – Prompt to UI (2023): Highlights Figma’s AI that generates layouts from text and can export to code
figma.com
. While not directly related to real-time UI, it contextualizes the generative design trend and assures us that our component-based approach aligns with industry direction (reusing generated UI in design tools vs runtime).

Each of these resources contributed insights into forming a comprehensive plan for A2UI v2, from foundational principles to cutting-edge research and practical developer experience reports. By synthesizing their lessons, we aim to advance A2UI as the leading platform for realtime, AI-driven UI generation.