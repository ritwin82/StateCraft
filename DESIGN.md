---
name: Statecraft
description: A calm workspace for making abstract machines tangible.
colors:
  primary: "#1c7162"
  rail: "#153f3a"
  paper: "#f3f4ef"
  canvas: "#fafbf8"
  surface: "#ffffff"
  ink: "#203c37"
  muted: "#61716a"
  border: "#dfe5dc"
typography:
  heading:
    fontFamily: "Manrope, sans-serif"
    fontSize: "29px"
    fontWeight: 700
    lineHeight: 1.28
    letterSpacing: "-1px"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  control: "8px"
  panel: "14px"
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

## Overview
The user chose a warm light workspace with a dark rail and teal highlights.
The automaton is the primary graphic; decoration never competes with machine state.

## Colors
Forest anchors navigation; paper supports sustained reading. White panels and the light
canvas separate tasks using borders. Teal identifies actions; amber marks active tokens.

## Typography
Self-hosted Manrope headings pair with DM Sans interface text. State names use the heading
face. Problem statements remain regular weight; toolbars and metadata are compact.

## Layout
Desktop has a 226px fixed rail, flexible graph column, and 294px tutor column. At 1000px
the rail collapses to icons; at 780px the tutor stacks; at 560px navigation moves to the top.

## Elevation & Depth
Resting panels use one-pixel borders. Floating inspectors use
`0 12px 32px -14px #173d3b40`. Active states change tone and receive a small token.

## Shapes
Circular states are mathematical notation; double rings mean acceptance. Panels have
gently curved corners, controls smaller corners. Keyboard focus is explicit.

## Components
Primary buttons are teal with white text. Secondary buttons use botanical tones.
The graph inspector edits start/final status; transition forms and tables support keyboard
workflows. Simulation tokens show active NFA branches. Construction locks mutation controls.
Reduced motion disables decorative animation.

## Do's and Don'ts
- Do preserve the large canvas and clear relationship between machines and feedback.
- Do show real progress and honest empty states.
- Do retain alternatives to dragging graph handles.
- Don't use AI output as a correctness signal.
- Don't replace the user's light workspace identity when adding screens.
