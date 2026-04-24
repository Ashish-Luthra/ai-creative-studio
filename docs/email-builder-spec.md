This is the authoritative engineering spec for the Email Builder module. It supersedes the email sections in engineering-plan.md.
Email Builder — Technical Specification
For Claude Code Handoff

A visual email editor combining Flodesk-level UX simplicity with BEE Free structural robustness. Section-first composition, preset-driven design, and a deterministic HTML compiler that produces bulletproof, email-client-safe output.


Table of Contents
Objective
Core Principles
Core Data Model
Block System — Atomic Content Layer
4.1 Overview
4.2 Base Block Schema
4.3 Field Definitions
4.4 Block Types
Text Block
Image Block
Button Block (Base)
Divider Block
Spacer Block
Logo Block (Specialized)
4.5 Rendering Contract
4.6 Normalization Pipeline
4.7 Design Safety
4.8 Theme Inheritance
4.9 Responsive Behavior
4.10 Future Extensibility
Section System
5.1 Categories
5.2 Core Sections (MVP)
5.3 Section Definition Schema
5.4 Section Lifecycle
5.5 Constraints Model
5.6 Footer Section
5.6.1 Social Icons Block
5.6.2 Instagram Feed Block
5.6.3 Brand Info Block
5.6.4 Unsubscribe Block (Mandatory)
CTA System — Button Extension
Section JSON Library — Templates
HTML Compiler — JSON to Email
Editing Experience
Responsive System
State Management
UI Structure
Performance & Constraints
Future Extensions


1. Objective
Build a visual email editor that:

Matches the simplicity and polish of Flodesk
Matches the structural robustness of BEE Free
Produces bulletproof, email-client-safe HTML
Supports modular, reusable, and future-optimizable components
Enables behavioral CTAs (not just navigation)


2. Core Principles
Section-first UX (no direct row/column editing)
Preset-driven design (controlled flexibility)
Inline editing first, sidebar second
Design safety (users cannot break layouts)
Every element uniquely addressable
Email-client compatibility first
Performance-first rendering
Deterministic output (same input → same HTML)


3. Core Data Model
3.1 Root
{

  "sections": [],

  "theme": {},

  "meta": {}

}
3.2 Section
{

  "id": "section_1",

  "type": "hero",

  "rows": [],

  "styles": {

    "backgroundColor": "#ffffff",

    "paddingTop": 20,

    "paddingBottom": 20

  }

}
3.3 Layout (Internal Only)
Section → Row → Column → Block
3.4 Block Types (MVP)
text
image
button (CTA base)
divider
spacer
logo (specialized image block)


4. Block System — Atomic Content Layer
4.1 Overview
Blocks are the smallest renderable and editable units in the system. They are:

Fully self-contained
Independently renderable
Behavior-aware (not just visual elements)
Strictly controlled for email compatibility

Blocks do NOT control layout. Blocks control content, style, and behavior.


4.2 Base Block Schema
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


4.3 Field Definitions
Field
Purpose
id
Unique identifier for updates, selection, and tracking
type
Defines renderer
role
Semantic meaning — used for validation, analytics, and AI (future)
content
User-editable data only
style
Preset-driven visual system: typography, colors, spacing, button styles
layout
Spacing and alignment: margin, alignment
behavior
Interaction definitions: links, CTA actions, tracking
meta
System-level properties: variantGroup (experiments), locked, hidden


Supported roles: heading · subheading · eyebrow · body · primary_cta · secondary_cta · supporting_image


4.4 Block Types
Text Block
{

  "type": "text",

  "content": {

    "text": "string"

  },

  "style": {

    "preset": "heading | subheading | body | eyebrow",

    "fontFamily": "string",

    "fontSize": 16,

    "fontWeight": 400,

    "lineHeight": 1.5,

    "letterSpacing": 0,

    "color": "#000000",

    "textAlign": "left | center | right",

    "textTransform": "none | uppercase | capitalize"

  },

  "layout": {

    "marginTop": 0,

    "marginBottom": 0

  },

  "behavior": {

    "link": {

      "url": "string"

    }

  }

}

