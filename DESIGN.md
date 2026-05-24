---
name: Sortify
description: Your liked songs, automatically sorted.
colors:
  vinyl-black: "#0a0a0a"
  inner-groove: "#171717"
  carbon: "#262626"
  hairline: "#404040"
  muted-text: "#737373"
  secondary-text: "#d4d4d4"
  body-text: "#ededed"
  connect-green: "#1db954"
  validate-emerald: "#047857"
  assign-blue: "#2563eb"
  unsynced-amber: "#fdba74"
typography:
  display:
    fontFamily: "Geist Sans, Arial, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Geist Sans, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Geist Sans, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Geist Sans, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist Sans, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.1em"
rounded:
  xl: "12px"
  lg: "8px"
  md: "6px"
  sm: "4px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "40px"
components:
  button-connect:
    backgroundColor: "{colors.connect-green}"
    textColor: "#000000"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  button-connect-hover:
    backgroundColor: "#17a349"
    textColor: "#000000"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  button-validate:
    backgroundColor: "{colors.validate-emerald}"
    textColor: "{colors.body-text}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-text}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  button-ghost-hover:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.body-text}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.inner-groove}"
    rounded: "{rounded.xl}"
    padding: "16px"
  genre-chip:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.secondary-text}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
---

# Design System: Sortify

## 1. Overview

**Creative North Star: "The Quiet Curator"**

Sortify is a tool that understands your taste and keeps your library in order without asking for attention. The visual language reflects this: surfaces are dark and understated, like the inside of a record store at closing time. Every element earns its presence. Data occupies the foreground; the interface recedes.

The palette is tonal, not chromatic. Three dark surfaces layer from near-black through card through panel. Color enters as signal, never decoration: emerald confirms a validated classification, orange flags something unsynced, confidence badges use green/yellow/red to communicate certainty. The rare Spotify green appears once, at the moment of initial connection, then disappears from the product entirely.

Components are quiet at rest. Ghost buttons, muted text, hairline borders. On hover, they step forward exactly enough to acknowledge the interaction. Nothing bounces. Nothing announces itself. This is a tool for people who want their music handled well, not a player pretending to be an app.

This system explicitly rejects: Spotify's own UI (too familiar — Sortify is a distinct tool, not a skin of the platform it connects to), generic SaaS dashboard patterns (cold metric card grids, enterprise typography), music streaming dark-mode clichés (neon accents, heavy gradients, purple-on-black), and plain grey minimalism that mistakes blankness for restraint.

**Key Characteristics:**
- Tonal dark palette, three levels deep, no shadows
- Color as signal only — status accents are semantic, never aesthetic
- Compact information density; no decorative whitespace
- Quiet by default, responsive to interaction
- Allcaps tracking-widest labels as the section voice

## 2. Colors: The Pressed Vinyl Palette

Near-monochromatic dark neutrals carry all depth; targeted semantic accents carry all meaning. The palette is closed — no new accent colors without a new semantic role to justify them.

### Primary
- **Connect Green** (`#1db954`): Reserved exclusively for the onboarding "Connecter" CTA. Signals the one moment where Sortify bridges to Spotify's identity. Never used again in the product.

### Secondary
- **Validate Emerald** (`#047857`): Confirms a classification. The "✓ Valider" action button and high-coherence playlist health badges.
- **Assign Blue** (`#2563eb`): Correction and assignment actions in the inbox. Distinguishes "fix" from "confirm" at the action layer.

### Tertiary
- **Unsynced Amber** (`#fdba74` text on `#431407` bg): Flags something awaiting sync in the playlists view. Attention without alarm.

### Neutral
- **Vinyl Black** (`#0a0a0a`): The true ground. Navigation background and deepest surface. Never used as a card background — too dark to read against.
- **Inner Groove** (`#171717`): Card and container surfaces. The primary working layer where data lives.
- **Carbon** (`#262626`): Inner panels, hover-state fills, and classification reason backgrounds. Also the default card border color.
- **Hairline** (`#404040`): Ghost button borders and subtle element dividers.
- **Muted Text** (`#737373`): Labels, metadata, section category headers, placeholder text.
- **Secondary Text** (`#d4d4d4`): Artist names, supporting copy, less-prominent data.
- **Body Text** (`#ededed`): Primary readable text on dark surfaces.

