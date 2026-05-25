# Claude Code Project Instructions

## Must Read Before UI Work

Before creating, editing, or refactoring any frontend UI, always read:

1. DESIGN.md
2. .claude/skills/anti-ai-ui/SKILL.md

These files define the visual system and anti-generic-UI rules for this project.

## Design System Rules

Use DESIGN.md as the source of truth for:

- colors
- typography
- spacing
- radius
- shadows
- component styling
- layout principles
- do and don't rules

Do not invent new colors, fonts, shadows, or spacing if a token already exists in DESIGN.md.

## Anti AI UI Rules

All UI must avoid generic AI-generated aesthetics.

Avoid:
- random purple/blue gradients
- generic SaaS landing page patterns
- overused glassmorphism
- repeated rounded cards
- meaningless decorative blobs
- emoji-heavy layouts
- default Tailwind-looking sections

Before coding UI, define:

- product type
- target user
- visual tone
- layout concept
- typography direction
- color usage
- interaction behavior
- what makes the UI distinctive

## Component Requirements

For important components, include:

- default state
- hover state
- focus state
- disabled state
- loading state when relevant
- empty state when relevant
- error state when relevant

## Accessibility Requirements

Check:

- semantic HTML
- keyboard navigation
- visible focus states
- sufficient contrast
- labels for inputs
- responsive behavior

## Final UI Review

Before finishing any UI task, verify:

- UI follows DESIGN.md
- UI follows anti-ai-ui skill
- UI is responsive
- UI has good spacing and hierarchy
- UI avoids generic AI slop
- UI feels like a real product