---
name: Statecraft
description: A flat, warm technical workspace for automata learning.
colors:
  primary: "#235C50"
  rail: "#252B29"
  paper: "#E8E4DA"
  canvas: "#E2DFD5"
  surface: "#F1EDE3"
  ink: "#252B29"
  muted: "#505853"
  border: "#7B8078"
typography:
  heading:
    fontFamily: "Manrope, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  control: "4px"
  panel: "0px"
  inspector: "6px"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
---

## Visual direction
Preserve the working graph editor and learning workflows. Warm stone, parchment, mineral grey, charcoal and one deep teal accent form the complete palette. Flat surfaces are separated by spacing and borders. Shared CSS variables apply to React Flow as well as application components.

## Type and layout
Self-hosted Manrope headings and DM Sans body text. Body copy is 15–16px, supporting copy and controls 13–14px. The desktop rail is 222px, with a flexible canvas and 302px tutor panel. At 1200px the tutor stacks below the graph. At 780px navigation moves above the workspace and keeps visible labels. At 560px supporting columns stack. Progress totals are an inline text summary, with genuine mastery bars and attempt history.

## Interaction and accessibility
Buttons and fields have at least 44px touch targets. Transition label targets stay 44px at every canvas zoom. State labels remain legible when the graph is zoomed out. Keyboard focus uses a 3px outline. Inspectors wrap and scroll within narrow canvases. Keep transition forms, transition tables, node editing, transition-only deletion, undo, and keyboard selection.

Active states change immediately to teal with parchment text. Accepting states use double rings. Static arrowheads express transitions. Timed simulation and subset construction remain functional; no edge, token, or hover animation is used. Outcome labels and border weights carry status, without additional colors.

## Copy and AI
Use direct instructions and real data. No authored em dashes in visible copy, titles, placeholders, or generated solution formatting. Ollama is instructed to avoid them. Its prose is normalized before caching/display, with literal state names and symbols protected. Canonical engine details are appended without transforming automaton data. Engine interfaces, question bank, account behavior and database schema remain unchanged.

## Restrictions
Do not introduce any of the following:

- Harsh or excessive gradients, radial gradient orbs, neon, rainbow or multicolor UI, generic pastel palettes, or purple-and-black schemes.
- Pure white surfaces, drop shadows, liquid glass, glassmorphism, blur treatments, or excessively rounded corners.
- Lucide, sparkle icons, emoji UI elements, ornamental checkmarks, decorative sidebar diagrams, dotted canvas decoration, or checkmark-based bullet lists.
- Inter, Geist, or Space Grotesk fonts.
- Colored decorative left stripes, bento grids, decorative generic grids, three feature cards in a row, terminal-window UI, or three-tier pricing sections.
- Fake testimonials, fabricated claims, fake or nonfunctional product demonstrations, or the copy pattern “It's not X, it's Y”.
- Animated arrows, decorative hover animation, or animated token entrances.
- Authored em dashes in interface copy.

Circular states, accepting-state rings, static mathematical arrows, and functional progress bars are permitted. No new screens or replacement product workflows are part of this refinement.

## Verification
The tutor now includes a plain-text doubt chat below progressive hints. It reuses the
existing colors, 4px form corners, 44px actions and supporting typography. A bounded,
scrollable conversation shows speaker labels, followed by a labeled question field,
Ask Ollama, Stop reply and Clear chat controls. Replies are identified as AI explanations;
chat does not modify scoring. The layout stacks within the existing tutor panel.

Source/dependency scans, type checks, production build and 71 tests pass. Browser checks cover deletion, undo, multi-symbol and epsilon transitions, keyboard selection, simulation, hints, account forms and saved scoring. Design inspection covers 1440px, 390px, and 720px CSS reflow (equivalent to a 1440px viewport at 200%). No horizontal overflow or undersized buttons/fields was found. Text token contrast is at least 5.50:1 on the three light surfaces; border contrast is at least 3.03:1. Audit evidence is recorded in artifacts/design-audit.json. This is a bounded application audit, not full accessibility certification. The bundled Impeccable detector was unavailable.
