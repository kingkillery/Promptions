# =============================================================================
# Stage 1: Dependencies - Install all dependencies for caching
# =============================================================================
FROM node:18-alpine AS deps

# Install corepack to enable yarn package management
RUN corepack enable

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json yarn.lock .yarnrc.yml ./

# Copy all workspace package.json files (required for yarn workspaces)
COPY apps/promptions-chat/package.json ./apps/promptions-chat/
COPY apps/promptions-image/package.json ./apps/promptions-image/
COPY packages/promptions-llm/package.json ./packages/promptions-llm/
COPY packages/promptions-ui/package.json ./packages/promptions-ui/

# Install dependencies with frozen lockfile for reproducibility
RUN yarn install --immutable

# =============================================================================
# Stage 2: Builder - Build all packages and applications
# =============================================================================
FROM node:18-alpine AS builder

RUN corepack enable

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/yarn.lock ./yarn.lock
COPY --from=deps /app/.yarnrc.yml ./.yarnrc.yml

# Copy workspace package.json files
COPY --from=deps /app/apps/promptions-chat/package.json ./apps/promptions-chat/
COPY --from=deps /app/apps/promptions-image/package.json ./apps/promptions-image/
COPY --from=deps /app/packages/promptions-llm/package.json ./packages/promptions-llm/
COPY --from=deps /app/packages/promptions-ui/package.json ./packages/promptions-ui/

# Copy source code
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.json nx.json ./

# Build all packages and applications
RUN yarn build

# =============================================================================
# Stage 3: Production - Minimal runtime image
# =============================================================================
FROM node:18-alpine AS production

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 promptions

WORKDIR /app

# Copy only the built assets and server
COPY --from=builder --chown=promptions:nodejs /app/apps/promptions-chat/dist ./chat
COPY --from=builder --chown=promptions:nodejs /app/apps/promptions-image/dist ./image
COPY --chown=promptions:nodejs server.js ./

# Switch to non-root user
USER promptions

# Expose port (configurable via PORT env var)
EXPOSE 8080

# Environment variables with secure defaults
ENV PORT=8080 \
    NODE_ENV=production

# Health check - verify server is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/api/auth/check', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the server
CMD ["node", "server.js"]
