# Research Prompt: Advancing A2UI Realtime UI Generation

## Current State

Our A2UI protocol enables AI-to-UI communication via NDJSON streaming. Implemented: 12 components (Text, Heading, Button, TextInput, Image, KeyValueList, Card, Alert, Badge, Table, Checkbox, Select, Progress), FSM-based streaming (idle→preparing→streaming→complete), flex layout system, Zod validation, bi-directional actions.

Key files: `packages/promptions-ui/src/a2ui/protocol.ts`, `defaultComponents.tsx`, `A2UIProvider.tsx`, `streamParser.ts`, `apps/promptions-chat/src/machine/streamingUX.ts`, `server.js` (buildA2UISystemPrompt, buildA2UIActionPrompt).

## Research Objectives

### 1. Advanced Components
- Data Viz: charts, graphs, maps, timelines, calendars, Gantt, heatmaps
- Complex Forms: multi-step wizards, validation, conditional logic
- Rich Content: code blocks, markdown, math/LaTeX
- Navigation: tabs, breadcrumbs, drawers, modals, tooltips
- Media: video, audio, carousels, galleries
- Layouts: masonry, grid, responsive breakpoints, container queries

### 2. Streaming & State
- Optimistic updates before server confirmation
- Partial streaming: render as data arrives
- Error recovery: boundaries, retry streams
- Suspense integration: loading states, skeletons
- Offline support: IndexedDB caching, background sync

### 3. AI-Assisted UI
- Component discovery: semantic descriptions, examples
- Prop inference: AI guessing valid combinations
- Layout suggestions: AI recommending arrangements
- Context awareness: conversation history usage
- Fallback handling: invalid A2UI responses

### 4. Accessibility & i18n
- WCAG: ARIA live regions, keyboard nav
- i18n: string IDs vs translated text
- Screen readers: announcing streaming updates
- Reduced motion: prefers-reduced-motion
- High contrast: theme variables

### 5. Performance
- Virtualization: large lists, windowing
- Image optimization: lazy loading, blurhash
- Bundle impact: acceptable component count
- Streaming: backpressure, chunk sizes

### 6. Design System
- Design tokens: mapping to design system
- Theming: light/dark, custom themes
- Typography scale: font size selection
- Spacing scale: spacing system understanding

### 7. Developer Experience
- Visual debugger: real-time stream view
- Schema docs: auto-generated from Zod
- Component preview: isolated testing
- Stream replay: conversation replay

### 8. Security
- Input sanitization: XSS prevention
- Resource limits: max components, depth
- CSP: iframe considerations
- Rate limiting: abuse prevention

## Specific Research Questions

1. What features should A2UI v2 include? (schema versioning, plugins)
2. How do OpenAI's GPTs & Actions handle UI generation?
3. What patterns work for Vercel AI SDK Generative UI?
4. When is raw HTML/JS better than declarative components? (Google GenUI)
5. What makes good AI-readable component descriptions? (Tambo AI patterns)
6. How do LangChain/LlamaIndex agents handle tool outputs as UI?
7. What UI generation patterns exist in Figma/design-to-code?
8. How would A2UI work for multi-user real-time collaboration?

## Deliverable Format

1. Executive Summary - key recommendations
2. Category Analysis - deep dive per area
3. Implementation Priority - High/Medium/Low with rationale
4. Code Examples - pseudocode for promising patterns
5. Library Recommendations - specific packages
6. Competitive Analysis - how others solve these
7. Proposed A2UI Extensions - specific protocol changes
8. Research Links - key articles, papers, repos

Focus on actionable insights for next 3-6 months implementation.
