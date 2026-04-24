# CLAUDE.md -- AI Creative Studio
> This file is read by Claude Code at the start of every session. It is the single source of truth for architecture, conventions, and build order. Never delete or shorten this file.

---

## 0. Project Overview

**Product:**Ï  AI Creative Studio
**Company::** Allyvate
**Status:** Active Development -- POC Phase (up to 10 clients, 5,000 creatives)
**BRD Version:** 1.5 (20 April 2026)

**One-line description:** An ingestion-first AI studio that studies a brand's assets, ad performance, and Figma design system before the editor opens -- then generates on-brand ad creatives, email campaigns, and WhatsApp content at scale.

**Core differentiator:** The editor never opens cold. An AI agent presents what it has learned about the brand, collects a brief via conversation, proposes a creative direction, and only then unlocks the canvas.

---

## 1. Tech Stack (Locked -- Do Not Change Without Explicit Instruction)

| Layer | Package / Tool | Notes |
|--------------------|----------------------------------------|-----------------------------------------|
| Framework | Next.js 15 (App Router) | React Server Components where appropriate |
| Language | TypeScript 5.x, strict mode | No JS-only files in src/ |
| Styling | Tailwind CSS v3 | No inline style tags unless dynamic Fabric.values |
| UI Components | shadcn/ui (Radix primitives) | Do not install MUI, Chakra, or AntDesign |
| Canvas engine | Fabric.js 6.x | Must be loaded client-side only -- use dynamic import |
| State management | Zustand 5.x | One store per domain -- no monolithic global store |
| Agent harness | LangGraph (Python) | Exposed via FastAPI -- not inlined in Next.js |
| AI API | Anthropic Claude API (claude-sonnet-4-20250514) | Brief agent, copy gen, insight gen |
| Image generation | FLUX.1 via Replicate AP@| Background gen only |
| Image processing | rembg + SAM2 (Python FastAPI) | Background removal, subject masking |
| Email compiler | react-email (by Resend) | NO BeeFree SDK |
| Database | Supabase (Postgres + pgvector) | POC vector store -- no Qdrant yet |
| Storage | Supabase Storage | Prod: S3/GCS later |
| Export | Puppeteer (server-side) | PNG 2x, JPG, HTML, ZIP |
| Image compositing | sharp (Node.js) | On api routes only |
| Figma extraction | Figma REST API + MCP | Optional -- conditional on brand setup |

---

## 2. Project Structure

