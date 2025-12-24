import { z } from "zod";
import React from "react";

// Schema types for component props
export type Schema = z.ZodType<unknown>;
export type SchemaRecord = Record<string, Schema>;

// Component definition
export interface RegisteredComponent<TProps = Record<string, unknown>> {
  name: string;
  component: React.ComponentType<TProps>;
  schema: z.ZodSchema<TProps>;
  description?: string;
  category?: "generative" | "interactable";
}

// Registry entry
export interface RegistryEntry {
  component: React.ComponentType<unknown>;
  schema: z.ZodSchema<unknown>;
  description?: string;
  category: "generative" | "interactable";
}

// The component registry
class ComponentRegistry {
  private registry = new Map<string, RegistryEntry>();

  register<TProps extends Record<string, unknown>>(
    name: string,
    component: React.ComponentType<TProps>,
    schema: z.ZodSchema<TProps>,
    options?: { description?: string; category?: "generative" | "interactable" }
  ): void {
    if (this.registry.has(name)) {
      console.warn(`Component "${name}" is already registered. Overwriting.`);
    }
    this.registry.set(name, {
      component: component as React.ComponentType<unknown>,
      schema: schema as z.ZodSchema<unknown>,
      description: options?.description,
      category: options?.category || "generative",
    });
  }

  get(name: string): RegistryEntry | undefined {
    return this.registry.get(name);
  }

  getAll(): Map<string, RegistryEntry> {
    return new Map(this.registry);
  }

  getByCategory(category: "generative" | "interactable"): Map<string, RegistryEntry> {
    const result = new Map<string, RegistryEntry>();
    for (const [name, entry] of this.registry) {
      if (entry.category === category) {
        result.set(name, entry);
      }
    }
    return result;
  }

  has(name: string): boolean {
    return this.registry.has(name);
  }

  list(): string[] {
    return Array.from(this.registry.keys());
  }
}

// Global registry instance
export const registry = new ComponentRegistry();

// Helper to create a schema from a TypeScript type
export function createSchema<T>(schema: z.ZodSchema<T>): z.ZodSchema<T> {
  return schema;
}

// Helper to register a component
export function registerComponent<TProps extends Record<string, unknown>>(
  name: string,
  component: React.ComponentType<TProps>,
  schema: z.ZodSchema<TProps>,
  options?: { description?: string; category?: "generative" | "interactable" }
): void {
  registry.register(name, component, schema, options);
}

// Helper to get registered component
export function getRegisteredComponent(name: string) {
  return registry.get(name);
}

// Common schema types
export const Schemas = {
  string: z.string(),
  number: z.number(),
  boolean: z.boolean(),
  array: <T extends Schema>(item: T) => z.array(item),
  object: <T extends SchemaRecord>(schema: T) => z.object(schema),
  optional: <T extends Schema>(schema: T) => schema.optional(),
  union: <T extends Schema[]>(schemas: T) => z.union(schemas),
};
