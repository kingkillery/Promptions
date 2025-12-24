import React, { useState, useEffect, useRef, useCallback } from "react";
import parse, { DOMNode, Element } from "html-react-parser";
import { postProcess, validateHtml, ValidationResult } from "./postProcessor";

interface CodeRendererProps {
  code: string;
  onError?: (error: Error) => void;
  onValidation?: (result: ValidationResult) => void;
  sandbox?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

interface RenderState {
  html: string;
  isLoading: boolean;
  error: string | null;
  validation: ValidationResult | null;
}

export function CodeRenderer({
  code,
  onError,
  onValidation,
  sandbox = true,
  className,
  style,
}: CodeRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RenderState>({
    html: "",
    isLoading: true,
    error: null,
    validation: null,
  });

  // Process and validate code
  useEffect(() => {
    try {
      // Post-process the code
      const processedCode = postProcess(code);

      // Validate
      const validation = validateHtml(processedCode);
      onValidation?.(validation);

      if (!validation.valid) {
        setState(prev => ({
          ...prev,
          html: processedCode,
          isLoading: false,
          error: `Validation failed: ${validation.errors.join(", ")}`,
          validation,
        }));
        return;
      }

      // Wrap in sandbox if needed
      let finalHtml = processedCode;
      if (sandbox) {
        finalHtml = `
          <div id="sandbox-root" style="
            all: initial;
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 100%;
            overflow-x: hidden;
          ">
            ${processedCode}
          </div>
        `;
      }

      setState({
        html: finalHtml,
        isLoading: false,
        error: null,
        validation,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [code, sandbox, onError, onValidation]);

  // Handle interactive elements safely
  const handleInteractiveEvent = useCallback((event: Event) => {
    // Add event logging or tracking here
    console.log("Interactive event:", event.type);
  }, []);

  // Options for html-react-parser
  const parseOptions = {
    replace: (domNode: DOMNode) => {
      if (domNode instanceof Element) {
        // Add safety wrappers to interactive elements
        if (["script", "iframe", "object", "embed"].includes(domNode.name)) {
          return (
            <div style={{ display: "none" }} data-removed={domNode.name}>
              {/* Interactive elements are stripped for security */}
            </div>
          );
        }
      }
      return undefined;
    },
  };

  if (state.isLoading) {
    return (
      <div className={className} style={style}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "200px",
          backgroundColor: "#f3f4f6",
          borderRadius: "8px",
        }}>
          <div style={{
            width: "40px",
            height: "40px",
            border: "3px solid #e5e7eb",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={className} style={style}>
        <div style={{
          padding: "16px",
          backgroundColor: "#fef2f2",
          border: "1px solid #ef4444",
          borderRadius: "8px",
          color: "#dc2626",
        }}>
          <strong>Error rendering code:</strong>
          <p>{state.error}</p>
          {state.validation?.warnings.length ? (
            <div style={{ marginTop: "8px", fontSize: "14px", color: "#7f1d1d" }}>
              <strong>Warnings:</strong>
              <ul style={{ margin: "4px 0 0 16px" }}>
                {state.validation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <details style={{ marginTop: "8px" }}>
          <summary style={{ cursor: "pointer", color: "#6b7280" }}>
            View raw code
          </summary>
          <pre style={{
            marginTop: "8px",
            padding: "12px",
            backgroundColor: "#1f2937",
            borderRadius: "8px",
            overflow: "auto",
            fontSize: "12px",
            color: "#e5e7eb",
          }}>
            <code>{code}</code>
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      data-code-renderer="true"
    >
      {/* Use iframe for sandboxing when enabled */}
      {sandbox ? (
        <iframe
          srcDoc={state.html}
          style={{
            width: "100%",
            minHeight: "400px",
            border: "none",
            borderRadius: "8px",
          }}
          title="Generated Application"
          sandbox="allow-scripts allow-same-origin"
        />
      ) : (
        <div className="code-renderer-content">
          {parse(state.html, parseOptions)}
        </div>
      )}
    </div>
  );
}

// Hook-based renderer for custom integration
export function useCodeRenderer() {
  const [code, setCode] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const render = useCallback((rawCode: string, options?: { sandbox?: boolean }) => {
    try {
      const processedCode = postProcess(rawCode);
      const result = validateHtml(processedCode);
      setValidation(result);
      setError(result.valid ? null : result.errors.join(", "));
      setCode(processedCode);
      return { html: processedCode, validation: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setCode("");
    setValidation(null);
    setError(null);
  }, []);

  return { code, validation, error, render, reset };
}