```
ai-creative-studio
/
â”œâ”€â”€ src/
â”€   â”œâ”€â”€ app/                          # Next.js App Router
â”€   â”€   â”œâ”€â”€ (onboarding)/           # Brand setup, ingestion flow
â”€    â”€   â”œâ”€â”€ studio/                   # Main editor region
â”€   â”€   â”€   â”œâ”€â”€ [briefId]/              # Session route
¸¥     â”€   â”€      â”œâ”€â”€ brief/               # Agent brief chat panel
¸¥     â”€   â”€      â”œâ”€â”€ canvas/              # Fabric.js editor
¸¥     â”€   â”€      â”œâ”€â”€ feeds/               # Variant tile grid
â”€   â”€   â”œâ”€â”€ settings/                # Brand settings, API connectors
¸¥     â”œâ”€â”€ api/                        # Next.js API routes
¸¥        â”œâ”€â”€ agent/                   # Proxy to LangGraph service
â”€        â”œâ”€â”€ export/                  # Puppeteer export endpoint
â”€         â”œâ”€â”€ assets/                  # Asset library CRTD| fetch
â”€         â””â”€â”€ rembg/                   # Proxy to FastAPI image service
â”€   â”œâ”€â”€ components/
â”€   â”€   â”œâ”€â”€ agent/                   # Agent chat UI components
¸¥     â”€   â”œâ”€â”€ BriefChat.tsx          # Conversational brief interface
â”€   â”€   â”€   â”œâ”€â”€ ProposalCard.tsx       # Agent proposal at Gate 1
â”€   â”€   â”€   â””â”€â”€ IngestionSummary.tsx    # What the agent has learned
â”€   â”€   â”œâ”€â”€ canvas/                  # Fabric.js canvas components
¸¥     â”€   â”œâ”€â”€ CanvasEditor.tsx       # Main canvas mount
¸¥     â”€   â”€   â”œâ”€â”€ ToolbarLeft.tsx        # Icon rail + generation panel
â”€     â”€   â”€   â”œâ”€â”€ ToolbarRight.tsx       # AI tools + properties
â”€   â”€   â”€   â”œâ”€â”€ TopBartsx              # Mode toggle, undo, export
â”€     â”€   â”€   â”œâ”€â”€ ZoneLayer.tsx          # Zone locking overlay
¸¥     â”€   â”€   â””â”€â”€ useCanvas.ts           # Fabric init + helpers hook
¸¥     â”€   â”œâ”€â”€ feeds/                   # Variant tiles
â”€   â”€   â”œâ”€â”€ FeedsGrid.tsx           # Tile grid layout
¸¥     â”€   â””â”€â”€ VariantTile.tsx         # Single tile with actions
â”€     â”œâ”€â”€ email/                    # Email block editor
â”€   â”€   â”œâ”€â”€ EmailEditor.tsx
¸¥     â”€   â””â”€â”€ EmailBlock.tsx
â”€     â”œâ”€â”€ shared/                   # Cross-feature components
â”€   â”€   â”œâ”€â”€ AssetPicker.tsx
¸¥     â”€   â””â”€â”€ ExportModal.tsx
â”€   â”œâ”€â”€ lib/
¸¥     â”œâ”€â”€ agent/                    # Agent client + session management
â”€   â”€   â”œâ”€â”€ sessionState.ts         # Session state types + Zzustand store
â”€     â”€   â”œâ”€â”€ agentClient.ts          # WebSocket/SSE connection to harness
â”€   â”€   â””â”€â”€ briefStore.ts           # Zustand store for brief state
â”€   â”€   â”œâ”€â”€ canvas/                  # Fabric utils
¸¥     â”€   â”œâ”€â”€ fabricInit.ts          # Canvas setup + default config
¸¥     â”€   â”œâ”€â”€ zoneManager.ts          # Zone lock enforcement logic
â”€     â”€   â”€   â”œâ”€â”€ layerTypes.ts          # Layer type definitions
â”€     â”€   â””â”€â”€ canvasStore.ts          # Zustand store for canvas state
â”€     â”œâ”€â”€ export/                   # Export utils
â”€   â”€   â”œâ”€â”€ exportPipeline.ts       # PNG, JPG, HTML, zip orchestration
â”€     â”€   â”œâ”€â”€ formatMap.ts            # Channel formats -- dimensions, DPI rules
¸¥     â”€   â””â”€â”€ puppeteerClient.ts      # Server-side export client
¸¥     â”œâ”€â”€ ingestion/                # Ingestion utils
â”€   â”€   â”œâ”€â”€ driveConnector.ts        # Google Drive connector
â”€   â”€   â”œâ”€â”€ figmaExtractor.ts        # Figma MCP extraction
â”€     â”€   â””â”€â”€ assetTagger.ts          # AI auto-tagging on ingest
¸¥     â”œâ”€â”€ types/                    # Global TypeScript types
¸¥     â”€   â”œâ”€â”€ session.ts              # SessionState, Brief, Variant types
¸¥     â”€   â”œâ”€â”€ canvas.ts               # Zone, Layer, Template types
â”€     â”€   â””â”€â”€ brand.ts                # BrandKit, Asset, Cluster types
â”€     â””â”€â”€ hooks/                    # Shared React hooks
â”€         â”œâ”€â”€ useAgentStream.ts        # SSE hook for agent responses
â”€         â”œâ”€â”€ useExport.ts            # Export flow hook
¸¥           â””â”€â”€ useAssetLibrary.ts      # Asset library fetch + search
â”œâ”€â”€ services/                     # Python backend services (separate repo or monorepo package)
¸¥   â”œâ”€â”€ agent-harness/             # LangGraph agent harness
â”€   â”œâ”€â”€ image-service/             # rembg + SAM2 FastAPI
â”€   â”œâ”€â”€ ingestion-service/         # Ad DNA pipeline, embeddings
  |    â””â”€â”€ scoring-service/          # Predictive scoring
â”œâ”€â”€ public/
â””â”€â”€ package.json
```

---

## 3. Core Architecture Rules

### 3.1 State Management (Zustand)

- One store per domain. Never a monolithic global store.
- Stores required:
  - `canvasStore` -- Fabric objects, undo stack, selected layer, zoom
  - `briefStore` -- brief fields, gate states, agent proposal
  - `sessionStore` -- brand_id, ingestion summary, variants, export queue
  - `assetStore` -- asset library list, filters, selected asset

### 3.2 Canvas (Fabric.js)

