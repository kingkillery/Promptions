# Use Node.js 18 LTS as base image
FROM node:18-alpine AS base

# Install corepack to enable yarn package management
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy package.json and yarn.lock first for better caching
COPY package.json yarn.lock* ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the rest of the code
COPY . .

# Build all packages and applications
RUN yarn build

# Production stage
FROM node:18-alpine AS production

# Install corepack
RUN corepack enable

# Install a simple HTTP server to serve the static files
RUN npm install -g http-server

# Set working directory
WORKDIR /app

# Copy built applications from the base stage
COPY --from=base /app/apps/promptions-chat/dist /app/chat
COPY --from=base /app/apps/promptions-image/dist /app/image

# Create a simple script to serve both applications
COPY <<EOF /app/server.js
const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const {exec} = require('child_process');

const PORT = 80;
const CHAT_DIR = '/app/chat';
const IMAGE_DIR = '/app/image';

function serveFile(res, filePath, contentType) {
  const fullPath = path.join(process.cwd(), filePath);
  
  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // If file not found, try index.html
        const indexPath = path.join(path.dirname(fullPath), 'index.html');
        fs.readFile(indexPath, (err, content) => {
          if (err) {
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.end('Not Found');
          } else {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(content);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
    } else {
      res.writeHead(200, {'Content-Type': contentType});
      res.end(content);
    }
  });
}

function routeHandler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  
  // Set up CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Route to the appropriate app
  if (parsedUrl.pathname.startsWith('/chat') || parsedUrl.pathname === '/') {
    // Default route goes to chat
    let filePath = parsedUrl.pathname === '/' ? '/chat/' : parsedUrl.pathname;
    if (filePath === '/chat') filePath = '/chat/';
    
    // Remove the /chat prefix for file lookup
    const relativePath = filePath.replace('/chat', '');
    const fileExtension = path.extname(relativePath);
    
    let contentType = 'text/html';
    if (fileExtension === '.js') contentType = 'text/javascript';
    else if (fileExtension === '.css') contentType = 'text/css';
    else if (fileExtension === '.png') contentType = 'image/png';
    else if (fileExtension === '.jpg') contentType = 'image/jpeg';
    
    serveFile(res, path.join(CHAT_DIR, relativePath), contentType);
  } else if (parsedUrl.pathname.startsWith('/image')) {
    // Image generation app
    let filePath = parsedUrl.pathname;
    if (filePath === '/image') filePath = '/image/';
    
    // Remove the /image prefix for file lookup
    const relativePath = filePath.replace('/image', '');
    const fileExtension = path.extname(relativePath);
    
    let contentType = 'text/html';
    if (fileExtension === '.js') contentType = 'text/javascript';
    else if (fileExtension === '.css') contentType = 'text/css';
    else if (fileExtension === '.png') contentType = 'image/png';
    else if (fileExtension === '.jpg') contentType = 'image/jpeg';
    
    serveFile(res, path.join(IMAGE_DIR, relativePath), contentType);
  } else {
    // API proxy endpoint - forwards to an external API
    if (parsedUrl.pathname.startsWith('/api/')) {
      const proxyUrl = \`https://api.openai.com\${parsedUrl.pathname.replace('/api', '')}\${parsedUrl.search}\`;
      
      // Forward the request
      const proxyReq = http.request(proxyUrl, {
        method: req.method,
        headers: {
          ...req.headers,
          host: 'api.openai.com',
          origin: 'https://api.openai.com',
          // Pass API key from query params or env var
          // Note: In production, you should handle API keys securely
        }
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });
      
      proxyReq.on('error', (err) => {
        console.error('Proxy error:', err);
        res.writeHead(500, {'Content-Type': 'text/plain'});
        res.end('Proxy Error');
      });
      
      req.pipe(proxyReq);
      return;
    }
    
    // 404 for other routes
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not Found');
  }
}

const server = http.createServer(routeHandler);
server.listen(PORT, '0.0.0.0', () => {
  console.log(\`Promptions server running on port \${PORT}\`);
  console.log(\`Chat app: http://localhost/chat\`);
  console.log(\`Image app: http://localhost/image\`);
});
EOF

# Make the server script executable
RUN chmod +x /app/server.js

# Expose port 80
EXPOSE 80

# Set environment variable for the default port
ENV PORT=80

# Start the server
CMD ["node", "server.js"]