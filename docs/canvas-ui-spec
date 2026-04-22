# Canvas UI Specification — AI Creative Studio
> Design Language: "Calm" | Mode: Light | Inspired by Recraft

---

## 1. Design Philosophy — The "Calm" Layout

The canvas defaults to a light, studio-quality feel. Complexity is hidden until needed. The agent input box is the primary entry point — not a toolbar, not a menu.

- **Foundation:** Infinite scrollable off-white canvas (`#F9FAFB`) — makes Fabric.js layers and email frames pop
- **Idle state:** Only the Agent Input Box and a collapsed Layers Pill are visible
- **Interaction state:** Contextual toolbars appear near the selected layer — not pinned to the sides
- **Email mode:** Viewport frame appears with a side panel revealing MJML structure (Sections/Columns) — main stage stays uncluttered

---

## 2. Visual Specs

| Component | Design Requirement | Styling |
|---|---|---|
| **Canvas** | Infinite scrollable surface | Background: `#FDFDFD` · Grid: subtle dot pattern `#E5E7EB` |
| **Agent Input Box** | Centered floating pill anchored at bottom | Surface: `#FFFFFF` · Border: `1px solid #D1D5DB` · Shadow: soft elevation |
| **Floating Toolbar** | Contextual — appears on layer selection (Typography / Layers) | Glassmorphism: 70% opacity white + 12px blur |
| **Active Selection** | Highlight for selected Fabric.js layer | Border: `2px solid #2563EB` (blue) · Floating mini-actions icon |

---

## 3. Progressive Disclosure — Three States

### Idle State
- Agent Input Box visible and centred at bottom
- Collapsed Layers Pill only
- Nothing else on canvas

### Interaction State
- User or AI selects a layer (e.g. "Text Layer 1")
- Floating Typography Toolbar appears **near the selection** — not in a side panel
- Provides font and colour controls inline

### Email Mode State
- Viewport frame appears in canvas
- Side panel reveals MJML structure: Sections → Columns
- Main canvas stage remains uncluttered
- No MJML code visible unless user explicitly opens it

---

## 4. Agent Input Box Behaviour (Recraft-style)

The input box is not a search bar — it is a **command interface**.

- User types: `"Add a bold title over the hero image"`
- User types: `"Generate an MJML layout for a product launch"`

**On submit:**
- AI does not just "apply" the command
- It generates **multiple variations** as new Fabric.js layers spread across the canvas
- Each variation is a selectable, editable tile — not a modal or overlay

---

## 5. State Management

Every action through the input box updates a **unified JSON state model** which simultaneously:
1. Refreshes the visual Fabric.js canvas
2. Updates the underlying MJML/react-email block structure

This is the "headless bridge" between the canvas editor and email mode — one state, two rendering targets.

---

## 6. Implementation Notes for Dev

- Fabric.js canvas must use `#FDFDFD` background with a CSS dot-grid overlay (`#E5E7EB`, 1px dots, 24px gap)
- Agent Input Box is a fixed-position floating element — `position: fixed`, `bottom: 24px`, `left: 50%`, `transform: translateX(-50%)`
- Floating Toolbar uses `backdrop-filter: blur(12px)` + `background: rgba(255,255,255,0.7)` — do not use a solid panel
- Active layer selection border is `2px solid #2563EB` drawn via Fabric.js object `borderColor` and `borderScaleFactor`
- Layers Pill is collapsed by default — expands on click, not on hover
- All contextual UI elements use `z-index` layering above the canvas, never inside it

---

*Spec Owner: Product / Design*
*For: Engineering Sprint 1 — Canvas Shell*
