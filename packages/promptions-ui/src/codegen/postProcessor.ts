// Post-processor configuration
export interface PostProcessorConfig {
  injectApiKeys?: Record<string, string>;
  fixSyntaxErrors?: boolean;
  injectErrorBoundary?: boolean;
  sandbox?: boolean;
  allowedAttributes?: string[];
  allowedTags?: string[];
}

// Default configuration
export const DefaultPostProcessorConfig: PostProcessorConfig = {
  fixSyntaxErrors: true,
  injectErrorBoundary: true,
  sandbox: true,
  allowedAttributes: ["class", "id", "style", "src", "alt", "href", "target", "rel", "width", "height"],
  allowedTags: ["html", "head", "body", "div", "span", "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "a", "img", "button", "input", "select", "option", "textarea",
    "table", "thead", "tbody", "tr", "th", "td", "form", "label", "canvas", "svg",
    "path", "circle", "rect", "text", "g", "style", "script", "link", "meta", "title"],
};

// Extract HTML from markdown code block
export function extractHtmlFromMarkdown(markdown: string): string {
  // Match ```html ... ``` blocks
  const htmlMatch = markdown.match(/```html\s*([\s\S]*?)\s*```/i);
  if (htmlMatch) {
    return htmlMatch[1].trim();
  }

  // Match ``` ... ``` without language
  const genericMatch = markdown.match(/```\s*([\s\S]*?)\s*```/);
  if (genericMatch) {
    const code = genericMatch[1].trim();
    // Check if it looks like HTML
    if (code.includes("<html") || code.includes("<div") || code.includes("<!DOCTYPE")) {
      return code;
    }
  }

  // Try to find HTML in the raw text
  const htmlTagMatch = markdown.match(/<html[\s\S]*?<\/html>/i);
  if (htmlTagMatch) {
    return htmlTagMatch[0];
  }

  return markdown;
}

