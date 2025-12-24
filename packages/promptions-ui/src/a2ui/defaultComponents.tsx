import React from "react";
import { z } from "zod";
import { registerComponent, registry } from "../registry/componentRegistry";
import type { A2UIAction } from "./protocol";

type ActionHandler = (eventType: A2UIAction["type"], payload?: Record<string, unknown>) => void;

type TextProps = {
  text: string;
};

const TextSchema = z.object({
  text: z.string(),
});

function A2UIText({ text }: TextProps) {
  return <div>{text}</div>;
}

type HeadingProps = {
  text: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
};

const HeadingSchema = z.object({
  text: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).optional(),
});

function A2UIHeading({ text, level = 2 }: HeadingProps) {
  const Tag = (`h${level}` as unknown) as keyof JSX.IntrinsicElements;
  return <Tag style={{ margin: 0 }}>{text}</Tag>;
}

type ButtonProps = {
  label: string;
  eventType?: A2UIAction["type"];
  payload?: Record<string, unknown>;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  onAction?: ActionHandler;
};

const ButtonSchema = z.object({
  label: z.string(),
  eventType: z.enum(["click", "input", "select", "scroll", "submit", "custom"]).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  disabled: z.boolean().optional(),
  variant: z.enum(["primary", "secondary"]).optional(),
});

function A2UIButton({ label, eventType = "click", payload, disabled, variant = "primary", onAction }: ButtonProps) {
  const background = variant === "primary" ? "#2563eb" : "#e5e7eb";
  const color = variant === "primary" ? "#ffffff" : "#111827";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAction?.(eventType, payload ?? { label })}
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid #d1d5db",
        background,
        color,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

type TextInputProps = {
  label?: string;
  placeholder?: string;
  value?: string;
  multiline?: boolean;
  onAction?: ActionHandler;
};

const TextInputSchema = z.object({
  label: z.string().optional(),
  placeholder: z.string().optional(),
  value: z.string().optional(),
  multiline: z.boolean().optional(),
});

function A2UITextInput({ label, placeholder, value, multiline, onAction }: TextInputProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label ? <span style={{ fontSize: 12, color: "#374151" }}>{label}</span> : null}
      {multiline ? (
        <textarea
          defaultValue={value}
          placeholder={placeholder}
          onChange={(e) => onAction?.("input", { value: e.target.value })}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            minHeight: 80,
            resize: "vertical",
          }}
        />
      ) : (
        <input
          defaultValue={value}
          placeholder={placeholder}
          onChange={(e) => onAction?.("input", { value: e.target.value })}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
          }}
        />
      )}
    </label>
  );
}

type ImageProps = {
  src: string;
  alt?: string;
};

const ImageSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
});

function A2UIImage({ src, alt }: ImageProps) {
  return <img src={src} alt={alt ?? ""} style={{ maxWidth: "100%", borderRadius: 8 }} />;
}

type KeyValueListProps = {
  items: Array<{ key: string; value: string }>;
};

const KeyValueListSchema = z.object({
  items: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    }),
  ),
});

