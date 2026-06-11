---
project: AURION
document: Design Tokens
folder: 20_DESIGN_SYSTEM
owner: Daniel Gonzalez Junco
status: active-v2
created_at: 2026-05-30
updated_at: 2026-06-11
related: ADR-017, ADR-024, ADR-031
---

# AURION design tokens (v2 "deep ocean futurist" — implemented)

One visual language for the dashboard and the caller widget. The
dashboard expresses these tokens through Tailwind v4 `@theme` + shadcn-
style components (ADR-031); the widget hand-writes the same values in
its zero-dependency stylesheet (ADR-024 boundary). Restyling the product
still means editing tokens, not components.

Daniel's brief for v2: deep ocean evolved into a futurist AI look —
"que se note que usamos IA" — with Linear (tight type, hairline borders,
micro-interactions) and Notion (calm spacing, readable hierarchy)
influences.

## Palette — "deep ocean futurist"

| Token | Value | Use |
|-------|-------|-----|
| `--color-background` | `#070a12` | Abyss: app background |
| `--color-surface` | `#0d1320` | Cards, sidebar (glass over the abyss) |
| `--color-surface-2` | `#141c2e` | Inputs, hovers, table headers |
| `--color-border` | `#1d2638` | Hairlines |
| `--color-foreground` | `#e6ebf5` | Primary text |
| `--color-muted-foreground` | `#8c98ad` | Secondary text, labels |
| `--color-primary` | `#22d3ee` | Electric cyan: actions, focus, glow |
| `--color-secondary` | `#8b5cf6` | Violet: gradient end (the AI hue) |
| `--color-ok` | `#34d399` | Success states |
| `--color-warn` | `#fbbf24` | Pending/attention |
| `--color-danger` | `#f87171` | Errors, destructive |

Brand: 3-stop gradient `#22d3ee → #5b8cff → #8b5cf6` on the wordmark dot,
primary buttons, KPI values and metric bars. Atmosphere: fixed aurora
radial gradients + a faint 44px circuitry grid masked to the top-left —
visible only where surfaces let it breathe. Status badges carry a glowing
dot (`box-shadow: 0 0 6px currentColor`); numbers are tabular (`tnum`).
v1 ("deep ocean", `#0b0e14`/`#5b8cff`) is superseded.

## Type & rhythm

- System stack (`system-ui, -apple-system, "Segoe UI", sans-serif`);
  base 15px, line-height 1.5.
- Headings 600–700 weight; letter-spacing only on the wordmark.
- Spacing scale 4/8/12/16/24/32 px. Radius: 8px controls, 12px cards,
  999px badges.
- Elevation: one soft card shadow; hover raises borders, never shadows.

## Interaction rules

- Visible `:focus-visible` ring (2px `--accent`) on every focusable element
  — keyboard users are first-class (see `accessibility-design.md`).
- Transitions 120ms ease on color/border only; nothing moves on its own
  (see `motion-design.md`).
- Status colors always pair with text (badges carry words, not just color)
  — color-blind safe by construction.

## Scope

Implemented in `apps/dashboard/src/styles.css` and
`apps/widget/src/styles.css`. Component class names are stable contracts;
design changes are token/CSS changes only. A future per-tenant theming API
for the widget would expose exactly these tokens.