// Fix common syntax errors
export function fixSyntaxErrors(html: string): string {
  let fixed = html;

  // Fix unclosed tags - common patterns
  const unclosedTags = [
    { open: "<div", close: "</div>" },
    { open: "<span", close: "</span>" },
    { open: "<p", close: "</p>" },
    { open: "<li", close: "</li>" },
    { open: "<td", close: "</td>" },
    { open: "<th", close: "</th>" },
    { open: "<tr", close: "</tr>" },
    { open: "<thead", close: "</thead>" },
    { open: "<tbody", close: "</tbody>" },
    { open: "<table", close: "</table>" },
    { open: "<form", close: "</form>" },
    { open: "<ul", close: "</ul>" },
    { open: "<ol", close: "</ol>" },
  ];

  // Count tag occurrences and balance them
  for (const { open, close } of unclosedTags) {
    const openCount = (fixed.match(new RegExp(open, "gi")) || []).length;
    const closeCount = (fixed.match(new RegExp(close, "gi")) || []).length;

    if (openCount > closeCount) {
      const missing = openCount - closeCount;
      // Add missing closing tags at the end
      fixed += close.repeat(missing);
    }
  }

  // Fix missing DOCTYPE
  if (!fixed.toLowerCase().includes("<!doctype")) {
    fixed = "<!DOCTYPE html>\n" + fixed;
  }

  // Fix missing html/head/body tags
  if (!fixed.includes("<html")) {
    fixed = "<html>\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Generated App</title>\n</head>\n<body>\n" + fixed + "\n</body>\n</html>";
  } else if (!fixed.includes("<head")) {
    fixed = fixed.replace("<html>", "<html>\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Generated App</title>\n</head>");
  }

  // Fix broken image tags
  fixed = fixed.replace(/<img([^>]*)>/gi, (match, attrs) => {
    if (!attrs.includes("alt=")) {
      return match.replace("/>", ' alt="Image">');
    }
    return match;
  });

  // Fix unquoted attributes
  fixed = fixed.replace(/([a-zA-Z-]+)=([^\s"']+)/g, '$1="$2"');

  return fixed;
}

// Inject API keys for placeholder endpoints
export function injectApiKeys(html: string, keys: Record<string, string>): string {
  let result = html;

  // Google Maps placeholder
  if (keys.googleMaps) {
    result = result.replace(
      /<iframe[^>]*src="https:\/\/www\.google\.com\/maps\/embed[^"]*"[^>]*>/gi,
      (match) => {
        return match.replace('API_KEY_PLACEHOLDER', keys.googleMaps);
      }
    );
  }

  // Other API key injections can be added here

  return result;
}

// Inject error boundary script
export function injectErrorBoundary(html: string): string {
  const errorBoundaryScript = `
<script>
(function() {
  window.addEventListener('error', function(e) {
    console.error('UI Error:', e.error);
    var container = document.getElementById('app') || document.body;
    if (!document.getElementById('error-boundary')) {
      var errorDiv = document.createElement('div');
      errorDiv.id = 'error-boundary';
      errorDiv.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#fee2e2;border:1px solid #ef4444;border-radius:8px;padding:16px;max-width:400px;z-index:9999;';
      errorDiv.innerHTML = '<div style="font-weight:600;color:#dc2626;margin-bottom:8px;">Something went wrong</div><div style="color:#7f1d1d;font-size:14px;">The application encountered an error. Please try refreshing.</div>';
      container.appendChild(errorDiv);
      setTimeout(function() { errorDiv.remove(); }, 5000);
    }
  });
})();
</script>
`;

  return html.replace("</body>", errorBoundaryScript + "</body>");
}

// Sanitize HTML for security
export function sanitizeHtml(html: string, config?: Partial<PostProcessorConfig>): string {
  const mergedConfig = { ...DefaultPostProcessorConfig, ...config };

  if (mergedConfig.sandbox) {
    // Basic sanitization
    let sanitized = html;

    // Remove dangerous attributes
    const dangerousAttrs = ["onerror", "onload", "onclick", "onmouseover", "onkeydown", "onfocus"];
    for (const attr of dangerousAttrs) {
      const regex = new RegExp(`${attr}=["'][^"']*["']`, "gi");
      sanitized = sanitized.replace(regex, "");
    }

    // Remove script tags (except those we injected)
    sanitized = sanitized.replace(/<script(?!\s+src=["']https?:\/\/)/gi, "<script");

    // Allow specific CDNs for scripts
    sanitized = sanitized.replace(
      /<script\s+src=["'](https?:\/\/(cdn\.)?tailwindcss\.com|https?:\/\/cdn\.jsdelivr\.net\/.*?\.js)["'][^>]*><\/script>/gi,
      (match) => match
    );

    // Remove event handlers from tags
    sanitized = sanitized.replace(/\s+on\w+="[^"]*"/g, "");

    return sanitized;
  }

  return html;
}

// Complete post-processing pipeline
export function postProcess(
  rawOutput: string,
  config: PostProcessorConfig = {}
): string {
  const mergedConfig = { ...DefaultPostProcessorConfig, ...config };

  // Step 1: Extract HTML from markdown
  let processed = extractHtmlFromMarkdown(rawOutput);

  // Step 2: Fix syntax errors
  if (mergedConfig.fixSyntaxErrors) {
    processed = fixSyntaxErrors(processed);
  }

  // Step 3: Inject API keys
  if (mergedConfig.injectApiKeys) {
    processed = injectApiKeys(processed, mergedConfig.injectApiKeys);
  }

  // Step 4: Inject error boundary
  if (mergedConfig.injectErrorBoundary) {
    processed = injectErrorBoundary(processed);
  }

  // Step 5: Sanitize
  processed = sanitizeHtml(processed, mergedConfig);

  return processed;
}

// Validate generated HTML
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateHtml(html: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for basic structure
  if (!html.includes("<!DOCTYPE")) {
    warnings.push("Missing DOCTYPE declaration");
  }
  if (!html.includes("<html")) {
    errors.push("Missing <html> tag");
  }
  if (!html.includes("<head")) {
    warnings.push("Missing <head> tag");
  }
  if (!html.includes("<body")) {
    errors.push("Missing <body> tag");
  }

  // Check for balanced tags
  const tagPairs = [
    { open: "<div", close: "</div>" },
    { open: "<span", close: "</span>" },
    { open: "<table", close: "</table>" },
    { open: "<ul", close: "</ul>" },
    { open: "<ol", close: "</ol>" },
    { open: "<form", close: "</form>" },
  ];

  for (const { open, close } of tagPairs) {
    const openCount = (html.match(new RegExp(open, "gi")) || []).length;
    const closeCount = (html.match(new RegExp(close, "gi")) || []).length;
    if (openCount !== closeCount) {
      errors.push(`Unbalanced tags: ${open} (${openCount}) vs ${close} (${closeCount})`);
    }
  }

  // Check for Tailwind CDN
  if (!html.includes("tailwindcss") && !html.includes("cdn.tailwindcss.com")) {
    warnings.push("Tailwind CSS not found - styling may not work");
  }

  // Check for script errors
  if (html.includes("eval(")) {
    warnings.push("Usage of eval() detected - potential security risk");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
