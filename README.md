# AI Creative Studio — Allyvate

An ingestion-first AI creative studio for generating on-brand ad creatives and email campaigns.

## What's built

**Canvas Shell (Sprint 1)**

- Studio Rails layout — 48px left rail always visible, minimal top bar
- Three modes: Canvas, Email, Feeds (toggle in top bar)
- Floating glassmorphism panels on layer selection (typography toolbar + properties card)
- Email mode — viewport frame + floating MJML block tree
- Agent pill — fixed bottom input for AI commands
- Fabric.js 6 canvas with undo/redo and selection styles
- Zustand store for all canvas state

## Stack

- Next.js 16 (App Router, TypeScript strict)
- Fabric.js 6 — canvas rendering
- Zustand 5 — state management
- Tailwind CSS v3 + shadcn/ui
- MJML — email compilation

## Run locally

```bash
cd ai-creative-studio
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects straight to the canvas.

## Project structure

```
src/
  app/
    studio/[briefId]/canvas/   # Canvas route
  components/canvas/
    CanvasEditor.tsx            # Main orchestrator
    CanvasEditorClient.tsx      # SSR-safe dynamic import wrapper
    TopBar.tsx                  # Mode toggle, undo/redo, export
    ToolbarLeft.tsx             # 48px left rail
    AgentPill.tsx               # Floating agent input
    FloatToolbar.tsx            # Typography toolbar (on selection)
    FloatPropertiesCard.tsx     # Properties panel (on selection)
    FloatMjmlCard.tsx           # MJML block tree (email mode)
  lib/canvas/
    canvasStore.ts              # Zustand store
    fabricInit.ts               # Fabric.js init helper
    layerTypes.ts               # Layer type definitions
```

## Roadmap

- [ ] Connect AgentPill → `/api/agent` → LangGraph harness
- [ ] Wire FloatToolbar to live Fabric.js text editing
- [ ] Replace EmailViewport placeholder with real react-email preview
- [ ] Supabase auth + brief gate on `briefId`
- [ ] Brand ingestion pipeline (Sprint 2)