Constraints:

No arbitrary HTML
Allowed inline formatting only: bold, italic, underline, link


Image Block
{

  "type": "image",

  "content": {

    "src": "string",

    "alt": "string"

  },

  "style": {

    "width": "auto | full",

    "borderRadius": 0

  },

  "layout": {

    "marginTop": 0,

    "marginBottom": 0,

    "alignment": "left | center | right"

  },

  "behavior": {

    "link": {

      "type": "url | file | checkout",

      "value": "string",

      "actions": []

    }

  }

}

Constraints:

Responsive scaling only
No cropping (MVP)
No absolute positioning


Button Block (Base)
{

  "type": "button",

  "role": "primary_cta | secondary_cta",

  "content": {

    "text": "string"

  },

  "style": {

    "preset": "square | rounded | pill",

    "backgroundColor": "#000000",

    "textColor": "#FFFFFF",

    "borderColor": null,

    "fontFamily": "string",

    "fontWeight": 500,

    "fontSize": 16,

    "paddingX": 24,

    "paddingY": 12,

    "widthMode": "auto | full",

    "alignment": "left | center | right"

  },

  "layout": {

    "marginTop": 0,

    "marginBottom": 0

  },

  "behavior": {

    "link": {

      "type": "url | file | checkout",

      "value": "string",

      "actions": []

    }

  }

}

This is the base structure. The CTA system (Section 6) extends this with additional behavioral capabilities.


Divider Block
{

  "type": "divider",

  "style": {

    "color": "#E5E5E5",

    "thickness": 1,

    "width": "full | inset"

  },

  "layout": {

    "marginTop": 10,

    "marginBottom": 10

  }

}


Spacer Block
{

  "type": "spacer",

  "content": {

    "height": 20

  }

}

Constraint: Maximum height cap (e.g. 80px)


Logo Block (Specialized Image Block)
Role: Brand identity anchor used primarily in header and footer sections. Unlike generic images, Logo has global reuse, account-level storage, and consistent sizing behavior.

{

  "type": "logo",

  "role": "brand_logo",

  "content": {

    "src": "string",

    "alt": "string",

    "source": "account | custom"

  },

  "style": {

    "width": 120,

    "maxWidth": 200,

    "alignment": "left | center | right"

  },

  "layout": {

    "marginTop": 0,

    "marginBottom": 0

  },

  "behavior": {

    "link": {

      "type": "url",

      "value": "",

      "actions": []

    }

  },

  "meta": {

    "isGlobal": true

  }

}

Source model:

Source
Behavior
account
Pulled from user profile — managed centrally via "Manage my logo"
custom
Overridden per email


Editing experience:

Inline: click → opens asset selector → replace logo
Sidebar controls: Upload / Manage logo · Width slider · Alignment · Alt text (accessibility)

System behavior:

If meta.isGlobal = true → updating logo at account level updates all emails
Future: lock logo in templates; prevent deletion in critical sections

Rendering output:

<tr>

  <td align="center">

    <a href="https://...">

      <img src="..." width="120" alt="...">

    </a>

  </td>

</tr>

Constraints:

Max width enforced (200px)
No height control (auto-scale)
Always responsive
No background overlays
No arbitrary styling
Always center-aligned on mobile

Comparison to Image Block:

Feature
Image Block
Logo Block
Source
Manual
Account + Manual
Reusability
No
Yes
Constraints
Flexible
Strict
Role
Content
Identity



4.5 Rendering Contract
render(block) → HTMLString

Block renderers are invoked by the HTML Compiler during renderTree.


4.6 Normalization Pipeline
normalize(block):

  applyPresetDefaults()

  validateConstraints()

  fillMissingFields()


4.7 Design Safety
No custom HTML
No arbitrary CSS
No nested blocks
No layout-breaking properties


4.8 Theme Inheritance
Priority order (highest to lowest):

Block
Section
Theme


4.9 Responsive Behavior
Blocks degrade safely to mobile
Layout system handles column stacking


4.10 Future Extensibility
{

  "meta": {

    "variantGroup": null

  }

}


