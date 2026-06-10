---
project: AURION
document: Design Tokens
folder: 20_DESIGN_SYSTEM
owner: Daniel Gonzalez Junco
status: active-v1
created_at: 2026-05-30
updated_at: 2026-06-10
related: ADR-017, ADR-024
---

# AURION design tokens (v1 — implemented)

One visual language for the dashboard and the caller widget, expressed as
CSS custom properties — no UI kit, no font downloads (system stack), no new
dependencies (ADR-017/ADR-024 rules hold). Every surface reads from these
tokens: restyling the product means editing tokens, not components. This
replaces the v0 placeholder; the goal it stated stands — AURION must look
like an enterprise platform, not an improvised demo.

## Palette — "deep ocean"

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0b0e14` | App background |
| `--surface` | `#121722` | Cards, sidebar |
| `--surface-2` | `#1a2130` | Inputs, hovers, table headers |
| `--border` | `#232c3d` | Hairlines |
| `--text` | `#e8ecf4` | Primary text |
| `--text-dim` | `#8b96aa` | Secondary text, labels |
| `--accent` | `#5b8cff` | Actions, links, focus |
| `--accent-2` | `#7c5bff` | Gradient end (brand) |
| `--ok` | `#34c97e` | Success states |
| `--warn` | `#eab348` | Pending/attention |
| `--danger` | `#ef6363` | Errors, destructive |

Brand mark: a 2-color gradient (`--accent` → `--accent-2`) on the wordmark
dot, primary buttons and KPI values — the only decorative flourish;
everything else is restraint.

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