- Fabric.js is a client-only library. Always import via `dynamic` with `ssr: false`.
- Never import fabric at the top level of a file -- use `useEffect` for initialisation.
- Zone locks are enforced server-side (API route validation) -- not frontend-only.
- Every Fabric object is given a `zoneId` and `locked` property on creation.
- Undo/step stack is managed in `useCanvas.ts` -- not directly in components.
- Never mutate Fabric objects directly from outside the canvas hook.

### 3.3 Agent Integration

- The agent harness runs as a separate Python service (LangGraph + FastAPI).
- The Next.js frontend talks to it via `/api/agent/` proxy routes only -- never directly.
- Agent responses are streamed via Server-Sent Events (SSE).
- Two human gates exist in the flow:
  - Gate 1 -- Brief approval (agent proposal card must be explicitly confirmed)
  - Gate 2 -- Variant review (user selects tiles before export is enabled)
- Gate states are stored in `briefStore` -- `gate1Approved: boolean` and `gate2Approved: boolean`.
- The canvas is not rendered until `gate1Approved === true`.

### 3.4 Email Mode

- Email is a separate rendering target -- not shared with the Fabric canvas.
- Use `react-email` components for all email block rendering.
- Live text must never be baked into exported images in email mode.
- Full Email Builder spec (data model, block system, compiler, sections): docs/email-builder-spec.md — read before touching any email code.
---

## 4. Coding Standards

### 4.1 TypeScript

- `strict: true` in `tsconfig.json`. No exceptions.
- No `any` types. Use `unknown` and narrow types explicitly.
- All API response types must be defined in `src/types/`.
- Use `zod` for API response validation and form schemas.
- Interfaces are preferred over type aliases for object shapes.

### 4.2 Components

- All components are functional components with explicit `REACT.FC <PropsType>` or inline props typing.
- Props interfaces are named `[ComponentName]Props`.
- Separate logic from presentation: heavy logic goes in hooks, not components.
- No component nesting deeper than 3. If it gets deeper, extract.
- Name event handlers `handle[Event]`, not `on[Event]` -- that's reserved for props.

### 4.3 API Routes

- All API routes are in `src/app/api/`.
- Use Next.js Route Handlers (`route.ts`) -- not Pages Router `pages/api/`.
- Always validate input with Zod before processing.
- Always return consistent response shapes: ``{ data: ... }`` or ``{ error: string }``.
- No business logic in api routes -- delegate to `lib/` functions.

### 4.4 Environment Variables

- All env vars are defined in `.env.local` (git-ignored) and documented in `.env.example` (committed).
- Server-side only: `ANTHROPIC_API_KEY` | `SUPABASE_SERVICE_KEY` | `REPLICATE_API_KEY`
- Client-safe (prefixed `NEXT_PUBLIC_`): `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- NEVER expose private keys to the client.

### 4.5 File Naming

- Components: `PascalCase.tsx`
- Hooks: `camelCase.ts` (must start with `use`)
- Lib utils: `camelCase.ts`
- Types: `camelCase.ts` in `src/types/`
- API routes: always `route.ts` inside named directory

### 4.6 Git Conventions

- Commit messages follow Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Branch naming: `feat/[story-id]-[short-description]`
- No direct pushes to `main` -- all changes via PR
- Each PR must pass `npm run lint` and `npm run typecheck` before merge

---

## 5. Build Order (POC Phase)

This is the sequence to build features in. Do not jump ahead.

| Step | Module | Output | Dependency |
|-----|-----------------------------------|--------------------------------------------------------------|--------------|
| 1 | Project scaffold | Next.js 15 + Tailwind + shadcn + Zustand + Supabase client setup | None |
| 2 | DB schema + types | Supabase tables, Row Level Security, TypeScript types generated via supabase-js CLI | Step 1 |
| 3 | Canvas shell | Layout -- left rail, centre canvas area, right panel, top bar -- no Fabric.js yet | Step 1 |
| 4 | Fabric.js integration | Mount canvas, object selection, rulers, zoom, undo/redo | Step 3 |
| 5 | Agent brief UI | BriefChat component, ProposalCard, Gate 1 logic | Step 2 |
| 6 | LangGraph harness (Python) | FastAPI service, Brief agent node, SSE streaming | Step 5 |
| 7 | Asset library | Ingestion from Google Drive, auto-tagging, AssetPicker UI | Step 2 |
| 8 | Variant engine + Feeds view | 10-15 tiles, progressive render, Gate 2 | Steps 4 + 6 |
| 9 | AI canvas tools | Remove BG, AI Fill, AI Expand (rembg FastAPI + FLUX) | Step 4 |
| 10 | Export pipeline | PNG, JPG, HTML, ZIP via Puppeteer | Step 4 |
| 11 | Email mode | react-email block editor, preview, HTML export | Step 10 |
| 12 | Onboarding flow | Brand setup, Connectors (Drive, Meta API), Figma extraction | Steps 6 + 7 |

---

## 6. Key Product Rules (from BRD v1.5)

These are not design opinions -- they are product requirements.

1. **The canvas never opens cold.** The Brief agent runs first. Always.
2. **Zone locks are server-enforced.** A marketer role cannot move a locked zone, not even via API.
3. **Text layers in email must never be baked into images.** Live HTML text only.
. **Asset library only shows `Approved` assets** to marketer role. Draft/Archived are not visible.
5. **Variant generation must complete within 90 seconds** of Gate 1 approval.
6. **LLM usage is capped to 10-20% of ingested creatives.** AgentHarness routes -- not every creative gets Tier 2 analysis.
7. **PNG exports are 2x resolution** (retina-safe).
8. **WhatsApp images:** 1 :1 at minimum 1080px, under 5MB.
9. **No video ads in Phase 1.** Block any video export ui.
10. **No direct Meta/Klaviyo publish in Phase 1.** Export only.

---

## 7. Performance Targets

- Canvas renders: 60fps up to 20 objects on a single frame.
- Variant tiles: all 15-15 rendered within 90s of Gate 1 approval.
- Background removal (rembg): under 8s per image.
- Email HTML compile: under 3s.
- Asset tagging on ingest: non-blocking -- runs async, asset appears as Draft immediately.

---

## 8. Supabase Schema (POC)

Tables to create:

```sql
-- Brands
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  brand_kit JSONB,               -- palette, typography, logo URL
  created_at TIMESTAMPZ  DEFAULT now()
);