5. Section System
5.1 Categories
Category
Purpose
Attention
Hero, offer, announcement
Value
Features, benefits
Proof
Testimonials, reviews
Action
CTA, urgency
Product
Product grid, featured item
Engagement
Instagram feed, referral
Footer
Legal, trust, unsubscribe



5.2 Core Sections (MVP)
Hero
Image + Text
Text
Product Grid
Testimonials
CTA Section
Footer


5.3 Section Definition Schema
{

  "type": "offer_hero",

  "label": "Offer Hero",

  "category": "attention",

  "structure": {},

  "defaultContent": {},

  "editableFields": []

}


5.4 Section Lifecycle
Insert: User selects a section → system injects structure and defaultContent.

Edit: User modifies content and limited styles. System enforces constraints.

Render: Section is passed to the HTML Compiler → generates email-safe HTML.


5.5 Constraints Model
The Section System enforces:

Fixed column layouts (no arbitrary grids)
Limited number of CTAs per section
Controlled spacing and alignment
No layout-breaking modifications

Users cannot alter structural integrity.


5.6 Footer Section
Role: Footer is responsible for legal compliance (mandatory), trust reinforcement, social distribution, and list management.

Footer is non-optional in production emails.

Structure:

Section: Footer

  Blocks:

    - Social Icons (optional)

    - Brand Info / Address (required)

    - Unsubscribe / Preferences (required)

Optional additions:

  - Instagram Feed Block

  - Secondary CTA (rare, constrained)

System constraints:

{

  "constraints": {

    "required": true,

    "maxInstances": 1

  }

}

Block order enforcement: Social Icons → Brand Info → Unsubscribe

Layout rule: Single column only (MVP). No nested sections.


5.6.1 Social Icons Block
Role: Extend engagement beyond email. Drive traffic to owned channels.

{

  "type": "social_icons",

  "content": {

    "platforms": [

      {

        "type": "instagram | facebook | twitter | linkedin | youtube | tiktok | custom",

        "url": "",

        "enabled": true

      }

    ]

  },

  "style": {

    "variant": "outline | filled | minimal",

    "color": "#999999",

    "size": "small | medium | large",

    "alignment": "left | center | right",

    "spacing": 12

  },

  "layout": {

    "marginTop": 12,

    "marginBottom": 12

  }

}

Source model:

Source
Behavior
account
Auto-applied across all emails via "Manage social links"
custom
Override per campaign


Sidebar controls: Style (outline / filled) · Color · Size · Alignment · Spacing

Rendering:

<tr>

  <td align="center">

    <a href="#"><img src="instagram.png"></a>

    <a href="#"><img src="facebook.png"></a>

  </td>

</tr>

Constraints:

Max 6–8 icons
Predefined icon set only
No custom SVG (MVP)
Equal spacing enforced
Always centered on mobile with touch-friendly spacing


5.6.2 Instagram Feed Block
Role: Social proof, visual engagement, content recycling.

{

  "type": "instagram_feed",

  "content": {

    "source": "account",

    "images": [],

    "postCount": 3

  },

  "style": {

    "columns": 3,

    "aspectRatio": "1:1",

    "spacing": 10

  },

  "layout": {

    "marginTop": 16,

    "marginBottom": 16

  },

  "behavior": {

    "link": {

      "type": "url",

      "value": "instagram_profile",

      "actions": []

    }

  }

}

Integration: Requires "Connect Instagram account" flow.

Sidebar controls: Columns · Aspect ratio · Spacing

Responsive: Grid stacks on mobile.

Constraints:

Max 4 columns
Square images only (MVP)
No captions
No dynamic fetch at render time — must resolve before send


5.6.3 Brand Info Block
Role: Legal compliance and trust building.

{

  "type": "brand_info",

  "content": {

    "brandName": "string",

    "address": "string",

    "email": "string"

  },

  "style": {

    "fontSize": 12,

    "color": "#888888",

    "alignment": "center"

  }

}

Constraints:

Required for all emails
Must include physical address (CAN-SPAM, GDPR compliance)


