---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-11
related: ADR-017, ADR-024
supersedes-partially: ADR-017 (the "no UI kit" rule, for the dashboard only)
---

# ADR-031 — Dashboard UI stack: Tailwind + shadcn-style components

## Decision

The admin dashboard adopts **Tailwind CSS v4** (Vite plugin) and a
hand-copied, theme-owned set of **shadcn-style components** (Button,
Card, Badge, Input/Label/Textarea — cva + tailwind-merge + Radix Slot +
lucide icons), themed as **design tokens v2 "deep ocean futurist"**:
abyssal background with aurora gradients and a faint circuitry grid,
electric cyan→violet AI accents, glass surfaces, Linear-tight typography
and borders, Notion-calm spacing.

Two boundaries hold:

- **The widget keeps zero dependencies** (ADR-024). It embeds in client
  pages; shadcn is React-only and Tailwind would multiply its 10 kB. Its
  hand-owned stylesheet adopts the same v2 tokens so both surfaces are
  one brand.
- **Legacy class names stay stable contracts** during migration: the
  Tailwind build re-skins `.card`/`.badge`/`button`/table styles in
  `@layer components`, so every screen wears the new design immediately
  while pages convert to components incrementally (shell, login,
  overview and status badges converted first).

## Context

ADR-017 chose a hand-owned stylesheet to keep the MVP dependency-light.
Daniel — the owner — asked explicitly for Tailwind + shadcn with a
futurist AI look influenced by Linear and Notion. The dashboard is an
internal React app where a styling toolchain is cheap and shadcn's
copy-in model keeps us owning every component (no runtime kit, no theme
fight): the spirit of ADR-017 (own your UI) survives the letter.

## Consequences

- New dashboard dev deps: tailwindcss, @tailwindcss/vite, cva, clsx,
  tailwind-merge, lucide-react, @radix-ui/react-slot — all build-time or
  tiny runtime; `npm audit` clean at adoption.
- shadcn components are COPIED IN and themed via our CSS variables —
  upstream changes never break us, and there is exactly one source of
  truth for tokens (`styles.css` `@theme`).
- The dashboard logic tests are untouched (they never asserted markup);
  pages still using legacy classes look right but should migrate to
  components as they are next edited.
- Out of scope: light mode, per-tenant theming, the widget (zero-dep by
  contract), charts libraries (the CSS bars stay).