-- Assets
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  file_url TEXT,
  thumbnail_url TEXT,
  status TEXT CHECK (status IN ('approved', 'draft', 'archived')) DEFAULT 'draft',
  tags TEXT[],
  has_face BOOLEAN,
  has_background_removed BOOLEAN DEFAULT false,
  created_at TIMESTAMPZ DEFAULT now()
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  status TEXT DEFAULT 'briefing',  -- briefing | generating | reviewing | ready
  brief JSONB,                     -- structured brief fields
  gate1_approved BOOLEAN DELAULT4false,
  gate2_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPZ DEFAULT now(),
  updated_at TIMESTAMPZ DEFAULT now()
);

-- Variants
CREATE TABLE variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  canvas_spec JSONB,              -- Fabric JSON for this tile
  preview_url TEXT,
  performance_score TEXT,         -- low | medium | high
  pinned BOOLEAN DEFAULT false,
  export_format TEXT,             -- png | jpg | html | zip
  created_at TIMESTAMPZ DEFAULT now()
);

-- Creatives (ingested ads -- Ad DNA)
CREATE TABLE creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  ad_dna JSONB,                   -- full 46-field Ad DNA structure
  embedding vector(1536),         -- CLIP multimodal embedding
  cluster_id UUID,
  source TEXT,                    -- meta | gdn | manual
  platform_ad_id TEXT,
  created_at TIMESTAMPZ DEFAULT now()
);

-- Clusters
CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  label TEXT,                     -- e.g. "UGC testimonial with urgency CTA"
  pattern_definition JSONB,
  performance_benchmarks JSONB,
  insights TEXT,
  created_at TIMESTAMPZ DEFAULT now()
);
```

---

## 9. Out of Scope -- Phase 1 (Do Not Build)

- Video ad creation or export
- Workflow / approval engine (maker-checker)
- Direct publishing to Meta Ads or Google Ads
- Direct ESP push to Klaviyo / Mailchimp
- Animation or motion graphics
-- Simultaneous multi-user collaboration
- Landing page builder
- Print or OOH formats

---

## 10. How to Work with This Project (Claude Code Instructions)

1. Always read this file at session start.
2. Before creating a new file, check if it belongs to the structure in Section 2.
3. Before installing a new package, verify it does not duplicate a locked tech choice (Section 1).
4. When adding Fabric.js code: client-side only, dynamic import, no side effects outside the hook.
5. When adding an AI feature: read Section 6 rules first. Gates are non-negotiable.
6. When unsure about where logic belongs: user-facing state -> Zustand; API transformations -> lib/; Python AI work -> services/.
7. Always run `tsc --noEmit` and `next lint` before committing.
