> [!WARNING]
> **Scope notice:** This plan covers the Canvas Editor and Social Ads modules.
> The Email Builder module documented here has been superseded.
> For the current Email Builder direction, see [`docs/email-builder-spec.md`](./email-builder-spec.md).

---
# Engineering Plan — AI Creative Studio
**Allyvate | Confidential | 20 April 2026**
**Based on BRD v1.5 | POC Phase — 10 clients, 5,000 creatives**

Email module superseded. See docs/email-builder-spec.md for current direction.

---

## 0. Purpose of This Document

This document translates BRD v1.5 into precise engineering tasks. It defines what to build, in what order, with what technical decisions, sprint breakdown, API contracts, data models, and acceptance criteria. Every decision here is binding unless explicitly overridden with a written reason.

- **CLAUDE.md** = coding rules and folder structure (repo root)
- **This document** = strategic engineering plan (what, why, in what order)
- **Claude Code** = execution engine (reads both)

Do not start Claude Code on any sprint until the sprint spec in this document is reviewed and confirmed.

---

## 1. System Architecture Overview

### 1.1 High-Level System Map

```
┌─────────────────────────────────────────────────────┐
│                 Browser (Client)                     │
│  Next.js 15 + React + Zustand + Fabric.js            │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Agent Brief │  │Canvas Editor │  │ Feeds Grid  │ │
│  │    Chat UI  │  │ (Fabric.js)  │  │ 10-15 tiles │ │
│  └─────────────┘  └──────────────┘  └─────────────┘ │
│         │                │                  │        │
└─────────┼────────────────┼──────────────────┼────────┘
          │                │                  │
          ▼                ▼                  ▼
┌─────────────────────────────────────────────────────┐
│              Next.js API Routes (/api/*)             │
│  /api/agent  /api/export  /api/assets  /api/rembg   │
└──────┬──────────────┬──────────────┬────────────────┘
       │              │              │
       ▼              ▼              ▼
┌──────────┐  ┌──────────────┐  ┌──────────────────┐
│ LangGraph│  │  Puppeteer   │  │  FastAPI Image   │
│ Agent    │  │  Export      │  │  Service (rembg  │
│ Harness  │  │  Service     │  │  + SAM2)         │
│ (Python) │  │  (Node.js)   │  └──────────────────┘
└──────┬───┘  └──────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              Supabase (POC Data Layer)               │
│  Postgres + pgvector + Storage + Auth + RLS         │
└─────────────────────────────────────────────────────┘
```

### 1.2 Two Codebases

| Repo / Package | Language | What Lives Here |
|---|---|---|
| `ai-creative-studio` (monorepo root) | TypeScript | Next.js frontend + API routes + Puppeteer export |
| `services/agent-harness` | Python | LangGraph agent harness + Brief/Creative/Variant agents |
| `services/image-service` | Python | FastAPI + rembg + SAM2 |
| `services/ingestion-service` | Python | Ad DNA pipeline, CLIP embeddings, clustering |

For the POC, all Python services run locally on separate ports. Docker Compose ties them together.

### 1.3 Port Map (Local Development)

| Service | Port |
|---|---|
| Next.js frontend | 3000 |
| LangGraph agent harness | 8000 |
| Image service (rembg) | 8001 |
| Ingestion service | 8002 |
| Supabase local (via supabase CLI) | 54321 |

---

## 2. Data Models

### 2.1 Core Supabase Tables

