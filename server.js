const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8080;
const CHAT_DIR = path.join(__dirname, 'chat');
const IMAGE_DIR = path.join(__dirname, 'image');

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