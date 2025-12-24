import React, { useState, useEffect, useRef, useCallback } from "react";
import parse, { DOMNode, Element } from "html-react-parser";
import { postProcess, validateHtml, ValidationResult } from "./postProcessor";

/**
 * Sandbox permission levels for different security contexts:
 * - "strict": No scripts, no same-origin (safest, static content only)
 * - "moderate": Scripts allowed but NO same-origin (can run JS but isolated from parent)
 * - "permissive": Scripts + forms + popups (still isolated from parent)
 *
 * SECURITY NOTE: We NEVER allow same-origin by default as this would let
 * the iframe access parent cookies, localStorage, and potentially execute XSS attacks.
 */
export type SandboxLevel = "strict" | "moderate" | "permissive";

// Allowed CDN domains for script sources
const ALLOWED_SCRIPT_CDNS = [
  "cdn.tailwindcss.com",
  "cdn.jsdelivr.net",
  "unpkg.com",
  "cdnjs.cloudflare.com",
];

interface CodeRendererProps {
  code: string;
  onError?: (error: Error) => void;
  onValidation?: (result: ValidationResult) => void;
  sandbox?: boolean;
  sandboxLevel?: SandboxLevel;
  className?: string;
  style?: React.CSSProperties;
}

interface RenderState {
  html: string;
  isLoading: boolean;
  error: string | null;
  validation: ValidationResult | null;
}

// Get sandbox attribute based on level
function getSandboxAttribute(level: SandboxLevel): string {
  switch (level) {
    case "strict":
      // No scripts, no forms, completely isolated
      return "";
    case "moderate":
      // Scripts allowed but isolated from parent (DEFAULT - secure)
      return "allow-scripts";
    case "permissive":
      // Scripts, forms, popups, but still isolated from parent
      return "allow-scripts allow-forms allow-popups allow-modals";
    default:
      return "allow-scripts";
  }
}

// Sanitize HTML to only allow scripts from whitelisted CDNs
function sanitizeScripts(html: string): string {
  // Remove inline scripts with dangerous patterns
  let sanitized = html;

  // Remove scripts that try to access parent/top/opener
  const dangerousPatterns = [
    /window\.(parent|top|opener)/gi,
    /document\.cookie/gi,
    /localStorage/gi,
    /sessionStorage/gi,
    /indexedDB/gi,
    /postMessage/gi,
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /setTimeout\s*\(\s*["'`]/gi,
    /setInterval\s*\(\s*["'`]/gi,
  ];

  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, "/* BLOCKED */");
  }

  // Remove external scripts not from allowed CDNs
  sanitized = sanitized.replace(
    /<script[^>]*src=["']([^"']+)["'][^>]*>/gi,
    (match, src) => {
      try {
        const url = new URL(src, "https://example.com");
        const hostname = url.hostname;
        if (ALLOWED_SCRIPT_CDNS.some(cdn => hostname === cdn || hostname.endsWith(`.${cdn}`))) {
          return match;
        }
        return `<!-- BLOCKED: script from ${hostname} -->`;
      } catch {
        return `<!-- BLOCKED: invalid script src -->`;
      }
    }
  );

  return sanitized;
}

export function CodeRenderer({
  code,
  onError,
  onValidation,
  sandbox = true,
  sandboxLevel = "moderate",
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
      let processedCode = postProcess(code);

      // Apply additional script sanitization for security
      if (sandbox) {
        processedCode = sanitizeScripts(processedCode);
      }

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

      // Wrap in sandbox container if needed
      let finalHtml = processedCode;
      if (sandbox) {
        // Add CSP meta tag for additional protection
        const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: blob:; script-src 'unsafe-inline' ${ALLOWED_SCRIPT_CDNS.map(cdn => `https://${cdn}`).join(" ")}; style-src 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src * data: blob:; connect-src 'none';">`;

        finalHtml = processedCode.replace(
          /<head>/i,
          `<head>${cspMeta}`
        );

        // Wrap content in isolated container
        finalHtml = `
          <div id="sandbox-root" style="
            all: initial;
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 100%;
            overflow-x: hidden;
          ">
            ${finalHtml}
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
  }, [code, sandbox, sandboxLevel, onError, onValidation]);

  // Options for html-react-parser (used in non-sandbox mode)
  const parseOptions = {
    replace: (domNode: DOMNode) => {
      if (domNode instanceof Element) {
        // Strip dangerous elements entirely
        if (["script", "iframe", "object", "embed", "applet", "base"].includes(domNode.name)) {
          return (
            <div style={{ display: "none" }} data-removed={domNode.name}>
              {/* Dangerous elements are stripped for security */}
            </div>
          );
        }

        // Remove dangerous attributes from any element
        if (domNode.attribs) {
          const dangerousAttrs = Object.keys(domNode.attribs).filter(
            attr => attr.startsWith("on") || attr === "href" && domNode.attribs[attr]?.startsWith("javascript:")
          );
          for (const attr of dangerousAttrs) {
            delete domNode.attribs[attr];
          }
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

  const sandboxAttr = getSandboxAttribute(sandboxLevel);

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
          // SECURITY: No allow-same-origin - isolates iframe from parent completely
          sandbox={sandboxAttr}
          // Disable referrer for privacy
          referrerPolicy="no-referrer"
          // Block top-level navigation attempts
          // @ts-expect-error - csp attribute is valid but not in React types
          csp="default-src 'self' 'unsafe-inline'; script-src 'unsafe-inline'"
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
      let processedCode = postProcess(rawCode);

      // Apply script sanitization if sandboxing
      if (options?.sandbox !== false) {
        processedCode = sanitizeScripts(processedCode);
      }

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