function A2UIKeyValueList({ items }: KeyValueListProps) {
  return (
    <dl style={{ margin: 0 }}>
      {items.map((item) => (
        <div key={item.key} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, padding: "6px 0" }}>
          <dt style={{ fontWeight: 600, color: "#111827" }}>{item.key}</dt>
          <dd style={{ margin: 0, color: "#374151" }}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Card component
type CardProps = {
  title?: string;
  subtitle?: string;
  variant?: "outlined" | "elevated" | "filled";
};

const CardSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  variant: z.enum(["outlined", "elevated", "filled"]).optional(),
});

function A2UICard({ title, subtitle, variant = "outlined" }: CardProps) {
  const baseStyles: React.CSSProperties = {
    padding: "16px",
    borderRadius: "12px",
    backgroundColor: "#ffffff",
  };
  const variantStyles: Record<string, React.CSSProperties> = {
    outlined: { border: "1px solid #e5e7eb" },
    elevated: { boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)" },
    filled: { backgroundColor: "#f3f4f6" },
  };
  return (
    <div style={{ ...baseStyles, ...variantStyles[variant] }}>
      {title && <div style={{ fontWeight: 600, fontSize: 16, color: "#111827" }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

// Alert component
type AlertProps = {
  message: string;
  severity?: "info" | "success" | "warning" | "error";
  dismissible?: boolean;
  onAction?: ActionHandler;
};

const AlertSchema = z.object({
  message: z.string(),
  severity: z.enum(["info", "success", "warning", "error"]).optional(),
  dismissible: z.boolean().optional(),
});

function A2UIAlert({ message, severity = "info", dismissible, onAction }: AlertProps) {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    info: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
    success: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
    warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
    error: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" },
  };
  const colors = colorMap[severity];
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 8,
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        color: colors.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>{message}</span>
      {dismissible && (
        <button
          type="button"
          onClick={() => onAction?.("click", { action: "dismiss" })}
          style={{ background: "none", border: "none", cursor: "pointer", color: colors.text, fontSize: 18 }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// Badge component
type BadgeProps = {
  text: string;
  color?: "gray" | "red" | "yellow" | "green" | "blue" | "purple";
  size?: "sm" | "md" | "lg";
};

const BadgeSchema = z.object({
  text: z.string(),
  color: z.enum(["gray", "red", "yellow", "green", "blue", "purple"]).optional(),
  size: z.enum(["sm", "md", "lg"]).optional(),
});

function A2UIBadge({ text, color = "gray", size = "md" }: BadgeProps) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    gray: { bg: "#f3f4f6", text: "#374151" },
    red: { bg: "#fef2f2", text: "#dc2626" },
    yellow: { bg: "#fffbeb", text: "#d97706" },
    green: { bg: "#f0fdf4", text: "#16a34a" },
    blue: { bg: "#eff6ff", text: "#2563eb" },
    purple: { bg: "#faf5ff", text: "#9333ea" },
  };
  const sizeMap: Record<string, { padding: string; fontSize: number }> = {
    sm: { padding: "2px 6px", fontSize: 10 },
    md: { padding: "4px 8px", fontSize: 12 },
    lg: { padding: "6px 12px", fontSize: 14 },
  };
  const colors = colorMap[color];
  const sizing = sizeMap[size];
  return (
    <span
      style={{
        display: "inline-block",
        padding: sizing.padding,
        fontSize: sizing.fontSize,
        fontWeight: 500,
        borderRadius: 9999,
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {text}
    </span>
  );
}

// Table component
type TableProps = {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number>>;
  striped?: boolean;
};

const TableSchema = z.object({
  columns: z.array(z.object({ key: z.string(), label: z.string() })),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
  striped: z.boolean().optional(),
});

function A2UITable({ columns, rows, striped }: TableProps) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
          {columns.map((col) => (
            <th key={col.key} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#111827" }}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr
            key={idx}
            style={{
              borderBottom: "1px solid #e5e7eb",
              backgroundColor: striped && idx % 2 === 1 ? "#f9fafb" : undefined,
            }}
          >
            {columns.map((col) => (
              <td key={col.key} style={{ padding: "10px 12px", color: "#374151" }}>
                {row[col.key] ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Checkbox component
type CheckboxProps = {
  label: string;
  checked?: boolean;
  disabled?: boolean;
  onAction?: ActionHandler;
};

const CheckboxSchema = z.object({
  label: z.string(),
  checked: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

function A2UICheckbox({ label, checked, disabled, onAction }: CheckboxProps) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        defaultChecked={checked}
        disabled={disabled}
        onChange={(e) => onAction?.("select", { checked: e.target.checked })}
        style={{ width: 18, height: 18, accentColor: "#2563eb" }}
      />
      <span style={{ fontSize: 14, color: "#374151" }}>{label}</span>
    </label>
  );
}

// Select component
type SelectProps = {
  label?: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onAction?: ActionHandler;
};

const SelectSchema = z.object({
  label: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })),
  value: z.string().optional(),
  placeholder: z.string().optional(),
  disabled: z.boolean().optional(),
});

function A2UISelect({ label, options, value, placeholder, disabled, onAction }: SelectProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <span style={{ fontSize: 12, color: "#374151" }}>{label}</span>}
      <select
        defaultValue={value}
        disabled={disabled}
        onChange={(e) => onAction?.("select", { value: e.target.value })}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #d1d5db",
          backgroundColor: "#ffffff",
          fontSize: 14,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Progress component
type ProgressProps = {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: "blue" | "green" | "yellow" | "red";
};

const ProgressSchema = z.object({
  value: z.number(),
  max: z.number().optional(),
  label: z.string().optional(),
  showValue: z.boolean().optional(),
  color: z.enum(["blue", "green", "yellow", "red"]).optional(),
});

function A2UIProgress({ value, max = 100, label, showValue, color = "blue" }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const colorMap: Record<string, string> = {
    blue: "#2563eb",
    green: "#16a34a",
    yellow: "#d97706",
    red: "#dc2626",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {(label || showValue) && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151" }}>
          {label && <span>{label}</span>}
          {showValue && <span>{Math.round(percentage)}%</span>}
        </div>
      )}
      <div style={{ height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            backgroundColor: colorMap[color],
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

export function registerDefaultA2UIComponents() {
  if (!registry.has("Text")) {
    registerComponent("Text", A2UIText, TextSchema, {
      category: "generative",
      description: "Plain text block",
    });
  }

  if (!registry.has("Heading")) {
    registerComponent("Heading", A2UIHeading, HeadingSchema, {
      category: "generative",
      description: "Heading (h1-h6)",
    });
  }

  if (!registry.has("Button")) {
    registerComponent("Button", A2UIButton, ButtonSchema, {
      category: "interactable",
      description: "Clickable button that emits an A2UI action",
    });
  }

  if (!registry.has("TextInput")) {
    registerComponent("TextInput", A2UITextInput, TextInputSchema, {
      category: "interactable",
      description: "Text input that emits an A2UI input action",
    });
  }

  if (!registry.has("Image")) {
    registerComponent("Image", A2UIImage, ImageSchema, {
      category: "generative",
      description: "Image",
    });
  }

  if (!registry.has("KeyValueList")) {
    registerComponent("KeyValueList", A2UIKeyValueList, KeyValueListSchema, {
      category: "generative",
      description: "Key/value list",
    });
  }

  if (!registry.has("Card")) {
    registerComponent("Card", A2UICard, CardSchema, {
      category: "generative",
      description: "Container card with optional title and subtitle",
    });
  }

  if (!registry.has("Alert")) {
    registerComponent("Alert", A2UIAlert, AlertSchema, {
      category: "generative",
      description: "Alert/notification message with severity levels",
    });
  }

  if (!registry.has("Badge")) {
    registerComponent("Badge", A2UIBadge, BadgeSchema, {
      category: "generative",
      description: "Small status badge/label",
    });
  }

  if (!registry.has("Table")) {
    registerComponent("Table", A2UITable, TableSchema, {
      category: "generative",
      description: "Data table with columns and rows",
    });
  }

  if (!registry.has("Checkbox")) {
    registerComponent("Checkbox", A2UICheckbox, CheckboxSchema, {
      category: "interactable",
      description: "Checkbox input that emits select action",
    });
  }

  if (!registry.has("Select")) {
    registerComponent("Select", A2UISelect, SelectSchema, {
      category: "interactable",
      description: "Dropdown select input",
    });
  }

  if (!registry.has("Progress")) {
    registerComponent("Progress", A2UIProgress, ProgressSchema, {
      category: "generative",
      description: "Progress bar indicator",
    });
  }
}
