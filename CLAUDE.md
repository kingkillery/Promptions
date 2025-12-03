# Promptions

Monorepo for Promptions chat and image generation apps.

## Architecture

- `server.js` - Node.js server that serves static files and proxies API requests
- `apps/promptions-chat` - Chat interface (Vite + React + Fluent UI)
- `apps/promptions-image` - Image generation interface (Vite + React + Fluent UI)
- `packages/promptions-ui` - Shared UI components

## Running Locally (Full Stack)

**IMPORTANT**: When testing, always run the full stack (not just Vite dev server).

### 1. Build the apps first
```bash
yarn build
```

### 2. Set environment variables
Required env vars:
- `AUTH_USERNAME` - Login username
- `AUTH_PASSWORD` - Login password
- `OPENAI_API_KEY` - For OpenAI models (optional)
- `GEMINI_API_KEY` - For Gemini models (optional)
- `OPENROUTER_API_KEY` - For OpenRouter models (optional)

### 3. Run the server
```bash
# Windows PowerShell
$env:AUTH_USERNAME="admin"; $env:AUTH_PASSWORD="test123"; node server.js

# Or use a .env loader
```

### 4. Access the apps
- Chat: http://localhost:8080/chat
- Image: http://localhost:8080/image

## Development Workflow

For rapid frontend iteration, you can run Vite dev server with API proxy:
```bash
cd apps/promptions-chat
yarn dev
```
But note: auth won't work without the backend server running.

## Deployment

Deployed to Google Cloud Run. Credentials stored in Secret Manager:
- `AUTH_USERNAME`, `AUTH_PASSWORD` - Login credentials
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY` - API keys

Build command: `gcloud builds submit --config=cloudbuild.yaml`