```sql
-- brands: one row per client brand
CREATE TABLE brands (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  brand_kit     JSONB,        -- { palette: [], fonts: [], logo_url: '' }
  meta_connected BOOLEAN DEFAULT false,
  figma_connected BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- assets: approved image library
CREATE TABLE assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID REFERENCES brands(id) ON DELETE CASCADE,
  file_url            TEXT NOT NULL,
  thumbnail_url       TEXT,
  status              TEXT CHECK (status IN ('approved','draft','archived')) DEFAULT 'draft',
  tags                TEXT[],
  has_face            BOOLEAN,
  bg_removed_url      TEXT,
  source              TEXT,   -- 'drive' | 'dropbox' | 'manual'
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- sessions: one per brief session
CREATE TABLE sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         UUID REFERENCES brands(id) ON DELETE CASCADE,
  status           TEXT DEFAULT 'briefing', -- briefing|generating|reviewing|ready
  brief            JSONB,   -- structured brief fields from agent
  gate1_approved   BOOLEAN DEFAULT false,
  gate2_approved   BOOLEAN DEFAULT false,
  agent_proposal   JSONB,   -- layout, hero image, copy suggestions
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- variants: 10-15 tiles per session
CREATE TABLE variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID REFERENCES sessions(id) ON DELETE CASCADE,
  canvas_spec      JSONB,         -- Fabric.js JSON
  preview_url      TEXT,
  performance_score TEXT,         -- 'low' | 'medium' | 'high'
  dimensions       JSONB,         -- { width, height, format, channel }
  pinned           BOOLEAN DEFAULT false,
  export_format    TEXT,          -- 'png' | 'jpg' | 'html' | 'zip'
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- creatives: ingested ad creatives with Ad DNA (46 fields)
CREATE TABLE creatives (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         UUID REFERENCES brands(id) ON DELETE CASCADE,
  ad_dna           JSONB,         -- full 46-field Ad DNA struct
  embedding        vector(1536),  -- CLIP multimodal embedding
  cluster_id       UUID REFERENCES clusters(id),
  file_url         TEXT,
  source           TEXT,          -- 'meta' | 'gdn' | 'manual'
  platform_ad_id   TEXT,
  md5_hash         TEXT,          -- deduplication
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- clusters: compressed creative patterns
CREATE TABLE clusters (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id             UUID REFERENCES brands(id) ON DELETE CASCADE,
  label                TEXT,      -- e.g. "UGC testimonial, urgency CTA, mid-funnel"
  pattern_definition   JSONB,
  performance_benchmarks JSONB,   -- { ctr_bucket, roas_bucket, cpm_bucket }
  insights             TEXT,      -- LLM-generated cluster insight
  creative_count       INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- zone_templates: agency master layouts
CREATE TABLE zone_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID REFERENCES brands(id) ON DELETE CASCADE,
  name        TEXT,
  canvas_json JSONB,   -- Fabric.js JSON with zone definitions
  aspect_ratio TEXT,  -- '1:1' | '9:16' | '16:9' | '1.91:1'
  channel     TEXT,   -- 'instagram' | 'stories' | 'gdn' | 'whatsapp'
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### 2.2 Session State Object (TypeScript)

This is the single object the LangGraph harness and frontend share:

```typescript
interface SessionState {
  brand_id: string;
  session_id: string;
  ingestion_summary: {
    asset_count: number;
    creative_count: number;
    top_cluster: string;
    figma_connected: boolean;
    meta_connected: boolean;
  };
  brief: {
    objective: 'awareness' | 'consideration' | 'conversion' | 'retention';
    product: string;
    offer?: string;
    audience: string;
    channels: ('social' | 'email' | 'whatsapp')[];
    tone_override?: string;
    urgency: 'fast' | 'refined'; // drives 5 vs 15 variants
  };
  agent_proposal: {
    layouts: LayoutSuggestion[];
    hero_images: AssetSuggestion[];
    headlines: string[];
    competitive_note?: string;
    format_recommendation: string;
  };
  gate1_approved: boolean;
  creative_spec: {
    copy_variants: string[];
    selected_asset_ids: string[];
    bg_generation_prompt?: string;
    layout_id: string;
  };
  variants: VariantTile[];
  gate2_approved: boolean;
  export_queue: ExportItem[];
}
```

### 2.3 Zone Definition (Fabric.js Extension)

Every Fabric object gets these additional properties:

```typescript
interface ZoneProperties {
  zoneId: string;           // 'brand' | 'product' | 'text' | 'cta' | 'background'
  zoneLocked: boolean;      // enforced server-side
  zoneEditable: string[];   // what CAN be changed: ['content', 'size', 'position']
  zoneRole: string;         // human-readable role label
}
```

---

## 3. API Contracts

### 3.1 Agent Harness APIs (Next.js → Python FastAPI)

**POST /api/agent/session/start**
```typescript
// Request
{ brand_id: string }

// Response (SSE stream of events)
event: ingestion_summary
data: { asset_count, creative_count, top_cluster, ... }

event: agent_ready
data: { session_id, message: "I have ingested..." }
```

**POST /api/agent/session/brief**
```typescript
// Request
{ session_id: string, message: string }

// Response (SSE stream)
event: agent_message
data: { text: string }

event: proposal_ready
data: { layouts, hero_images, headlines, format_recommendation }
```

**POST /api/agent/session/approve-gate1**
```typescript
// Request
{ session_id: string, proposal_modifications?: Partial<AgentProposal> }

