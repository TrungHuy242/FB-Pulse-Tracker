---
name: anti-ai-ui
description: Use this skill whenever creating, refactoring, or reviewing frontend UI to avoid generic AI-looking interfaces and produce distinctive, polished, production-grade design.
---

# Anti AI UI Design Skill

Use this skill when building pages, components, landing pages, dashboards, forms, cards, navbars, modals, pricing sections, admin panels, or mobile layouts.

## Goal

Do not generate generic AI-looking UI.

Avoid:
- random purple or blue gradients
- overused glassmorphism
- identical rounded cards everywhere
- fake SaaS template layouts
- emoji-heavy sections
- generic “Welcome back” dashboards
- meaningless shadows
- weak typography hierarchy
- same spacing on every element
- default Tailwind-looking components
- decorative blobs without purpose

## Before Coding

First define the design direction:

1. Product type
2. Target user
3. Visual tone
4. Layout concept
5. Typography direction
6. Color system
7. Interaction behavior
8. What makes this UI different from generic AI-generated design

Choose one clear aesthetic direction, such as:

- editorial and content-first
- luxury and minimal
- brutalist and bold
- calm productivity
- playful but controlled
- technical and dense
- warm human SaaS
- premium fintech
- creator-focused
- mobile-app inspired

Do not mix too many aesthetics.

## Layout Rules

Use intentional composition:
- clear hierarchy
- strong alignment
- meaningful whitespace
- responsive structure
- sections with different visual rhythm

Avoid making every section look like:
- centered heading
- subheading
- 3 cards
- gradient button

## Typography Rules

Typography must create personality.

Use:
- strong heading contrast
- readable body text
- clear label styles
- consistent line height
- restrained font weights

Avoid:
- all text same size
- huge generic hero heading with no structure
- weak contrast between heading and body

## Color Rules

Use a real color system:
- background
- surface
- primary text
- secondary text
- border
- accent
- success
- warning
- error

Do not invent random colors if DESIGN.md exists.

## Component Rules

Every important component should include:
- default state
- hover state
- focus state
- disabled state when relevant
- loading state when relevant
- empty or error state when relevant

## Accessibility Rules

Check:
- semantic HTML
- keyboard navigation
- visible focus rings
- sufficient contrast
- labels for inputs
- ARIA only when needed
- reduced motion support for animations

## Motion Rules

Use motion only when it improves understanding.

Good motion:
- subtle reveal
- menu transition
- loading feedback
- state change feedback

Bad motion:
- random floating cards
- excessive bounces
- decorative animation with no purpose

## Implementation Rules

When coding:
- use existing components if available
- use tokens from DESIGN.md
- use project conventions from CLAUDE.md
- avoid hardcoded random spacing and colors
- keep code clean and production-ready
- make responsive behavior explicit

## Final Review Checklist

Before final answer, review the UI against this checklist:

- Does it avoid generic AI aesthetics?
- Is there a clear design direction?
- Are spacing, typography, colors, and radius consistent?
- Are hover, focus, loading, disabled, and error states handled?
- Is it responsive?
- Is accessibility acceptable?
- Does it match DESIGN.md?
- Does it feel like a real product, not a generated mockup?