# Kintsu

An AI companion that helps you understand your attachment patterns and communicate better in relationships. Built on attachment theory — the science of how we connect.

The name comes from **kintsugi**, the Japanese art of repairing broken pottery with gold. The idea: relationships aren't weakened by their cracks — they're made more beautiful when you understand and mend them.

## What it does

- **Attachment style awareness** — identifies whether you lean anxious or avoidant and tailors guidance accordingly
- **Knowledge-grounded conversations** — responses are backed by RAG over attachment theory literature, not generic advice
- **Persistent memory** — remembers your relationship context, partner dynamics, and past conversations across sessions
- **Memory processing pipeline** — extracts and links episodic, semantic, and procedural memories with temporal validity
- **Concept network** — maps attachment theory concepts (triggers, behaviors, strategies) and their relationships

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TanStack Start (SSR), TanStack Router |
| Styling | Tailwind CSS v4, shadcn/ui |
| AI | Vercel AI SDK, OpenRouter (Kimi-2.5), OpenAI embeddings |
| Backend | Convex (reactive database, vector search, scheduled functions) |
| Infra | Cloudflare Workers via Alchemy |
| Monorepo | Bun workspaces |

## Project structure

```
kintsu/
├── apps/web/                  # React frontend
│   ├── src/components/chat/   # Chat interface
│   ├── src/components/ui/     # Component library
│   ├── src/lib/agents/        # AI agent definition & tools
│   ├── src/routes/            # Pages + API routes
│   └── src/routes/api/        # Chat streaming & transcription endpoints
├── packages/backend/          # Convex backend
│   └── convex/                # Schema, queries, mutations, actions
├── packages/infra/            # Cloudflare deployment config
└── scripts/                   # Book ingestion pipeline
```

## Getting started

```bash
# Install dependencies
bun install

# Set up Convex backend
bun run dev:setup

# Copy env vars from packages/backend/.env.local to apps/web/.env
# You'll need: CONVEX_URL, OPENROUTER_API_KEY, OPENAI_API_KEY

# Start everything
bun run dev
```

Open [http://localhost:3001](http://localhost:3001).

### Ingest knowledge base

```bash
# Place your source text in books/attached_content.txt
bun run ingest:book
```

This chunks the text, generates embeddings via OpenAI, and stores them in Convex for vector search.

## How the AI works

The Kintsu agent has two tools:

1. **queryKnowledge** — vector search over attachment theory book chunks and concept graphs
2. **recallMemory** — vector search over user-specific memories from past conversations

Core memory blocks (user profile, partner info, relationship context, preferences) are always injected into context. Long-term memories are retrieved dynamically based on relevance.

A background memory processing pipeline extracts insights from conversations, deduplicates them, and builds a concept network linking attachment theory ideas.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all services |
| `bun run dev:web` | Frontend only |
| `bun run dev:server` | Backend only |
| `bun run check` | Lint + format (oxlint/oxfmt) |
| `bun run ingest:book` | Ingest knowledge base |

## Deployment

```bash
cd apps/web
bun run alchemy dev     # Local preview
bun run deploy          # Deploy to Cloudflare
bun run destroy         # Tear down
```

## License

MIT
