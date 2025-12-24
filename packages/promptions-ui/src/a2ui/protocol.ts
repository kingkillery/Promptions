import { z } from "zod";

// A2UI Message Schema - Declarative protocol for AI-to-UI communication
const A2UIComponentSchemaBase = z.object({
  id: z.string().describe("Unique component identifier"),
  type: z.string().describe("Component type name (must match registered component)"),
  props: z.record(z.string(), z.unknown()).describe("Component properties"),
  layout: z.object({
    flex: z.number().optional().describe("Flex grow factor"),
    align: z.enum(["start", "center", "end", "stretch", "baseline"]).optional().describe("Flex alignment"),
    justify: z.enum(["start", "center", "end", "between", "around", "evenly"]).optional().describe("Flex justify"),
    gap: z.number().optional().describe("Gap in pixels"),
    direction: z.enum(["row", "column", "row-reverse", "column-reverse"]).optional().describe("Flex direction"),
    wrap: z.boolean().optional().describe("Allow wrapping"),
  }).optional().describe("Layout properties"),
  style: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe("CSS styles"),
});

export type A2UIComponent = z.infer<typeof A2UIComponentSchemaBase> & {
  children?: A2UIComponent[];
};

// Recursively add children to the schema
const A2UIComponentSchema: z.ZodType<A2UIComponent> = A2UIComponentSchemaBase.extend({
  children: z.lazy(() => z.array(A2UIComponentSchema)).optional(),
}) as z.ZodType<A2UIComponent>;

// A2UI Action Schema - For user interactions sent back to AI
export const A2UIActionSchema = z.object({
  type: z.enum(["click", "input", "select", "scroll", "submit", "custom"]),
  componentId: z.string().describe("Component that triggered the action"),
  payload: z.record(z.string(), z.unknown()).optional().describe("Action payload"),
  timestamp: z.number().describe("Unix timestamp"),
});

export type A2UIAction = z.infer<typeof A2UIActionSchema>;

// A2UI Stream Message - For streaming protocol
export const A2UIStreamMessageSchema = z.union([
  z.object({
    type: z.literal("component"),
    data: A2UIComponentSchema,
    complete: z.boolean().optional().describe("Whether this is the final message"),
  }),
  z.object({
    type: z.literal("update"),
    id: z.string().describe("Component ID to update"),
    props: z.record(z.string(), z.unknown()).describe("Properties to update"),
  }),
  z.object({
    type: z.literal("remove"),
    id: z.string().describe("Component ID to remove"),
  }),
  z.object({
    type: z.literal("action"),
    data: A2UIActionSchema,
  }),
  z.object({
    type: z.literal("error"),
    message: z.string().describe("Error message"),
    recoverable: z.boolean().optional().describe("Whether client can retry"),
  }),
]);

export type A2UIStreamMessage = z.infer<typeof A2UIStreamMessageSchema>;

// Protocol configuration
export interface A2UIConfig {
  maxComponents: number;
  maxDepth: number;
  allowedComponents: string[];
  maxPropsSize: number;
  enableActionLogging: boolean;
}

export const DefaultA2UIConfig: A2UIConfig = {
  maxComponents: 100,
  maxDepth: 10,
  allowedComponents: [],
  maxPropsSize: 10000,
  enableActionLogging: true,
};

// Validation functions
export function validateComponent(component: unknown): { valid: boolean; errors: string[] } {
  const result = A2UIComponentSchema.safeParse(component);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map(e => `${e.path?.join(".") || "root"}: ${e.message}`),
  };
}

export function validateAction(action: unknown): { valid: boolean; errors: string[] } {
  const result = A2UIActionSchema.safeParse(action);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map(e => `${e.path?.join(".") || "root"}: ${e.message}`),
  };
}

export function validateStreamMessage(message: unknown): { valid: boolean; errors: string[] } {
  const result = A2UIStreamMessageSchema.safeParse(message);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map(e => `${e.path?.join(".") || "root"}: ${e.message}`),
  };
}
