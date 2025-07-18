# Promptions Redux

A TypeScript monorepo for AI-powered applications built with React, Fluent UI, and OpenAI integration. This project includes chat and image generation interfaces along with shared UI components and LLM utilities.

## 🏗️ Project Structure

```
promptions-redux/
├── apps/                           # Frontend applications
│   ├── promptions-chat/           # Chat interface (port 3003)
│   └── promptions-image/          # Image generation interface (port 3004)
├── packages/                      # Shared libraries
│   ├── promptions-llm/            # LLM utilities and integrations
│   └── promptions-ui/             # Shared React UI components
├── package.json                   # Root package configuration
├── nx.json                        # NX build system configuration
└── tsconfig.json                  # TypeScript configuration
```

## 📋 Prerequisites

Before building and running this project, ensure you have:

- **Node.js** (v18 or higher)
- **Corepack** (included with Node.js v16.10+, enables automatic Yarn management)
- **TypeScript** (v5.0 or higher)
- **OpenAI API Key** (for chat and image generation features)

### Setting up Corepack (Recommended)

This project uses **Yarn 4.9.1** which is automatically managed via corepack. No manual Yarn installation needed!

```bash
# Enable corepack (if not already enabled)
corepack enable

# Verify corepack is working (should show yarn 4.9.1)
corepack yarn --version
```

> **Note:** Corepack is included with Node.js v16.10+ but may need to be enabled. If you're using an older Node.js version, you can install corepack separately: `npm install -g corepack`

### Alternative: Manual Yarn Installation

If you prefer not to use corepack:

```bash
# Install Yarn globally
npm install -g yarn@4.9.1
```

## 🚀 Quick Start

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd promptions-redux

# Enable corepack (if not already enabled)
corepack enable

# Install all dependencies across the monorepo
# Corepack will automatically use the correct Yarn version (4.9.1)
yarn install
```

### 2. Build the Project

```bash
# Build all packages and applications
yarn build
```

This command will:

- Build shared packages (`promptions-llm`, `promptions-ui`) first
- Then build the applications (`promptions-chat`, `promptions-image`)
- Respect dependency order using NX dependency graph

### 3. Development Mode

```bash
# Start all applications in development mode
yarn workspace @promptions-redux/promptions-chat dev &
yarn workspace @promptions-redux/promptions-image dev
```

Or start individual applications:

```bash
# Chat application (runs on http://localhost:3003)
yarn workspace @promptions-redux/promptions-chat dev

# Image generation application (runs on http://localhost:3004)
yarn workspace @promptions-redux/promptions-image dev
```

## 🔧 Detailed Build Instructions

### Building Individual Components

#### Shared Packages (Build Order Matters)

1. **Build LLM utilities first:**

    ```bash
    yarn workspace @promptions-redux/promptions-llm build
    ```

2. **Build UI components (depends on LLM package):**
    ```bash
    yarn workspace @promptions-redux/promptions-ui build
    ```

#### Applications

3. **Build Chat application:**

    ```bash
    yarn workspace @promptions-redux/promptions-chat build
    ```

4. **Build Image application:**
    ```bash
    yarn workspace @promptions-redux/promptions-image build
    ```

### Watch Mode for Development

For active development, use watch mode to automatically rebuild on changes:

```bash
# Watch shared packages
yarn workspace @promptions-redux/promptions-llm build:watch &
yarn workspace @promptions-redux/promptions-ui build:watch &

# Then start the applications in dev mode
yarn workspace @promptions-redux/promptions-chat dev
```

## 🛠️ Available Commands

### Root Level Commands

| Command               | Description                                      |
| --------------------- | ------------------------------------------------ |
| `yarn build`          | Build all packages and applications              |
| `yarn typecheck`      | Run TypeScript type checking across all projects |
| `yarn clean`          | Clean all build artifacts                        |
| `yarn prettier:check` | Check code formatting                            |
| `yarn prettier:write` | Format code                                      |

### Individual Package Commands

Each package supports these commands:

| Command                                   | Description                          |
| ----------------------------------------- | ------------------------------------ |
| `yarn workspace <package-name> build`     | Build specific package               |
| `yarn workspace <package-name> typecheck` | Type check specific package          |
| `yarn workspace <package-name> clean`     | Clean build artifacts                |
| `yarn workspace <package-name> dev`       | Start development server (apps only) |
| `yarn workspace <package-name> preview`   | Preview production build (apps only) |

### Package Names

- `@promptions-redux/promptions-chat`
- `@promptions-redux/promptions-image`
- `@promptions-redux/promptions-llm`
- `@promptions-redux/promptions-ui`

## 🏃‍♂️ Running Applications

### Chat Application

```bash
yarn workspace @promptions-redux/promptions-chat dev
# Runs on http://localhost:3003
```

### Image Generation Application

```bash
yarn workspace @promptions-redux/promptions-image dev
# Runs on http://localhost:3004
```

### Production Build Preview

```bash
# Build and preview chat app
yarn workspace @promptions-redux/promptions-chat build
yarn workspace @promptions-redux/promptions-chat preview

# Build and preview image app
yarn workspace @promptions-redux/promptions-image build
yarn workspace @promptions-redux/promptions-image preview
```

## 🔍 Troubleshooting

### Common Issues

1. **Build fails with dependency errors:**

    ```bash
    # Clean and rebuild everything
    yarn clean
    yarn install
    yarn build
    ```

2. **TypeScript errors:**

    ```bash
    # Run type checking to see detailed errors
    yarn typecheck
    ```

3. **Workspace dependency issues:**

    ```bash
    # List all workspaces to verify structure
    yarn workspaces list

    # Check specific workspace info
    yarn workspace <package-name> info
    ```

4. **Port conflicts:**
    - Chat app uses port 3003
    - Image app uses port 3004
    - Ensure these ports are available or modify in respective `package.json` files

### Build Order Dependencies

The build system (NX) automatically handles dependencies, but manual builds should follow this order:

1. `promptions-llm` (no dependencies)
2. `promptions-ui` (depends on promptions-llm)
3. `promptions-chat` (depends on promptions-ui)
4. `promptions-image` (depends on promptions-ui)

## 🌐 Environment Setup

### OpenAI Integration

Both applications require OpenAI API access. Set up your environment:

1. Create an OpenAI account and get an API key
2. Configure the API key in your application settings
3. Ensure you have appropriate usage limits for your intended use

### Development Environment

- **IDE:** VS Code recommended with TypeScript and React extensions
- **Browser:** Modern browser with React DevTools extension
- **Terminal:** PowerShell, Command Prompt, or any terminal with Node.js access

## 📦 Package Manager

This project uses **Yarn 4.9.1** with workspaces enabled. The package manager version is locked via the `packageManager` field in `package.json` and automatically managed by **corepack** to ensure consistency across development environments.

### Corepack Benefits

- **Automatic Version Management**: No need to manually install or update Yarn
- **Version Consistency**: Everyone uses the exact same Yarn version (4.9.1)
- **Zero Configuration**: Works out of the box with Node.js v16.10+

### Useful Yarn Commands

```bash
# List all workspaces
yarn workspaces list

# Run command in all workspaces
yarn workspaces foreach <command>

# Add dependency to specific workspace
yarn workspace <package-name> add <dependency>

# Remove dependency from specific workspace
yarn workspace <package-name> remove <dependency>
```

### Troubleshooting Corepack

If you encounter issues with corepack:

```bash
# Disable and re-enable corepack
corepack disable
corepack enable

# Check if the correct version is being used
corepack yarn --version  # Should show 4.9.1

# If needed, prepare the specific version
corepack prepare yarn@4.9.1 --activate
```
