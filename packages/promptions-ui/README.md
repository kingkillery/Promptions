# @promptions-redux/promptions-ui

UI components and utilities for promptions-redux applications.

## Features

- React components for rendering LLM options
- Fluent UI integration
- TypeScript support
- Visual option sets for interactive chat interfaces

## Installation

```bash
npm install @promptions-redux/promptions-ui
```

## Usage

```typescript
import { MessageOptions, VisualOptionSet } from "@promptions-redux/promptions-ui";

// Use MessageOptions component to render interactive options
<MessageOptions
    options={options}
    messageId={messageId}
    set={updateFunction}
    disabled={false}
/>
```

## Dependencies

This package requires:

- React 18+
- @fluentui/react-components 9+
- @promptions-redux/promptions-llm

## License

MIT
