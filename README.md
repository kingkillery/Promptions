# Promptions Redux

A Yarn monorepo for the Promptions Redux project.

## Structure

- `apps/` - Applications and frontend projects
- `packages/` - Shared packages and libraries

## Getting Started

1. Install dependencies:

    ```bash
    yarn install
    ```

2. Build all packages:

    ```bash
    yarn build
    ```

3. Run tests:

    ```bash
    yarn test
    ```

4. Start development mode:
    ```bash
    yarn dev
    ```

## Workspace Commands

- `yarn workspaces foreach <command>` - Run a command in all workspaces
- `yarn workspace <workspace-name> <command>` - Run a command in a specific workspace
- `yarn workspaces list` - List all workspaces

## Package Manager

This project uses Yarn 4.9.1 with workspaces enabled.