// Response
{ creative_spec: CreativeSpec }
// Then triggers variant generation (streamed via GET /api/agent/session/variants)
```

**GET /api/agent/session/:id/variants** (SSE)
```typescript
// Streams variant tiles as they complete
event: variant_ready
data: { variant_id, preview_url, canvas_spec, performance_score }

event: all_variants_ready
data: { total: number, duration_ms: number }
```

### 3.2 Asset Library APIs

**GET /api/assets?brand_id=&status=approved&tags=**
```typescript
// Response
{ assets: Asset[], total: number }
```

**POST /api/assets/ingest**
```typescript
// Request
{ brand_id: string, source: 'drive' | 'dropbox', source_path: string }
// Triggers async ingestion — returns job_id
{ job_id: string }
```

**POST /api/rembg**
```typescript
// Request
{ asset_id: string }
// Response
{ bg_removed_url: string }
```

### 3.3 Export API

**POST /api/export**
```typescript
// Request
{
  variant_ids: string[],
  format: 'png' | 'jpg' | 'html' | 'zip',
  resolution: '1x' | '2x',
  channel: 'instagram' | 'stories' | 'gdn' | 'whatsapp' | 'email'
}
// Response
{ download_url: string, expires_at: string }
```

---

## 4. Sprint Plan

### Sprint 0 — Foundation (Week 1-2)
**Goal:** Working repo, DB schema live, local dev environment running, no UI yet.

| Task | Owner | Output | Acceptance Criteria |
|---|---|---|---|
| Next.js 15 scaffold | Claude Code | Repo with folder structure per CLAUDE.md Section 2 | `npm run dev` runs on port 3000 with no errors |
| Supabase local setup | Claude Code | All 7 tables created, RLS enabled | `supabase status` shows all services healthy |
| TypeScript types from DB | Claude Code | `src/types/` files generated from Supabase schema | Zero TypeScript errors on `tsc --noEmit` |
| Zustand stores scaffold | Claude Code | 4 stores: canvas, brief, session, asset | Each store has typed state + actions, no implementation yet |
| Docker Compose | Claude Code | `docker-compose.yml` starts all 4 services | `docker-compose up` starts Next.js + 3 Python services |
| .env.example | Claude Code | All env vars documented | Every secret has a comment explaining where to get it |
| Python service scaffold | Claude Code | FastAPI apps for agent-harness + image-service + ingestion-service | Each returns 200 on GET /health |
| Git branching setup | Manual | `main`, `develop` branches, PR template | Branch protection on main enabled in GitHub |

**Sprint 0 Done When:** `docker-compose up` starts all services, `npm run dev` shows a blank Next.js page, Supabase tables exist, zero TypeScript errors.

---

### Sprint 1 — Canvas Shell (Week 3-4)
**Goal:** The editor chrome — layout, panels, Fabric.js mounted, no AI yet.

| Task | Owner | Output | Acceptance Criteria |
|---|---|---|---|
| Top bar component | Claude Code | Mode toggle (Design/Feeds/Preview), undo/redo, zoom, save, export buttons | Renders correctly, buttons are wired to Zustand but no-op |
| Left icon rail | Claude Code | Icon rail with: layers, images, text, brand assets, audio icons | Icons visible, clicking opens correct collapsible panel |
| Left generation panel | Claude Code | Collapsible panel: prompt input, model selector, count, aspect ratio, style refs | Panel opens/closes, inputs are controlled components |
| Centre canvas mount | Claude Code | Fabric.js mounted via dynamic import, rulers visible | Canvas renders at correct aspect ratio, 60fps verified |
| Right properties panel | Claude Code | AI tools section + standard tools + opacity/transform/alignment | Panel renders, all tool buttons present |
| Zone lock overlay | Claude Code | Locked zones show lock icon, dotted border on editable zones | Visual indicators correct, no actual enforcement yet |
| Canvas store wiring | Claude Code | Fabric object selection updates canvasStore | selectedLayer updates in Zustand on canvas click |
| Undo/redo stack | Claude Code | 20-step undo/redo via useCanvas hook | Ctrl+Z / Ctrl+Y work for object moves |
| Responsive panel layout | Claude Code | Panels collapse correctly at <1280px width | No layout breakage at 1280px, 1440px, 1920px |

**Sprint 1 Done When:** The editor shell is pixel-complete, Fabric.js canvas is interactive, undo/redo works, zone visuals are present. No AI, no export.

---

### Sprint 2 — Agent Brief Interface (Week 5-6)
**Goal:** The session-opening agent chat — Gate 1 flow complete. This is the core UX differentiator.

| Task | Owner | Output | Acceptance Criteria |
|---|---|---|---|
| Brief agent Python node | Claude Code | LangGraph node: reads ingestion summary, generates opening statement | Returns structured ingestion_summary + agent message |
| SSE streaming from harness | Claude Code | FastAPI SSE endpoint `/session/start` | Events stream to browser in real time |
| BriefChat component | Claude Code | Conversational chat UI — agent messages + user input | Messages stream character by character |
| IngestionSummary component | Claude Code | Visual card showing: asset count, top cluster, Figma/Meta connection status | Renders from session ingestion_summary object |
| Brief field extraction | Claude Code | Agent extracts: objective, product, audience, channels, urgency from conversation | All 6 brief fields populated in briefStore after conversation |
| ProposalCard component | Claude Code | Card showing: suggested layouts, hero image, 3 headline options, format rec | All proposal fields rendered, approve/modify/reject buttons present |
| Gate 1 logic | Claude Code | Canvas does NOT render until gate1_approved === true | Confirmed: canvas route blocked by gate state check |
| Mock ingestion summary | Claude Code | Hardcoded mock data for dev without real brand data | Dev can test full brief flow without connecting APIs |
| Claude API integration | Claude Code | Brief agent calls claude-sonnet-4-20250514 for conversation | Real Claude responses in chat, not mocked |

**Sprint 2 Done When:** A developer can start a session, have a conversation with the agent, receive a proposal card, approve it, and see Gate 1 unlock. The canvas still does not open — that's Sprint 3.

---

### Sprint 3 — Fabric.js Editor (Full) (Week 7-8)
**Goal:** Fully functional canvas editor with zone enforcement and all layer types.

| Task | Owner | Output | Acceptance Criteria |
|---|---|---|---|
| Zone lock server enforcement | Claude Code | API route validates zone operations against zone permissions | Attempt to move locked zone returns 403 |
| Layer types | Claude Code | Image layer, Text layer, Shape layer, Brand asset layer all functional | Each type selectable, editable in right panel |
| Text editing | Claude Code | Double-click text to edit inline | Font family/weight locked on brand zone text |
| Image placement | Claude Code | Drag asset from left panel onto canvas | Image scales to zone, maintains aspect ratio |
| Format switcher | Claude Code | Dropdown: 1:1, 9:16, 16:9, 1.91:1, WhatsApp 1:1 | Canvas resizes, zone layout reflows correctly |
| AI Fill | Claude Code | Select region → prompt → inpainting via FLUX | Region filled within 30s |
| AI Erase | Claude Code | Select object → erase → background fills | Object removed, background fills within 15s |
| Remove BG | Claude Code | Right panel button → calls /api/rembg | Background stripped, result placed on canvas |
| Place Product | Claude Code | Asset picker → product placed with shadow/lighting | Product composited cleanly |
| AI Expand | Claude Code | Drag canvas edge → generates matching extension | Canvas expands, edge generated within 30s |
| Export from editor | Claude Code | Export modal: format, resolution, channel selector | PNG 2x export matches canvas preview at retina resolution |

**Sprint 3 Done When:** A brand manager can load a template, see zone locks enforced, edit text/images within permitted zones, use AI tools, and export a PNG at 2x.

---

### Sprint 4 — Variant Engine + Feeds View (Week 9-10)
**Goal:** 10-15 variants generated in parallel, progressive tile rendering, Gate 2 flow.

| Task | Owner | Output | Acceptance Criteria |
|---|---|---|---|
| Variant agent Python node | Claude Code | LangGraph fan-out: 15 parallel branches | 15 canvas specs generated simultaneously |
| Permutation engine | Claude Code | Generates colour × background × copy × layout permutations | No two tiles identical; all within brand kit constraints |
| FeedsGrid component | Claude Code | Grid of tiles, each rendering a canvas preview | Tiles appear progressively as they complete |
| VariantTile component | Claude Code | Single tile: preview, pin, expand, regenerate, select | All actions wired to variantStore |
| Progressive rendering | Claude Code | Tiles appear as each branch completes, not all at once | First tile visible within 15s of Gate 1 approval |
| 90s timeout enforcement | Claude Code | All variants rendered within 90s; failed branches silently skipped | Confirmed via timing test with 15 variants |
| Gate 2 logic | Claude Code | Export disabled until at least 1 tile selected | Export button greyed out until selection |
| Tile expand to editor | Claude Code | Click expand → opens full canvas editor for that variant | Canvas editor loads with correct canvas_spec |
| Batch export | Claude Code | Select multiple tiles → export as ZIP | ZIP contains correctly named PNG files |
| Performance score badge | Claude Code | Each tile shows low/medium/high badge | Score derived from cluster benchmark in session state |

**Sprint 4 Done When:** Full variant flow works end-to-end — brief → approval → 15 tiles render in under 90s → user selects tiles → export works.

---

### Sprint 5 — Asset Library + Ingestion (Week 11-12)
**Goal:** Google Drive connector, auto-tagging, asset picker in editor.

| Task | Owner | Output | Acceptance Criteria |
|---|---|---|---|
| Google Drive connector | Claude Code | OAuth flow + Drive file listing + download to Supabase Storage | Assets appear in library after Drive connection |
| Auto-tagging on ingest | Claude Code | Claude API tags each image: product type, scene, colour | Each asset has minimum 3 tags within 10s of ingest |
| Face detection | Claude Code | Flag has_face=true on assets with human faces | Prevents bad crops in placement |
| Background removal on ingest | Claude Code | rembg runs async on ingest, stores bg_removed_url | bg_removed_url populated within 30s |
| Asset library UI | Claude Code | Grid of approved assets with search, filter by tag | Filters update results without page reload |
| AssetPicker component | Claude Code | Modal picker from editor left panel | Picking asset places it on canvas in correct zone |
| Brand manager approval flow | Claude Code | Status toggle: Draft → Approved → Archived | Only Approved assets visible to marketer role |
| Bulk ingest | Claude Code | Select Drive folder → ingest all images | 100 images ingested within 5 minutes |

**Sprint 5 Done When:** A brand manager can connect Google Drive, assets auto-tag, they approve assets, and marketers see only approved assets in the editor picker.

---

### Sprint 6 — Email Mode (Week 13-14)
**Goal:** Separate email block editor, react-email compiler, HTML export.

| Task | Owner | Output | Acceptance Criteria |
|---|---|---|---|
| Email mode toggle | Claude Code | Top bar toggle switches to email editor mode | Fabric canvas hides, email editor mounts |
| Canvas → email block mapping | Claude Code | Converts canvas zone layers to react-email blocks per mapping table in BRD 13.2 | All 7 layer types convert correctly |
| EmailEditor component | Claude Code | Block-based editor: reorder blocks, edit text inline, swap images | Drag-to-reorder works, text editable inline |
| react-email compiler | Claude Code | Compiles block tree to inbox-safe HTML | Output renders correctly in Gmail web |
| Live text enforcement | Claude Code | Text blocks always output as live HTML, never baked into images | Confirmed: no text pixels in exported images |
| Desktop/mobile preview | Claude Code | Toggle preview between desktop (600px) and mobile (375px) | Preview updates instantly on toggle |
| HTML export | Claude Code | Exports .html file ready for ESP upload | File opens in Gmail web without rendering errors |
| Merge tag support | Claude Code | Text blocks accept {{first_name}} syntax | Merge tags preserved in exported HTML |

**Sprint 6 Done When:** A marketer can switch to email mode, see canvas assets converted to email blocks, edit and reorder blocks, preview on desktop/mobile, and export a valid HTML file.

---

### Sprint 7 — Onboarding + Settings (Week 15-16)
**Goal:** Brand setup flow, Meta API connection, Figma extraction. Non-blocking for core editor.

| Task | Owner | Output | Acceptance Criteria |
|---|---|---|---|
| Brand creation flow | Claude Code | Form: brand name, upload logo, set primary palette | Brand record created in Supabase with brand_kit |
| Meta Marketing API connection | Claude Code | OAuth → pull last 3 months of ad creatives + performance data | Creatives table populated with ingested Meta ads |
| Ad DNA extraction pipeline | Claude Code | Tier 1: vision + OCR + NLP on each creative | All 35 Tier 1 fields populated per creative |
| CLIP embedding generation | Claude Code | Each creative gets vector(1536) embedding stored in pgvector | Cosine similarity search returns relevant results |
| k-means clustering (POC) | Claude Code | Python script: k=20-30 clusters from embeddings | Clusters table populated, each creative has cluster_id |
| Cluster labelling | Claude Code | Claude API generates label for each cluster | Each cluster has human-readable label |
| Figma extraction (optional) | Claude Code | Figma REST API → extract colours, fonts, logo, spacing | Brand kit populated from Figma if connected |
| Settings UI | Claude Code | Page: connected sources, brand kit editor, user roles | All connections show status: connected/disconnected |

**Sprint 7 Done When:** A new brand can be fully onboarded — brand kit set, Drive connected, Meta connected, Ad DNA extracted, clusters generated, Figma extracted (if available).

---

## 5. Technical Decisions and Rationale

| Decision | Choice | Rationale |
|---|---|---|
| Canvas engine | Fabric.js 6.x | Best TypeScript support, active maintenance, JSON serialisation for canvas_spec storage |
| Agent framework | LangGraph | Stateful graph with human-in-the-loop gates as first-class nodes; resumable sessions |
| Vector store (POC) | pgvector on Supabase | 5,000 creatives = ~10K vectors; fits comfortably in Postgres; no separate infra |
| LLM for all copy/insight | claude-sonnet-4-20250514 | Consistent quality across brief, copy gen, asset tagging, cluster labelling |
| Image generation | FLUX.1 via Replicate | Best quality for background generation; Replicate handles GPU scaling |
| Email compiler | The compiler stack is react-email | Actively maintained, React component model, inbox-safe output, no BeeFree dependency |
| Streaming | SSE (Server-Sent Events) | Simpler than WebSockets for unidirectional agent streams; native browser support |
| State management | Zustand | Minimal, canvas-compatible, no Redux boilerplate |
| Export | Puppeteer | Server-side rendering of Fabric canvas at 2x = pixel-accurate retina export |
| Background removal | rembg + SAM2 | rembg for speed (<8s), SAM2 for precision masking on complex subjects |

---

## 6. Environment Variables Reference

```bash
# Anthropic
ANTHROPIC_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Replicate (FLUX)
REPLICATE_API_KEY=

