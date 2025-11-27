const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 80;
const CHAT_DIR = path.join(__dirname, 'chat');
const IMAGE_DIR = path.join(__dirname, 'image');

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        const indexPath = path.join(path.dirname(filePath), 'index.html');
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
      return 'text/javascript';
    case '.css':
      return 'text/css';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.ico':
      return 'image/x-icon';
    case '.json':
      return 'application/json';
    default:
      return 'text/html';
  }
}

function routeHandler(req, res) {
  const parsedUrl = url.parse(req.url, true);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Chat app (default)
  if (parsedUrl.pathname === '/' || parsedUrl.pathname.startsWith('/chat')) {
    let relativePath = parsedUrl.pathname === '/' ? '/' : parsedUrl.pathname.replace('/chat', '') || '/';
    if (relativePath === '/') {
      relativePath = '/index.html';
    }
    const filePath = path.join(CHAT_DIR, relativePath);
    const ext = path.extname(filePath);
    return serveFile(res, filePath, getContentType(ext));
  }

  // Image app
  if (parsedUrl.pathname.startsWith('/image')) {
    let relativePath = parsedUrl.pathname.replace('/image', '') || '/';
    if (relativePath === '/') {
      relativePath = '/index.html';
    }
    const filePath = path.join(IMAGE_DIR, relativePath);
    const ext = path.extname(filePath);
    return serveFile(res, filePath, getContentType(ext));
  }

  // 404 fallback
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

const server = http.createServer(routeHandler);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Promptions server running on port ${PORT}`);
  console.log('Chat app: http://localhost/chat');
  console.log('Image app: http://localhost/image');
});