**The One Green Rule.** Connect Green (`#1db954`) belongs to Spotify and to the onboarding handshake. It does not recur as a brand accent in the product. After setup, it vanishes. Its absence is intentional: Sortify's identity is not borrowed from the platform it connects to.

**The Semantic-Only Rule.** Color communicates state, never personality. Emerald means confirmed. Orange means unsynced. Green/yellow/red mean confidence tier. Using any of these as hover tints or aesthetic accents breaks the signal and trains users to ignore it.

## 3. Typography

**Display/Headline Font:** Geist Sans (with Arial, Helvetica, sans-serif fallback)
**Body Font:** Geist Sans (same family, differentiated by weight)
**Tabular Data Font:** Geist Mono (for BPM values, stats, confidence percentages requiring alignment)

**Character:** A single clean sans-serif, differentiated entirely through weight and size contrast. No expressive display faces, no serifs. The type serves the data; it doesn't compete with it.

### Hierarchy
- **Display** (bold, 2.25rem, line-height 1, `font-feature-settings: "tnum"`): Big stat numbers — inbox count, coverage percentage, the 4xl dashboard callout value. Tabular feature always on for alignment.
- **Headline** (bold, 1.5rem, line-height 1.25): Page titles (`h1`). One per page, never repeated.
- **Title** (semibold, 1.125rem, line-height 1.3): Callout values and section-level emphasis. Used sparingly.
- **Body** (regular, 0.875rem, line-height 1.6): Track names, descriptions, classification reasons. Max line length 65–72ch on wide viewports.
- **Label** (semibold, 0.75rem, letter-spacing 0.1em, uppercase): Section category headers ("PLAYLIST HEALTH", "PROFIL ÉMOTIONNEL"). Always `muted-text` (`#737373`). Never applied to interactive elements.

**The Allcaps Label Rule.** The label style (0.75rem, uppercase, letter-spacing 0.1em, muted-text) is reserved for non-interactive structural category headers only. Never apply it to button labels, track titles, or any body copy. Its purpose is orientation, not emphasis.

## 4. Elevation

Sortify is flat by default. No shadows exist anywhere in the system. Depth is achieved entirely through tonal surface stacking: Vinyl Black (nav) → Inner Groove (cards) → Carbon (inner panels and hover states). A card reads as elevated against the nav because it is lighter, not because it casts a shadow.

**The Pressed Vinyl Rule.** Depth through tone, never through shadows. Three surface steps: `#0a0a0a` (ground), `#171717` (card), `#262626` (panel/hover). A fourth level does not exist. Adding `box-shadow` to any element in this system will look like a foreign import — reject it.

The sole exception is the Deezer player iframe embedded in inbox cards: it has its own styling from Deezer's widget. Treat it as an external surface, not a Sortify-designed element.

## 5. Components

### Buttons

Quiet confidence is the operating principle: low-contrast at rest, readable on hover, never decorative.

- **Shape:** Large-rounded (8px, `{rounded.lg}`) for all standard actions. Full-radius (9999px, `{rounded.full}`) for the primary onboarding CTA and all badge-shaped elements.
- **Connect (Onboarding Primary):** `#1db954` background, black text, full radius, 10px/24px padding, semibold. The only full-radius action button in the product.
- **Validate:** `#047857` (emerald) background, `#ededed` text, 8px radius. Confirms classifications in the inbox.
- **Ghost (Default):** Transparent background, `#404040` border, `#737373` text at rest. On hover: `#262626` fill, `#ededed` text. 150ms transition. This is the standard secondary action pattern across the app.
- **Disabled:** `opacity: 0.4`, `cursor: not-allowed`. Same visual structure, just dimmed — no different shape or color change.

### Chips / Genre Tags

- **Genre chip:** `#262626` background, `#d4d4d4` text, 6px radius, 2px/8px padding.
- **Source chip variant:** Transparent background, `#404040` border, `#737373` text. Used to show enrichment source (lastfm, deezer, musicbrainz). Visually subordinate to genre chips.

### Cards / Containers