5.6.4 Unsubscribe Block (Mandatory)
Role: Legal compliance and user control.

{

  "type": "unsubscribe",

  "content": {

    "text": "Unsubscribe or Manage Preferences",

    "unsubscribeUrl": "",

    "preferencesUrl": ""

  },

  "style": {

    "fontSize": 12,

    "color": "#888888",

    "alignment": "center"

  }

}

Rendering:

<tr>

  <td align="center">

    <a href="UNSUB_URL">Unsubscribe</a> |

    <a href="PREF_URL">Manage Preferences</a>

  </td>

</tr>

Hard rules:

Cannot be deleted
Cannot be hidden
Always the last element in the footer


6. CTA System — Button Extension
The CTA system extends the base Button Block with additional behavioral and styling capabilities.
6.1 Core Role
CTA is:

Conversion driver
Visual anchor
Behavioral trigger system

CTA = navigation + behavioral trigger. This is the system moat.


6.2 CTA Data Model
{

  "id": "cta_1",

  "type": "button",

  "content": {

    "text": "GET THE DECK"

  },

  "style": {

    "preset": "rounded",

    "backgroundColor": "#4A4746",

    "textColor": "#FFFFFF",

    "fontFamily": "Optima",

    "fontWeight": "Regular",

    "fontSize": 18,

    "textTransform": "uppercase",

    "letterSpacing": 1.8,

    "lineHeight": 1.2,

    "borderRadius": 6,

    "borderColor": null,

    "alignment": "center",

    "widthMode": "auto",

    "padding": {

      "top": 12,

      "bottom": 12,

      "left": 24,

      "right": 24

    }

  },

  "link": {

    "type": "url",

    "value": "https://example.com",

    "actions": []

  },

  "meta": {

    "savedStyleId": null,

    "priority": "primary"

  }

}


6.3 CTA Actions (Extensible)
{

  "type": "add_to_segment | remove_from_segment | add_to_workflow | remove_from_workflow | set_custom_field",

  "payload": {}

}


6.4 Constraints
Minimum height: 44px
Text required
Max 2 CTAs per section


7. Section JSON Library — Templates
7.1 Overview
The Section JSON Library defines a set of pre-built, structured, and validated sections that users can insert into an email. These sections are:

Fully composed using the Block system
Pre-configured with layout, spacing, and responsive behavior
Constrained to prevent layout breakage
Designed for high usability and conversion

The library shifts the system from freeform building to guided composition.


7.2 Purpose
Benefit
Description
Faster creation
Users insert complete sections instead of assembling layouts manually
Design safety
All sections follow validated structures and constraints
Consistency
Spacing, typography, and hierarchy are standardized
Conversion optimization
Sections are designed for specific roles (Hero, CTA, Product)
Reduced cognitive load
Users choose from meaningful section types instead of raw blocks



7.3 Conceptual Model
Users interact with:

  → Sections (primary unit)

  → Blocks (secondary editing unit)

Internal structure:

  Sections → Rows → Columns → Blocks


7.4 Section Definition Schema
{

  "id": "string",

  "label": "string",

  "category": "attention | value | proof | action | product | engagement | footer",

  "structure": {},

  "defaultContent": {},

  "constraints": {},

  "editableFields": [],

  "meta": {

    "variantGroup": null

  }

}

Field definitions:

Field
Description
id
Unique identifier for the section template
label
Human-readable name shown in the UI
category
Grouping in the insert panel
structure
Layout using Section → Row → Column → Block
defaultContent
Initial content on insert (text, images, CTA labels, links)
constraints
Structural and behavioral restrictions (maxBlocks, allowColumnChange, maxCTAs)
editableFields
What the user can modify (e.g. headline.text, cta.link)
meta.variantGroup
Supports experimentation and A/B testing



