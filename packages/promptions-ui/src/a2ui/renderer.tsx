import React, { useMemo, useCallback } from "react";
import { A2UIComponent, A2UIAction } from "./protocol";
import { useTambo } from "../registry/TamboProvider";

type ActionHandler = (eventType: A2UIAction["type"], payload?: Record<string, unknown>) => void;

interface A2UIRendererProps {
  component: A2UIComponent;
  actionCallback?: (action: A2UIAction) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function A2UIRenderer({ component, actionCallback, className, style }: A2UIRendererProps) {
  const { registeredComponents } = useTambo();
  const timestampRef = React.useRef(Date.now());

  const entry = useMemo(() => {
    return registeredComponents.get(component.type);
  }, [component.type, registeredComponents]);

  const handleAction: ActionHandler = useCallback((eventType, payload) => {
    const action: A2UIAction = {
      type: eventType,
      componentId: component.id,
      payload,
      timestamp: timestampRef.current++,
    };
    actionCallback?.(action);
  }, [component.id, actionCallback]);

  // Layout styles
  const layoutStyle = useMemo((): React.CSSProperties => {
    const layout = component.layout;

    const alignItems = layout?.align
      ? (
          {
            start: "flex-start",
            center: "center",
            end: "flex-end",
            stretch: "stretch",
            baseline: "baseline",
          } as const
        )[layout.align]
      : undefined;

    const justifyContent = layout?.justify
      ? (
          {
            start: "flex-start",
            center: "center",
            end: "flex-end",
            between: "space-between",
            around: "space-around",
            evenly: "space-evenly",
          } as const
        )[layout.justify]
      : undefined;

    return {
      display: "flex",
      flexDirection: layout?.direction ?? "column",
      flexGrow: layout?.flex,
      alignItems,
      justifyContent,
      gap: layout?.gap,
      flexWrap: layout?.wrap ? "wrap" : undefined,
      ...(component.style as React.CSSProperties),
    };
  }, [component.layout, component.style]);

  if (!entry) {
    console.warn(`A2UI: Unknown component type "${component.type}"`);
    return (
      <div style={layoutStyle} className={className} data-a2ui-id={component.id}>
        <span style={{ color: "red", fontSize: "12px" }}>Unknown component: {component.type}</span>
      </div>
    );
  }

  // Validate props
  const result = entry.schema.safeParse(component.props);
  const validProps = result.success ? result.data : component.props;

  const Component = entry.component as React.ComponentType<Record<string, unknown> & { onAction?: ActionHandler }>;

  return (
    <div style={layoutStyle} className={className} data-a2ui-id={component.id}>
      <Component {...(validProps as Record<string, unknown>)} onAction={handleAction} />
    </div>
  );
}