- **Corner Style:** Gently rounded (12px, `{rounded.xl}`)
- **Background:** `#171717` (inner-groove)
- **Shadow Strategy:** None. Cards read against the page through color contrast alone.
- **Border:** 1px solid `#262626` (carbon). Every card is bordered; no unbordered card variants.
- **Internal Padding:** 16px standard, 20px for dashboard stat cards with larger content.
- **Inner panels** (classification reason blocks, correcting-mode dropdowns): `#262626` background, no additional border — not a nested card.

### Inputs / Fields

- **Style:** 1px solid `#404040` (hairline) border, `#171717` background, 8px radius.
- **Focus:** `focus:ring-1` in `#525252` (neutral-600). A single-pixel lighter ring, no color glow, no background shift.
- **Select:** Identical treatment to inputs. Native `<select>` with explicit background and text color set to avoid browser default styling.

### Navigation

- **Style:** `#0a0a0a` background (vinyl-black), 1px bottom border in `#262626` (carbon). No elevation.
- **Links:** 0.875rem, medium weight. Default: `#737373`. Active/current page: `#ededed`. Hover: `#ededed`. 150ms color transition.
- **Layout:** Horizontal strip, max-width 48rem, 16px horizontal padding.

### Audio Feature Bar (Signature Component)

A compact horizontal data bar in inbox cards showing energy, danceability, and tempo metrics.

- **Track:** 6px tall, `#262626` background, full-radius ends.
- **Fill:** `#a3a3a3` (neutral-400) — intentionally muted. The bar communicates value, not emphasis.
- **Label:** 0.75rem, `#737373`, fixed 80px width for column alignment.
- **Value:** 0.75rem, right-aligned, `#737373`, fixed 28px.

### Confidence Badge

Three semantic states; all share full-radius shape and 0.75rem semibold text.

- **High (≥55%):** `#14532d` background, `#86efac` text.
- **Medium (40–54%):** `#713f12` background, `#fde68a` text.
- **Low (<40%):** `#7f1d1d` background, `#fca5a5` text.
- **Unknown:** `#262626` background, `#737373` text.

## 6. Do's and Don'ts

### Do:
- **Do** use the three-level tonal stack for depth: `#0a0a0a` → `#171717` → `#262626`. Never introduce a fourth surface level.
- **Do** apply the allcaps label style (0.75rem, uppercase, letter-spacing 0.1em, `#737373`) exclusively to non-interactive section category headers.
- **Do** make empty states positive and direct. "Inbox vide — tout est trié ✓" is the model: success, not apology.
- **Do** keep page content at `max-w-2xl` (672px) or `max-w-3xl` (768px). Sortify is a focused personal tool.
- **Do** use full-radius shape for badges and the onboarding CTA; large-rounded (8px) for all other buttons.
- **Do** keep semantic status colors semantic: emerald = confirmed, orange = attention, green/yellow/red = confidence tier.
- **Do** use `font-feature-settings: "tnum"` on all tabular numeric values (track counts, stats, percentages).

### Don't:
- **Don't** use Connect Green (`#1db954`) anywhere in the product after the onboarding step. It belongs to the Spotify handshake, not Sortify's identity.
- **Don't** add `box-shadow` to any element. This system uses tonal layering for depth. Shadows look like imports from another design system.
- **Don't** make the interface resemble Spotify's own UI. Sortify is a distinct tool, not a skin of the platform it connects to.
- **Don't** apply generic SaaS dashboard patterns: identical metric card grids, cold blue brand accents, heavy enterprise typography.
- **Don't** use neon accents, heavy gradients, or purple/green-on-black. Music streaming dark-mode clichés undermine the "distinct tool" identity.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards or list items. Use a background tint instead.
- **Don't** apply gradient text (`background-clip: text`). Single-color text, differentiated by weight or size.
- **Don't** use status colors (emerald, orange, confidence tier colors) as hover tints, brand accents, or decorative flourishes. Their meaning is fixed.
- **Don't** nest cards. Inner containers use a `#262626` background panel with no border — not a card inside a card.
- **Don't** add decorative whitespace or padding to signal importance. Rhythm comes from consistent spacing; silence is not a design tool here.