7.5 Example — Hero Section
{

  "id": "hero_offer_v1",

  "label": "Offer Hero",

  "category": "attention",

  "structure": {

    "rows": [

      {

        "columns": [

          {

            "blocks": [

              { "type": "text", "role": "eyebrow" },

              { "type": "text", "role": "heading" },

              { "type": "button", "role": "primary_cta" }

            ]

          }

        ]

      }

    ]

  },

  "defaultContent": {

    "eyebrow": "You're invited",

    "heading": "50% OFF SITEWIDE",

    "cta": {

      "text": "Shop Now",

      "link": "#"

    }

  },

  "constraints": {

    "maxCTAs": 1,

    "allowColumnChange": false

  },

  "editableFields": [

    "eyebrow.text",

    "heading.text",

    "cta.text",

    "cta.link"

  ]

}


7.6 Design Principles
No freeform layout creation
Preset-driven composition
Limited but sufficient flexibility
Mobile-first behavior baked in


7.7 Relationship to Other Systems
System
Relationship
Block System
Sections are composed of Blocks
CTA System
CTA behavior is embedded within section blocks
HTML Compiler
Sections are compiled into email-safe HTML
State Management
Sections exist as nodes within editor state



8. HTML Compiler — JSON to Email
8.1 Overview
Deterministic renderer: JSON → Email-safe HTML

Must guarantee:

Outlook-safe
Gmail-safe
No layout breakage
Inline CSS only
Deterministic output (same input → same HTML)


8.2 Compiler Pipeline
compile(emailJSON):

  normalize

  validate

  resolveStyles

  renderTree

  postProcess


8.3 Input Contract
{

  "sections": [],

  "theme": {},

  "meta": {}

}


8.4 Pipeline Stages
Stage
Description
Normalization
Apply defaults · Expand presets · Assign IDs · Normalize CTA actions
Validation
Structure correctness · Block constraints · Section constraints
Style Resolution
finalStyle = block + section + theme
Render Tree
Table-based layout only: Section → Row → Column → Block
Post Processing
Inline CSS enforcement · Outlook fixes · Link sanitization



8.5 Block Renderers
render(block) → HTMLString for each type:

Text
Image
Button
Divider
Spacer
Logo (see Section 4.4)


8.6 CTA Link Resolution
resolveLink(link):

  appendTrackingParams()

  encodeActions()


8.7 Responsive Strategy
Fluid tables
Minimal media queries


8.8 Post-Processing Rules
Inline CSS enforcement
Outlook conditional comment fixes
Link sanitization


8.9 Safety Rules
No flexbox
No grid
No JavaScript
No external CSS


8.10 Performance
Target: < 100ms compile time
Memoization of repeated renders


8.11 Extensibility Hook
postRender(block):

  injectTracking

  injectVariants


9. Editing Experience
9.1 Inline Editing
Element
Interaction
Text
Direct edit in place
CTA
Text editable inline
Image
Click to replace



9.2 Floating Toolbar
Available on block selection:

Move
Duplicate
Delete
Save


9.3 Insert System
"+" button available above and below each block.


9.4 Sidebar Tabs
Button
Font
Link
Block


10. Responsive System
Breakpoint
Width
Desktop
~600px
Mobile
~320px


Rules:

Columns stack on mobile
Images scale fluidly
CTA expands to full width on mobile


11. State Management
{

  "editor": {

    "sections": [],

    "selected": {},

    "history": [],

    "future": []

  },

  "ui": {

    "previewMode": "desktop"

  }

}


12. UI Structure
Panel
Content
Left
Sections insert panel
Centre
Email canvas
Right
Block properties sidebar
Top
Mode toggle, preview, save, export



13. Performance & Constraints
Performance Targets
Operation
Target
Edit response
< 50ms
HTML compile
< 100ms
Partial rendering
Memoized components

Hard Constraints
No freeform layout creation
No absolute positioning
No custom HTML input from users
No flexbox, grid, or JS in compiled output


14. Future Extensions
Variant-based section A/B testing via meta.variantGroup
AI-generated sections
Dynamic personalization per user
Performance-based section optimization

{

  "meta": {

    "variantGroup": null

  }

}


System Summary
This system combines three layers into a single cohesive execution engine:

Layer
Component
Structured content
Sections + Blocks
Behavioral layer
CTA System
Execution engine
Deterministic HTML Compiler


docs: add email builder spec for Claude Code handoff