# Meta Marketing API
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=

# Figma (optional)
FIGMA_ACCESS_TOKEN=

# Google Drive OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Python service URLs (local dev)
AGENT_HARNESS_URL=http://localhost:8000
IMAGE_SERVICE_URL=http://localhost:8001
INGESTION_SERVICE_URL=http://localhost:8002
```

---

## 7. Non-Functional Requirements (Engineering Targets)

| Requirement | Target | How Verified |
|---|---|---|
| Canvas frame rate | 60fps with 20 objects | Chrome DevTools Performance tab |
| Variant generation | All 15 tiles within 90s of Gate 1 | Timing log in agent harness |
| Background removal | Under 8s per image | API response time log |
| Email HTML compile | Under 3s | Server-side timing header |
| PNG export resolution | 2x canvas size | Pixel dimension check on exported file |
| Zone lock enforcement | Server-side, not UI-only | API test: direct API call with locked zone move returns 403 |
| WhatsApp image size | Min 1080px, under 5MB | File size check on export |

---

## 8. Out of Scope — Do Not Build in POC

- Video ad creation or export
- Maker-checker workflow / approval engine (separate product)
- Direct publish to Meta Ads Manager or Google Ads
- Direct ESP push to Klaviyo / Mailchimp
- Animation or motion graphics
- Simultaneous multi-user editing
- Landing page builder
- Print or OOH formats

---

## 9. Open Questions (From BRD) — Decisions Needed Before Sprint 7

| # | Question | Impact | Decision Needed By |
|---|---|---|---|
| 1 | Pricing model: seat-based, credit-based, or output-based? | Affects usage tracking schema | Before Sprint 7 |
| 2 | Multi-brand from day one? | Affects RLS policies and brand_id scoping | Before Sprint 0 |
| 3 | Which DAM connectors for pilot customer? | Affects Sprint 5 connector scope | Before Sprint 5 |
| 4 | SLA on rembg for bulk ingest (100+ images)? | Affects queue design in image service | Before Sprint 5 |
| 5 | English only for copy generation in v1? | Affects Claude API prompts | Before Sprint 2 |

---

## 10. How to Use This Document With Claude Code

At the start of each sprint:

1. Open Claude Code desktop app
2. Paste: *"Read CLAUDE.md and the Engineering Plan in Google Drive. We are starting Sprint [N]. Build all tasks in the Sprint [N] table. Do not build anything outside Sprint [N] scope. Confirm the plan before executing."*
3. Review the plan Claude Code proposes in the Plan panel
4. Approve and let it execute
5. After completion, paste: *"Run acceptance criteria checks for Sprint [N] and report results."*

Never run two sprints in one Claude Code session. Token context fills up and quality degrades.

---

*Document Owner: Product + Engineering Lead*
*Next Review: After Sprint 0 completion*
