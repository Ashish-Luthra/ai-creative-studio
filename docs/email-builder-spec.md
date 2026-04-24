> [!NOTE]
> **This is the authoritative spec for the Email Builder module.**
> It supersedes all email-related sections in [`docs/engineering-plan.md`](./engineering-plan.md).
> The compiler stack is **react-email**, not MJML.

---

# Email Builder — Technical Specification
**For Claude Code Handoff**

> A visual email editor combining Flodesk-level UX simplicity with BEE Free structural robustness. Section-first composition, preset-driven design, and a deterministic HTML compiler that produces bulletproof, email-client-safe output.

---

## Table of Contents

1. [Objective](#1-objective)
2. [Core Principles](#2-core-principles)
3. [Core Data Model](#3-core-data-model)
4. [Block System — Atomic Content Layer](#4-block-system--atomic-content-layer)
   - 4.1 Overview
   - 4.2 Base Block Schema
   - 4.3 Field Definitions
   - 4.4 Block Types (Text, Image, Button, Divider, Spacer, Logo)
   - 4.5 Rendering Contract
   - 4.6 Normalization Pipeline
   - 4.7 Design Safety
   - 4.8 Theme Inheritance
   - 4.9 Responsive Behavior
   - 4.10 Future Extensibility
   - **4.11 Saved Blocks — Reusable Module System**
5. [Section System](#5-section-system)
   - 5.1 Categories
   - 5.2 Core Sections (MVP) — incl. 2-column
   - 5.3 Section Definition Schema — incl. background image
   - 5.4 Section Lifecycle
   - 5.5 Constraints Model
   - 5.6 Footer Section (Social Icons, Instagram Feed, Brand Info, Unsubscribe)
6. [CTA System — Button Extension](#6-cta-system--button-extension)
7. [Section JSON Library — Templates](#7-section-json-library--templates)
   - 7.5 Example — Hero Section
   - **7.6 Example — Two-Column Image + Text Section**
8. [HTML Compiler — JSON to Email](#8-html-compiler--json-to-email)
9. [Editing Experience](#9-editing-experience)
10. [Responsive System](#10-responsive-system)
11. [State Management](#11-state-management)
12. [UI Structure](#12-ui-structure)
13. [Performance & Constraints](#13-performance--constraints)
14. [Future Extensions](#14-future-extensions)

---

## 1. Objective

Build a visual email editor that:
- Matches the simplicity and polish of Flodesk
- Matches the structural robustness of BEE Free
- Produces bulletproof, email-client-safe HTML
- Supports modular, reusable, and future-optimizable components
- Enables behavioral CTAs (not just navigation)

---

## 2. Core Principles

1. Section-first UX (no direct row/column editing)
2. Preset-driven design (controlled flexibility)
3. Inline editing first, sidebar second
4. Design safety (users cannot break layouts)
5. Every element uniquely addressable
6. Email-client compatibility first
7. Performance-first rendering
8. Deterministic output (same input → same HTML)

---

## 3. Core Data Model

### 3.1 Root

```json
{
  "sections": [],
  "theme": {},
  "meta": {}
}
```

### 3.2 Section

```json
{
  "id": "section_1",
  "type": "hero",
  "rows": [],
  "styles": {
    "backgroundColor": "#ffffff",
    "backgroundImage": {
      "src": null,
      "position": "center center",
      "size": "cover",
      "repeat": "no-repeat",
      "fallbackColor": "#ffffff"
    },
    "paddingTop": 20,
    "paddingBottom": 20
  }
}
```

> `backgroundImage.fallbackColor` is mandatory — it renders as the solid background in Outlook, which does not support CSS background images. The image renders on top via VML for Outlook and CSS for all other clients.

### 3.3 Layout (Internal Only)

```
Section → Row → Column → Block
```

### 3.4 Block Types (MVP)

- `text`
- `image`
- `button` (CTA base)
- `divider`
- `spacer`
- `logo` (specialized image block)

---

## 4. Block System — Atomic Content Layer

### 4.1 Overview

Blocks are the smallest renderable and editable units in the system. They are:
- Fully self-contained
- Independently renderable
- Behavior-aware (not just visual elements)
- Strictly controlled for email compatibility

> Blocks do NOT control layout. Blocks control content, style, and behavior.

---

### 4.2 Base Block Schema

```json
{
  "id": "block_1",
  "type": "text | image | button | divider | spacer | logo",
  "role": "semantic_role_optional",
  "content": {},
  "style": {},
  "layout": {},
  "behavior": {},
  "meta": {
    "variantGroup": null,
    "locked": false,
    "hidden": false
  }
}
```

---

### 4.3 Field Definitions

| Field | Purpose |
|---|---|
| `id` | Unique identifier for updates, selection, and tracking |
| `type` | Defines renderer |
| `role` | Semantic meaning — validation, analytics, AI (future) |
| `content` | User-editable data only |
| `style` | Preset-driven: typography, colors, spacing, button styles |
| `layout` | Spacing and alignment: margin, alignment |
| `behavior` | Interaction definitions: links, CTA actions, tracking |
| `meta` | System-level: variantGroup, locked, hidden |

**Supported roles:** `heading` · `subheading` · `eyebrow` · `body` · `primary_cta` · `secondary_cta` · `supporting_image`

---

### 4.4 Block Types

#### Text Block

```json
{
  "type": "text",
  "content": { "text": "string" },
  "style": {
    "preset": "heading | subheading | body | eyebrow",
    "fontFamily": "string", "fontSize": 16, "fontWeight": 400,
    "lineHeight": 1.5, "letterSpacing": 0, "color": "#000000",
    "textAlign": "left | center | right",
    "textTransform": "none | uppercase | capitalize"
  },
  "layout": { "marginTop": 0, "marginBottom": 0 },
  "behavior": { "link": { "url": "string" } }
}
```

**Constraints:** No arbitrary HTML. Allowed inline formatting only: bold, italic, underline, link.

---

#### Image Block

```json
{
  "type": "image",
  "content": { "src": "string", "alt": "string" },
  "style": { "width": "auto | full", "borderRadius": 0 },
  "layout": { "marginTop": 0, "marginBottom": 0, "alignment": "left | center | right" },
  "behavior": { "link": { "type": "url | file | checkout", "value": "string", "actions": [] } }
}
```

**Constraints:** Responsive scaling only. No cropping (MVP). No absolute positioning.

---

#### Button Block (Base)

```json
{
  "type": "button",
  "role": "primary_cta | secondary_cta",
  "content": { "text": "string" },
  "style": {
    "preset": "square | rounded | pill",
    "backgroundColor": "#000000", "textColor": "#FFFFFF",
    "borderColor": null, "fontFamily": "string", "fontWeight": 500,
    "fontSize": 16, "paddingX": 24, "paddingY": 12,
    "widthMode": "auto | full", "alignment": "left | center | right"
  },
  "layout": { "marginTop": 0, "marginBottom": 0 },
  "behavior": { "link": { "type": "url | file | checkout", "value": "string", "actions": [] } }
}
```

> Base structure. CTA system (Section 6) extends this with behavioral capabilities.

---

#### Divider Block

```json
{
  "type": "divider",
  "style": { "color": "#E5E5E5", "thickness": 1, "width": "full | inset" },
  "layout": { "marginTop": 10, "marginBottom": 10 }
}
```

#### Spacer Block

```json
{
  "type": "spacer",
  "content": { "height": 20 }
}
```

**Constraint:** Max height cap (e.g. 80px)

---

#### Logo Block (Specialized Image Block)

**Role:** Brand identity anchor. Global reuse, account-level storage, consistent sizing.

```json
{
  "type": "logo",
  "role": "brand_logo",
  "content": { "src": "string", "alt": "string", "source": "account | custom" },
  "style": { "width": 120, "maxWidth": 200, "alignment": "left | center | right" },
  "layout": { "marginTop": 0, "marginBottom": 0 },
  "behavior": { "link": { "type": "url", "value": "", "actions": [] } },
  "meta": { "isGlobal": true }
}
```

| Source | Behavior |
|---|---|
| `account` | Pulled from user profile — "Manage my logo" |
| `custom` | Overridden per email |

**System behavior:** If `meta.isGlobal = true` → updating logo at account level updates all emails.

**Rendering:**
```html
<tr><td align="center"><a href="https://..."><img src="..." width="120" alt="..."></a></td></tr>
```

**Constraints:** Max 200px width · No height control (auto-scale) · Always responsive · No background overlays · Center on mobile

| Feature | Image Block | Logo Block |
|---|---|---|
| Source | Manual | Account + Manual |
| Reusability | No | Yes |
| Constraints | Flexible | Strict |
| Role | Content | Identity |

---

### 4.5 Rendering Contract

```
render(block) → HTMLString
```

Block renderers invoked by HTML Compiler during `renderTree`.

### 4.6 Normalization Pipeline

```
normalize(block):
  applyPresetDefaults()
  validateConstraints()
  fillMissingFields()
```

### 4.7 Design Safety

- No custom HTML
- No arbitrary CSS
- No nested blocks
- No layout-breaking properties

### 4.8 Theme Inheritance

Priority (highest to lowest): Block → Section → Theme

### 4.9 Responsive Behavior

- Blocks degrade safely to mobile
- Layout system handles column stacking

### 4.10 Future Extensibility

```json
{ "meta": { "variantGroup": null } }
```

---

### 4.11 Saved Blocks — Reusable Module System

**Role:** Save any block as a named module, reuse across emails, update all instances from one source.

```json
{
  "id": "saved_block_1",
  "name": "Summer Sale CTA",
  "type": "button",
  "category": "saved",
  "source_block_id": "block_xyz",
  "content": {},
  "style": {},
  "behavior": {},
  "meta": {
    "isGlobal": true,
    "savedAt": "2026-04-24T00:00:00Z",
    "usageCount": 0
  }
}
```

| Step | Action |
|---|---|
| Save | Select block → "Save block" in floating toolbar → name it → stored in library |
| Reuse | Appears in left insert panel under "Saved" category |
| Insert | Click to insert — renders with stored content and styles |
| Update | Editing prompts: "Update all uses?" or "Edit this copy only" |
| Scope | Per-account (not per-email) |

**Constraints:** Blocks only (not full sections) · Max 50 per account (MVP) · Unique names per account · Deletion warns if block is in use

**Sidebar controls:** Name · Category tag · Replace · Delete

**Rendering:** Compiles identically to inline blocks — no special renderer needed.

---

## 5. Section System

### 5.1 Categories

| Category | Purpose |
|---|---|
| Attention | Hero, offer, announcement |
| Value | Features, benefits |
| Proof | Testimonials, reviews |
| Action | CTA, urgency |
| Product | Product grid, featured item |
| Engagement | Instagram feed, referral |
| Footer | Legal, trust, unsubscribe |

---

### 5.2 Core Sections (MVP)

- Hero
- Image + Text (single column)
- **Image + Text (2-column)** — product image left, text + CTA right; stacks on mobile
- Text
- Product Grid
- Testimonials
- CTA Section
- Footer

> The 2-column section is the ONLY multi-column layout in MVP. All others are single-column. Additional column configurations are out of scope for Phase 1.

---

### 5.3 Section Definition Schema

```json
{
  "type": "offer_hero",
  "label": "Offer Hero",
  "category": "attention",
  "structure": {},
  "defaultContent": {},
  "editableFields": [],
  "styles": {
    "backgroundColor": "#ffffff",
    "backgroundImage": {
      "src": null,
      "position": "center center",
      "size": "cover",
      "repeat": "no-repeat",
      "fallbackColor": "#ffffff"
    },
    "paddingTop": 20,
    "paddingBottom": 20
  }
}
```

**Background image rules:**
- `src: null` = solid color only, no image rendered
- When `src` is set, `fallbackColor` is always required for Outlook compatibility
- Compiler: VML for Outlook + CSS `background-image` for all other clients
- User sets background via sidebar: Upload image or choose solid color

---

### 5.4 Section Lifecycle

**Insert:** User selects a section → system injects `structure` and `defaultContent`.

**Edit:** User modifies content and limited styles. System enforces constraints.

**Render:** Section is passed to HTML Compiler → generates email-safe HTML.

---

### 5.5 Constraints Model

- Fixed column layouts (no arbitrary grids)
- Limited number of CTAs per section
- Controlled spacing and alignment
- No layout-breaking modifications

Users cannot alter structural integrity.

---

### 5.6 Footer Section

**Role:** Legal compliance (mandatory), trust reinforcement, social distribution, list management.

> Footer is non-optional in production emails.

**Structure:**
```
Section: Footer
  Blocks:
    - Social Icons (optional)
    - Brand Info / Address (required)
    - Unsubscribe / Preferences (required)
Optional: Instagram Feed Block, Secondary CTA (constrained)
```

**System constraints:**
```json
{ "constraints": { "required": true, "maxInstances": 1 } }
```

**Block order:** Social Icons → Brand Info → Unsubscribe

**Layout:** Single column only (MVP). No nested sections.

---

#### 5.6.1 Social Icons Block

```json
{
  "type": "social_icons",
  "content": { "platforms": [{ "type": "instagram | facebook | twitter | linkedin | youtube | tiktok | custom", "url": "", "enabled": true }] },
  "style": { "variant": "outline | filled | minimal", "color": "#999999", "size": "small | medium | large", "alignment": "left | center | right", "spacing": 12 },
  "layout": { "marginTop": 12, "marginBottom": 12 }
}
```

**Source model:** `account` (auto-applied) or `custom` (override per campaign).

**Constraints:** Max 6–8 icons · Predefined icon set only · No custom SVG (MVP) · Equal spacing · Centered on mobile

---

#### 5.6.2 Instagram Feed Block

```json
{
  "type": "instagram_feed",
  "content": { "source": "account", "images": [], "postCount": 3 },
  "style": { "columns": 3, "aspectRatio": "1:1", "spacing": 10 },
  "layout": { "marginTop": 16, "marginBottom": 16 },
  "behavior": { "link": { "type": "url", "value": "instagram_profile", "actions": [] } }
}
```

**Constraints:** Max 4 columns · Square images only (MVP) · No captions · Must resolve before send (no dynamic fetch at render)

---

#### 5.6.3 Brand Info Block

```json
{
  "type": "brand_info",
  "content": { "brandName": "string", "address": "string", "email": "string" },
  "style": { "fontSize": 12, "color": "#888888", "alignment": "center" }
}
```

**Constraints:** Required for all emails · Must include physical address (CAN-SPAM, GDPR)

---

#### 5.6.4 Unsubscribe Block (Mandatory)

```json
{
  "type": "unsubscribe",
  "content": { "text": "Unsubscribe or Manage Preferences", "unsubscribeUrl": "", "preferencesUrl": "" },
  "style": { "fontSize": 12, "color": "#888888", "alignment": "center" }
}
```

**Rendering:**
```html
<tr><td align="center"><a href="UNSUB_URL">Unsubscribe</a> | <a href="PREF_URL">Manage Preferences</a></td></tr>
```

**Hard rules:** Cannot be deleted · Cannot be hidden · Always last element in footer

---

## 6. CTA System — Button Extension

The CTA system extends the base Button Block with additional behavioral capabilities.

### 6.1 Core Role

CTA is: Conversion driver · Visual anchor · Behavioral trigger system

> CTA = navigation + behavioral trigger. This is the system moat.

### 6.2 CTA Data Model

```json
{
  "id": "cta_1",
  "type": "button",
  "content": { "text": "GET THE DECK" },
  "style": {
    "preset": "rounded", "backgroundColor": "#4A4746", "textColor": "#FFFFFF",
    "fontFamily": "Optima", "fontWeight": "Regular", "fontSize": 18,
    "textTransform": "uppercase", "letterSpacing": 1.8, "lineHeight": 1.2,
    "borderRadius": 6, "borderColor": null, "alignment": "center", "widthMode": "auto",
    "padding": { "top": 12, "bottom": 12, "left": 24, "right": 24 }
  },
  "link": { "type": "url", "value": "https://example.com", "actions": [] },
  "meta": { "savedStyleId": null, "priority": "primary" }
}
```

### 6.3 CTA Actions (Extensible)

```json
{
  "type": "add_to_segment | remove_from_segment | add_to_workflow | remove_from_workflow | set_custom_field",
  "payload": {}
}
```

### 6.4 Constraints

- Minimum height: 44px
- Text required
- Max 2 CTAs per section

---

## 7. Section JSON Library — Templates

### 7.1 Overview

Pre-built, structured, validated sections. Fully composed using Block system. Pre-configured with layout, spacing, responsive behavior. Constrained to prevent layout breakage.

### 7.2 Purpose

| Benefit | Description |
|---|---|
| Faster creation | Insert complete sections instead of assembling manually |
| Design safety | All sections follow validated structures |
| Consistency | Spacing, typography, hierarchy standardized |
| Conversion optimization | Sections designed for specific roles |
| Reduced cognitive load | Choose from meaningful types vs raw blocks |

### 7.3 Conceptual Model

Users interact with: → Sections (primary) → Blocks (secondary)
Internal: Sections → Rows → Columns → Blocks

### 7.4 Section Definition Schema

```json
{
  "id": "string", "label": "string",
  "category": "attention | value | proof | action | product | engagement | footer",
  "structure": {}, "defaultContent": {}, "constraints": {}, "editableFields": [],
  "meta": { "variantGroup": null }
}
```

| Field | Description |
|---|---|
| `id` | Unique identifier |
| `label` | Human-readable name in UI |
| `category` | Grouping in insert panel |
| `structure` | Layout: Section → Row → Column → Block |
| `defaultContent` | Initial content on insert |
| `constraints` | maxBlocks, allowColumnChange, maxCTAs |
| `editableFields` | What user can modify |
| `meta.variantGroup` | A/B testing support |

---

### 7.5 Example — Hero Section

```json
{
  "id": "hero_offer_v1", "label": "Offer Hero", "category": "attention",
  "structure": {
    "rows": [{ "columns": [{ "blocks": [
      { "type": "text", "role": "eyebrow" },
      { "type": "text", "role": "heading" },
      { "type": "button", "role": "primary_cta" }
    ]}]}]
  },
  "defaultContent": { "eyebrow": "You're invited", "heading": "50% OFF SITEWIDE", "cta": { "text": "Shop Now", "link": "#" } },
  "constraints": { "maxCTAs": 1, "allowColumnChange": false },
  "editableFields": ["eyebrow.text", "heading.text", "cta.text", "cta.link"]
}
```

---

### 7.6 Example — Two-Column Image + Text Section

```json
{
  "id": "two_col_image_text_v1",
  "label": "Image + Text (2-column)",
  "category": "value",
  "structure": {
    "rows": [{
      "columnLayout": "50-50",
      "columns": [
        { "width": "50%", "blocks": [{ "type": "image", "role": "supporting_image" }] },
        { "width": "50%", "blocks": [
          { "type": "text", "role": "heading" },
          { "type": "text", "role": "body" },
          { "type": "button", "role": "primary_cta" }
        ]}
      ]
    }]
  },
  "defaultContent": {
    "image": { "src": "", "alt": "Product image" },
    "heading": "Feature headline",
    "body": "Short description of the feature or product.",
    "cta": { "text": "Learn More", "link": "#" }
  },
  "constraints": { "maxCTAs": 1, "allowColumnChange": false, "columnLayout": "50-50" },
  "editableFields": ["image.src", "image.alt", "heading.text", "body.text", "cta.text", "cta.link"],
  "responsive": { "mobile": "stack-vertical", "stackOrder": "image-first" }
}
```

> On mobile, columns stack vertically with image on top. Compiler generates `@media (max-width: 600px)`. Column widths are always 50-50 — not user-configurable in MVP.

### 7.7 Design Principles

- No freeform layout creation
- Preset-driven composition
- Limited but sufficient flexibility
- Mobile-first behavior baked in

### 7.8 Relationship to Other Systems

| System | Relationship |
|---|---|
| Block System | Sections composed of Blocks |
| CTA System | CTA behavior embedded in section blocks |
| HTML Compiler | Sections compiled to email-safe HTML |
| State Management | Sections as nodes within editor state |

---

## 8. HTML Compiler — JSON to Email

### 8.1 Overview

Deterministic renderer: **JSON → Email-safe HTML**

Must guarantee: Outlook-safe · Gmail-safe · No layout breakage · Inline CSS only · Deterministic output

### 8.2 Compiler Pipeline

```
compile(emailJSON):
  normalize
  validate
  resolveStyles
  renderTree
  postProcess
```

### 8.3 Input Contract

```json
{ "sections": [], "theme": {}, "meta": {} }
```

### 8.4 Pipeline Stages

| Stage | Description |
|---|---|
| Normalization | Apply defaults · Expand presets · Assign IDs · Normalize CTA actions |
| Validation | Structure correctness · Block constraints · Section constraints |
| Style Resolution | `finalStyle = block + section + theme` |
| Render Tree | Table-based layout only: Section → Row → Column → Block |
| Background Rendering | If `backgroundImage.src` set: VML for Outlook + CSS `background-image` for all other clients. Always render `fallbackColor` as `bgcolor` on `<td>` |
| Two-Column Layout | Two `<td>` elements in single `<tr>`. Apply `@media (max-width: 600px)` to stack columns to `width: 100%` |
| Post Processing | Inline CSS enforcement · Outlook fixes · Link sanitization |

### 8.5 Block Renderers

`render(block) → HTMLString` for: Text · Image · Button · Divider · Spacer · Logo

### 8.6 CTA Link Resolution

```
resolveLink(link):
  appendTrackingParams()
  encodeActions()
```

### 8.7 Responsive Strategy

- Fluid tables
- Minimal media queries

### 8.8 Post-Processing Rules

- Inline CSS enforcement
- Outlook conditional comment fixes
- Link sanitization

### 8.9 Safety Rules

- No flexbox
- No grid
- No JavaScript
- No external CSS

### 8.10 Performance

- Target: < 100ms compile time
- Memoization of repeated renders

### 8.11 Extensibility Hook

```
postRender(block):
  injectTracking
  injectVariants
```

---

## 9. Editing Experience

### 9.1 Inline Editing

| Element | Interaction |
|---|---|
| Text | Direct edit in place |
| CTA | Text editable inline |
| Image | Click to replace |

### 9.2 Floating Toolbar

Move · Duplicate · Delete · **Save** (saves block to saved blocks library)

### 9.3 Insert System

"+" button above and below each block.

### 9.4 Sidebar Tabs

Button · Font · Link · Block · **Saved** (saved blocks library panel)

---

## 10. Responsive System

| Breakpoint | Width |
|---|---|
| Desktop | ~600px |
| Mobile | ~320px |

**Rules:**
- Single-column sections: full width on all breakpoints
- **Two-column sections:** side-by-side on desktop, stack vertically on mobile (`max-width: 600px`)
- Images scale fluidly within their column
- CTA expands to full width on mobile
- Stack order controlled by `section.responsive.stackOrder` — defaults to `image-first`

---

## 11. State Management

```json
{
  "editor": { "sections": [], "selected": {}, "history": [], "future": [] },
  "ui": { "previewMode": "desktop" },
  "savedBlocks": { "blocks": [], "loading": false }
}
```

`savedBlocksStore` is a separate Zustand store. Fetches from account-level saved blocks library on editor mount and persists changes on save.

---

## 12. UI Structure

| Panel | Content |
|---|---|
| Left | Sections insert panel + Saved blocks tab |
| Centre | Email canvas |
| Right | Block properties sidebar |
| Top | Mode toggle, preview, save, export |

---

## 13. Performance & Constraints

### Performance Targets

| Operation | Target |
|---|---|
| Edit response | < 50ms |
| HTML compile | < 100ms |
| Partial rendering | Memoized components |

### Hard Constraints

- No freeform layout creation
- No absolute positioning
- No custom HTML input from users
- No flexbox, grid, or JS in compiled output

---

## 14. Future Extensions

- Variant-based section A/B testing via `meta.variantGroup`
- AI-generated sections
- Dynamic personalization per user
- Performance-based section optimization
- Additional column layouts (33-67, 3-column)
- Image cropping in editor

---

## System Summary

This system combines three layers:

| Layer | Component |
|---|---|
| Structured content | Sections + Blocks |
| Behavioral layer | CTA System |
| Execution engine | Deterministic HTML Compiler |

> This is not an email builder. This is a **content → behavior → execution system**.
