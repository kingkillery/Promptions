# Use Node.js 18 LTS as base image
FROM node:18-alpine AS base

# Install corepack to enable yarn package management
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy package.json, yarn.lock, and yarn config for better caching
COPY package.json yarn.lock .yarnrc.yml ./

# Copy all workspace package.json files (required for yarn workspaces)
COPY apps/promptions-chat/package.json ./apps/promptions-chat/
COPY apps/promptions-image/package.json ./apps/promptions-image/
COPY packages/promptions-llm/package.json ./packages/promptions-llm/
COPY packages/promptions-ui/package.json ./packages/promptions-ui/

# Install dependencies (now yarn can see all workspaces)
RUN yarn install

# Copy the rest of the code
COPY . .

# Build all packages and applications
RUN yarn build

# Production stage
FROM node:18-alpine AS production

# Install corepack
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy built applications from the base stage
COPY --from=base /app/apps/promptions-chat/dist /app/chat
COPY --from=base /app/apps/promptions-image/dist /app/image

# Copy the Node.js server script
COPY server.js ./

# Expose port 80
EXPOSE 80

# Set environment variable for the default port
ENV PORT=80

# Start the server
CMD ["node", "server.js"]
