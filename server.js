const http = require('http');
const https = require('https');
const crypto = require('crypto');
const url = require('url');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8080;
const CHAT_DIR = path.join(__dirname, 'chat');
const IMAGE_DIR = path.join(__dirname, 'image');

// API keys from Cloud Run secrets or environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Authentication credentials from Cloud Run secrets (REQUIRED - no defaults)
const AUTH_USERNAME = process.env.AUTH_USERNAME;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

// Validate required authentication credentials on startup
if (!AUTH_USERNAME || !AUTH_PASSWORD) {
  console.error('SECURITY ERROR: AUTH_USERNAME and AUTH_PASSWORD environment variables are required.');
  console.error('Please set these environment variables before starting the server.');
  process.exit(1);
}

// Session management (in-memory for simplicity)
const sessions = new Map();
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession() {
  const token = generateSessionToken();
  sessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION,
  });
  return token;
}

function validateSession(token) {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function getSessionFromRequest(req) {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Check cookie
  const cookies = req.headers.cookie || '';
  const match = cookies.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

// Authentication check for protected routes
function requireAuth(req, res) {
  const token = getSessionFromRequest(req);
  if (!validateSession(token)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized', requiresAuth: true }));
    return false;
  }
  return true;
}

// Security: Prevent path traversal
function isSafePath(targetPath, rootDir) {
  const resolvedPath = path.resolve(targetPath);
  return resolvedPath.startsWith(path.resolve(rootDir));
}

function serveFile(req, res, filePath, rootDir) {
  // Security check
  if (!isSafePath(filePath, rootDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = getContentType(ext);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA Fallback: Only for HTML requests or extensionless paths
        // Prevents serving HTML for missing JS/CSS/Images
        const accept = req.headers.accept || '';
        if (accept.includes('text/html') || !path.extname(req.url)) {
          const indexPath = path.join(rootDir, 'index.html');
          fs.readFile(indexPath, (err2, content2) => {
            if (err2) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not Found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(content2);
            }
          });
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

function getContentType(ext) {
  switch (ext) {
    case '.js':
    case '.mjs': return 'text/javascript';
    case '.css': return 'text/css';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.ico': return 'image/x-icon';
    case '.json': return 'application/json';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    case '.ttf': return 'font/ttf';
    case '.map': return 'application/json';
    case '.txt': return 'text/plain';
    default: return 'text/html';
  }
}

// Helper to read request body
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Get provider config based on provider name
// Supports user-provided API keys via request body, falling back to server defaults
function getProviderConfig(provider, body, stream) {
  // Extract user-provided API keys from request body
  const userApiKeys = body.apiKeys || {};

  switch (provider) {
    case 'gemini': {
      const apiKey = userApiKeys.gemini || GEMINI_API_KEY;
      if (!apiKey) {
        return { error: 'Gemini API key not configured. Please add your API key in Settings.' };
      }
      // Gemini uses a different message format
      const contents = body.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      // Extract system instruction if present
      const systemMessage = body.messages.find(m => m.role === 'system');

      const postData = {
        contents,
        generationConfig: {
          temperature: body.temperature ?? 0.7,
          maxOutputTokens: body.max_tokens ?? 1000,
        }
      };

      if (systemMessage) {
        postData.systemInstruction = { parts: [{ text: systemMessage.content }] };
      }

      const model = body.model || 'gemini-2.0-flash';
      const streamSuffix = stream ? ':streamGenerateContent?alt=sse' : ':generateContent';

      return {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${model}${streamSuffix}&key=${apiKey}`,
        postData: JSON.stringify(postData),
        headers: {
          'Content-Type': 'application/json',
        },
      };
    }

    case 'openrouter': {
      const apiKey = userApiKeys.openrouter || OPENROUTER_API_KEY;
      if (!apiKey) {
        return { error: 'OpenRouter API key not configured. Please add your API key in Settings.' };
      }
      const postData = JSON.stringify({
        model: body.model || 'openai/gpt-4.1',
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 1000,
        stream: stream,
      });
      return {
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        postData,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://promptions.app',
          'X-Title': 'Promptions',
        },
      };
    }

    case 'openai':
    default: {
      const apiKey = userApiKeys.openai || OPENAI_API_KEY;
      if (!apiKey) {
        return { error: 'OpenAI API key not configured. Please add your API key in Settings.' };
      }
      const postData = JSON.stringify({
        model: body.model || 'gpt-4.1',
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 1000,
        stream: stream,
      });
      return {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        postData,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      };
    }
  }
}

// Proxy chat completions (non-streaming)
async function handleChatProxy(req, res) {
  try {
    const body = await readBody(req);
    const provider = body.provider || 'openai';

    const config = getProviderConfig(provider, body, false);

    if (config.error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: config.error }));
      return;
    }

    const options = {
      hostname: config.hostname,
      port: 443,
      path: config.path,
      method: 'POST',
      headers: {
        ...config.headers,
        'Content-Length': Buffer.byteLength(config.postData),
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      console.error('Proxy error:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy request failed' }));
    });

    proxyReq.write(config.postData);
    proxyReq.end();
  } catch (e) {
    console.error('Chat proxy error:', e);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

// Proxy streaming chat completions
async function handleChatStreamProxy(req, res) {
  try {
    const body = await readBody(req);
    const provider = body.provider || 'openai';

    const config = getProviderConfig(provider, body, true);

    if (config.error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: config.error }));
      return;
    }

    const options = {
      hostname: config.hostname,
      port: 443,
      path: config.path,
      method: 'POST',
      headers: {
        ...config.headers,
        'Content-Length': Buffer.byteLength(config.postData),
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      console.error('Stream proxy error:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy request failed' }));
    });

    proxyReq.write(config.postData);
    proxyReq.end();
  } catch (e) {
    console.error('Chat stream proxy error:', e);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

function buildA2UISystemPrompt(components) {
  const allowed = Array.isArray(components)
    ? components
      .map((c) => {
        const name = typeof c?.name === 'string' ? c.name : '';
        const desc = typeof c?.description === 'string' ? c.description : '';
        const category = typeof c?.category === 'string' ? c.category : '';
        return name ? `- ${name}${category ? ` (${category})` : ''}${desc ? `: ${desc}` : ''}` : null;
      })
      .filter(Boolean)
      .join('\n')
    : '';

  return `You are an API that emits UI using the A2UI protocol.

Output format:
- Output ONLY newline-delimited JSON (NDJSON).
- Every line MUST be a single JSON object.
- Do NOT wrap output in markdown fences, arrays, or extra text.

Each line must match one of these shapes:
{"type":"component","data":{"id":"...","type":"<AllowedComponentType>","props":{},"layout":{},"style":{},"children":[]}}
{"type":"update","id":"<componentId>","props":{}}
{"type":"remove","id":"<componentId>"}
{"type":"error","message":"...","recoverable":false}

Strict Mode Rules:
- Use ONLY allowed component types listed below. NO exceptions.
- Do NOT hallucinate component types or props that are not standard (e.g. no "valid" or "error" props unless specified).
- Generate stable, unique component ids (e.g. "ui-root", "ui-1", "ui-2").
- Keep props JSON-serializable.
- Keep EACH JSON object on ONE line (no pretty-print).
- For text content, ensure it is safe and semantic.

Allowed components:
${allowed || '- (none provided)'}
`;
}

function extractStreamText(provider, parsed) {
  // OpenAI / OpenRouter
  if (provider === 'openai' || provider === 'openrouter') {
    return parsed?.choices?.[0]?.delta?.content ?? '';
  }

  // Gemini
  if (provider === 'gemini') {
    return parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  return '';
}

function buildA2UIActionPrompt(action, components) {
  const allowed = Array.isArray(components)
    ? components
      .map((c) => {
        const name = typeof c?.name === 'string' ? c.name : '';
        const desc = typeof c?.description === 'string' ? c.description : '';
        const category = typeof c?.category === 'string' ? c.category : '';
        return name ? `- ${name}${category ? ` (${category})` : ''}${desc ? `: ${desc}` : ''}` : null;
      })
      .filter(Boolean)
      .join('\n')
    : '';

  return `You are an API that updates UI based on user actions using the A2UI protocol.

A user action was triggered:
- Component ID: ${action.componentId}
- Action type: ${action.type}
- Payload: ${JSON.stringify(action.payload || {})}

Output format:
- Output ONLY newline-delimited JSON (NDJSON).
- Every line MUST be a single JSON object.
- Do NOT wrap output in markdown fences, arrays, or extra text.

Each line must match one of these shapes:
{"type":"component","data":{"id":"...","type":"<AllowedComponentType>","props":{},"layout":{},"style":{},"children":[]}}
{"type":"update","id":"<componentId>","props":{}}
{"type":"remove","id":"<componentId>"}
{"type":"error","message":"...","recoverable":false}

Rules:
- Respond to the action by updating, adding, or removing components as appropriate.
- Use ONLY allowed component types listed below.
- Keep EACH JSON object on ONE line (no pretty-print).

Allowed components:
${allowed || '- (none provided)'}
`;
}

// A2UI endpoint - streams NDJSON messages describing a UI.
async function handleA2UI(req, res) {
  try {
    const body = await readBody(req);

    // Action with streaming response - bi-directional A2UI
    if (body && body.action && body.components) {
      const provider = body.provider || 'openai';
      const action = body.action;

      const actionPrompt = buildA2UIActionPrompt(action, body.components);

      const llmBody = {
        ...body,
        temperature: body.temperature ?? 0.2,
        max_tokens: body.max_tokens ?? 800,
        messages: [
          { role: 'system', content: actionPrompt },
          { role: 'user', content: `Handle this ${action.type} action on component ${action.componentId}` },
        ],
      };

      const config = getProviderConfig(provider, llmBody, true);

      if (config.error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: config.error }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const options = {
        hostname: config.hostname,
        port: 443,
        path: config.path,
        method: 'POST',
        headers: {
          ...config.headers,
          'Content-Length': Buffer.byteLength(config.postData),
        },
      };

      let sseBuffer = '';
      let outputBuffer = '';

      const proxyReq = https.request(options, (proxyRes) => {
        proxyRes.setEncoding('utf8');

        proxyRes.on('data', (chunk) => {
          sseBuffer += chunk;
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const data = trimmed.slice(5).trim();
            if (!data) continue;
            if (data === '[DONE]') {
              if (outputBuffer.includes('\n')) {
                const outLines = outputBuffer.split('\n');
                outputBuffer = outLines.pop() || '';
                for (const outLine of outLines) {
                  const candidate = outLine.trim();
                  if (candidate) res.write(candidate + '\n');
                }
              }
              res.end();
              return;
            }

            let parsed;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }

            const delta = extractStreamText(provider, parsed);
            if (!delta) continue;

            outputBuffer += delta;

            while (outputBuffer.includes('\n')) {
              const idx = outputBuffer.indexOf('\n');
              const candidate = outputBuffer.slice(0, idx).trim();
              outputBuffer = outputBuffer.slice(idx + 1);

              if (!candidate) continue;

              try {
                JSON.parse(candidate);
                res.write(candidate + '\n');
              } catch {
                outputBuffer = candidate + '\n' + outputBuffer;
                break;
              }
            }
          }
        });

        proxyRes.on('end', () => {
          res.end();
        });
      });

      req.on('close', () => {
        proxyReq.destroy();
      });

      proxyReq.on('error', (e) => {
        console.error('A2UI action proxy error:', e);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ error: 'A2UI action proxy request failed' }));
      });

      proxyReq.write(config.postData);
      proxyReq.end();
      return;
    }

    // Action-only posts (fire-and-forget, no components provided)
    if (body && body.action) {
      res.writeHead(204);
      res.end();
      return;
    }

    const provider = body.provider || 'openai';
    const message = typeof body.message === 'string' ? body.message : '';

    if (!message) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing "message"' }));
      return;
    }

    const systemPrompt = buildA2UISystemPrompt(body.components);

    const llmBody = {
      ...body,
      temperature: body.temperature ?? 0.2,
      max_tokens: body.max_tokens ?? 1200,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    };

    const config = getProviderConfig(provider, llmBody, true);

    if (config.error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: config.error }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const options = {
      hostname: config.hostname,
      port: 443,
      path: config.path,
      method: 'POST',
      headers: {
        ...config.headers,
        'Content-Length': Buffer.byteLength(config.postData),
      },
    };

    let sseBuffer = '';
    let outputBuffer = '';

    const proxyReq = https.request(options, (proxyRes) => {
      proxyRes.setEncoding('utf8');

      proxyRes.on('data', (chunk) => {
        sseBuffer += chunk;
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();
          if (!data) continue;
          if (data === '[DONE]') {
            // Flush any remaining complete lines
            if (outputBuffer.includes('\n')) {
              const outLines = outputBuffer.split('\n');
              outputBuffer = outLines.pop() || '';
              for (const outLine of outLines) {
                const candidate = outLine.trim();
                if (candidate) res.write(candidate + '\n');
              }
            }
            res.end();
            return;
          }

          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

          const delta = extractStreamText(provider, parsed);
          if (!delta) continue;

          outputBuffer += delta;

          while (outputBuffer.includes('\n')) {
            const idx = outputBuffer.indexOf('\n');
            const candidate = outputBuffer.slice(0, idx).trim();
            outputBuffer = outputBuffer.slice(idx + 1);

            if (!candidate) {
              continue;
            }

            try {
              JSON.parse(candidate);
              res.write(candidate + '\n');
            } catch {
              // Not complete JSON yet; put it back and wait for more
              outputBuffer = candidate + '\n' + outputBuffer;
              break;
            }
          }
        }
      });

      proxyRes.on('end', () => {
        res.end();
      });
    });

    req.on('close', () => {
      proxyReq.destroy();
    });

    proxyReq.on('error', (e) => {
      console.error('A2UI proxy error:', e);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ error: 'A2UI proxy request failed' }));
    });

    proxyReq.write(config.postData);
    proxyReq.end();
  } catch (e) {
    console.error('A2UI error:', e);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

// Get image provider config based on provider name
// Supports user-provided API keys via request body, falling back to server defaults
function getImageProviderConfig(provider, body) {
  // Extract user-provided API keys from request body
  const userApiKeys = body.apiKeys || {};

  switch (provider) {
    case 'gemini': {
      const apiKey = userApiKeys.gemini || GEMINI_API_KEY;
      if (!apiKey) {
        return { error: 'Gemini API key not configured. Please add your API key in Settings.' };
      }
      // Gemini Imagen API
      const model = body.model || 'imagen-3.0-generate-001';
      const postData = JSON.stringify({
        instances: [{ prompt: body.prompt }],
        parameters: {
          sampleCount: body.n ?? 1,
          aspectRatio: body.aspectRatio || '1:1',
        }
      });
      return {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${model}:predict?key=${apiKey}`,
        postData,
        headers: {
          'Content-Type': 'application/json',
        },
        transformResponse: (data) => {
          // Transform Gemini response to match OpenAI format
          try {
            const parsed = JSON.parse(data);
            if (parsed.predictions && parsed.predictions.length > 0) {
              return JSON.stringify({
                data: parsed.predictions.map(p => ({
                  b64_json: p.bytesBase64Encoded,
                }))
              });
            }
          } catch (e) {
            console.error('Gemini response parse error:', e);
          }
          return data;
        }
      };
    }

    case 'openrouter': {
      const apiKey = userApiKeys.openrouter || OPENROUTER_API_KEY;
      if (!apiKey) {
        return { error: 'OpenRouter API key not configured. Please add your API key in Settings.' };
      }
      const postData = JSON.stringify({
        model: body.model || 'openai/dall-e-3',
        prompt: body.prompt,
        n: body.n ?? 1,
        size: body.size || '1024x1024',
        quality: body.quality || 'standard',
        response_format: body.response_format || 'b64_json',
      });
      return {
        hostname: 'openrouter.ai',
        path: '/api/v1/images/generations',
        postData,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://promptions.app',
          'X-Title': 'Promptions',
        },
      };
    }

    case 'openai':
    default: {
      const apiKey = userApiKeys.openai || OPENAI_API_KEY;
      if (!apiKey) {
        return { error: 'OpenAI API key not configured. Please add your API key in Settings.' };
      }
      const postData = JSON.stringify({
        model: body.model || 'dall-e-3',
        prompt: body.prompt,
        n: body.n ?? 1,
        size: body.size || '1024x1024',
        quality: body.quality || 'standard',
        response_format: body.response_format || 'b64_json',
      });
      return {
        hostname: 'api.openai.com',
        path: '/v1/images/generations',
        postData,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      };
    }
  }
}

// Proxy image generation to multiple providers
async function handleImageProxy(req, res) {
  try {
    const body = await readBody(req);
    const provider = body.provider || 'openai';

    const config = getImageProviderConfig(provider, body);

    if (config.error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: config.error }));
      return;
    }

    const options = {
      hostname: config.hostname,
      port: 443,
      path: config.path,
      method: 'POST',
      headers: {
        ...config.headers,
        'Content-Length': Buffer.byteLength(config.postData),
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => data += chunk);
      proxyRes.on('end', () => {
        // Transform response if needed
        const responseData = config.transformResponse ? config.transformResponse(data) : data;
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(responseData);
      });
    });

    proxyReq.on('error', (e) => {
      console.error('Image proxy error:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy request failed' }));
    });

    proxyReq.write(config.postData);
    proxyReq.end();
  } catch (e) {
    console.error('Image proxy error:', e);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

// Handle login
async function handleLogin(req, res) {
  try {
    const body = await readBody(req);
    const { username, password } = body;

    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      const token = createSession();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION / 1000}`,
      });
      res.end(JSON.stringify({ success: true, token }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid credentials' }));
    }
  } catch (e) {
    console.error('Login error:', e);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

// Handle logout
async function handleLogout(req, res) {
  const token = getSessionFromRequest(req);
  if (token) {
    sessions.delete(token);
  }
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
  });
  res.end(JSON.stringify({ success: true }));
}

// Check auth status
function handleAuthCheck(req, res) {
  const token = getSessionFromRequest(req);
  const isAuthenticated = validateSession(token);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ authenticated: isAuthenticated }));
}

// Check which API keys are configured on the server
function handleApiKeysCheck(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    serverHasKeys: {
      openai: !!OPENAI_API_KEY,
      gemini: !!GEMINI_API_KEY,
      openrouter: !!OPENROUTER_API_KEY,
    }
  }));
}

function routeHandler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Auth endpoints (not protected)
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    return handleLogin(req, res);
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    return handleLogout(req, res);
  }

  if (pathname === '/api/auth/check' && req.method === 'GET') {
    return handleAuthCheck(req, res);
  }

  if (pathname === '/api/keys/check' && req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    return handleApiKeysCheck(req, res);
  }

  // Protected API Proxy endpoints
  if (pathname === '/api/chat' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    return handleChatProxy(req, res);
  }

  if (pathname === '/api/chat/stream' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    return handleChatStreamProxy(req, res);
  }

  if (pathname === '/api/a2ui' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    return handleA2UI(req, res);
  }

  if (pathname === '/api/images/generate' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    return handleImageProxy(req, res);
  }

  // Image app
  if (pathname.startsWith('/image')) {
    // Strip /image prefix
    let relativePath = pathname.replace(/^\/image/, '') || '/';
    if (relativePath === '/') relativePath = '/index.html';
    const filePath = path.join(IMAGE_DIR, relativePath);
    return serveFile(req, res, filePath, IMAGE_DIR);
  }

  // Chat app (Default)
  let relativePath = pathname.startsWith('/chat')
    ? pathname.replace(/^\/chat/, '') || '/'
    : pathname;

  if (relativePath === '/') relativePath = '/index.html';
  const filePath = path.join(CHAT_DIR, relativePath);
  return serveFile(req, res, filePath, CHAT_DIR);
}

const server = http.createServer(routeHandler);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Promptions server running on port ${PORT}`);
  console.log('Chat app: http://localhost/chat');
  console.log('Image app: http://localhost/image');
});