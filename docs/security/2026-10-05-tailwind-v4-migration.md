# JOKO TODAY — Tailwind 3 → 4 design-preserving migration

**Branch:** `feat/tailwind4-visual-parity`
**Baseline:** `main` at `ae4e0a6ba8b23897380b2f63248e1941319190ac` (includes PR #216)
**Scope:** frontend build toolchain, existing theme compatibility and legacy modal opacity utilities. No backend, database, content, payment, auth or deployment changes.

## Why this migration

The old `tailwindcss@3.4.17` toolchain pulled in vulnerable `braces@3.0.3` via `chokidar`, `fast-glob`, and `micromatch`. The last release of `braces` in the old major line remains affected by `GHSA-vfj7-8cjw-p6xm`. Dependency overrides within Tailwind 3 cannot safely resolve this. The migration replaces the deprecated build-toolchain chain with `tailwindcss@4.3.3` and `@tailwindcss/vite@4.3.3`.

## Design preservation decisions

1. Integrate the first-party Vite plugin; remove the old Tailwind PostCSS plugin and redundant explicit `autoprefixer`/`postcss` direct dev dependencies.
2. Import Tailwind 4 via CSS and explicitly load the existing JavaScript configuration using `@config`. Do not silently discard JOKO's existing brand palette or headline/body font families.
3. Maintain the original Tailwind 3 palette, shadows, corner radii and default ring values in `src/legacy-tailwind-v3-tokens.css`. Also preserve v3 Preflight defaults for border tones, placeholders, pointer cursors and dialogs.
4. Keep old three-channel JOKO color variables (such as `--joko-color-brand-600`), while avoiding name collisions with Tailwind 4's generated `--color-*` and `--font-*` theme variables. The Curiosity/Notebook local background overrides are maintained and its bespoke shadow continues to read the same original JOKO color.
5. Tailwind 4 now compiles **69 previously inert arbitrary-opacity utilities** that Tailwind 3 ignored (such as `bg-[#F4EFE5]/72`). Activating them would unexpectedly recolor existing JOKO screens. Explicit `@source not inline()` exclusions preserve the *actual v3 rendered appearance*, not the likely intention of those old classes. A later deliberate color/design pass can re-enable individual utilities. The exclusions are listed in `src/index.css` for auditability.
6. Replace deprecated v3 modal/icon `bg-opacity-*` combinations with equivalent v4 slash-alpha classes (`bg-black/50`, `bg-white/20`) so overlays remain the same rather than becoming opaque.
7. Retain existing component CSS, custom paper/sketch textures, homepage artwork, notebook presentation, screen layouts and content. No bulk, automatic template rewriting was performed.

## Local verification (clean isolated worktrees, same public data)

A detached Tailwind 3 baseline and Tailwind 4 candidate were built from the same commit. Preview servers ran only on localhost with matching environment settings. Screenshots were compared using headless Chromium with fixed viewport sizes and virtual-time budget; no customer orders or mutations were triggered. Image comparison threshold was absolute pixel-channel difference >15, intended to find obvious visual regressions, not to prove pixel-perfect browser equivalence.

| Anonymous page | Desktop 1440 × 900 | Narrow 500 × 860 |
|---|---:|---:|
| Products (all) | 0.43% | 1.21% |
| Products (non-bakery) | 0.43% | 1.21% |
| Checkout entry | 0.35% | 0.45% |
| Admin login | 0.00% | 0.00% |
| Gallery | 0.26% | 0.37% |
| What People Say | 0.89% | 1.29% |
| About anchor | 0.00% | 0.00% |

Homepage hero: under 1% different pixels at 1440 × 900 and **0.33% at 390 × 844** after suppressing previously inert opacity utilities. Differences in anti-aliasing and asynchronous page rendering remain. Screenshot outputs are ephemeral QA data, not tracked production assets.

## Automated checks required for review

Run all from a clean install:

```bash
npm ci
npm run audit:design-system
npm run audit:static-assets
npm run typecheck
npm run lint
npm run build
npm run audit:tailwind-compat
npm audit --audit-level=high
```

The new post-build `audit:tailwind-compat` guard checks critical JOKO theme utility generation, previous v3 default colors/corners, unchanged legacy gradients, functional overlay alpha replacements and suppression of inert alpha utilities. **This is not a screenshot test**; it complements the manual browser review.

## Manual acceptance still required before deployment

- Test signed-in Admin and Product Staff workspaces, Product Edit, modal overlays, categories, homepage builder and media upload UI.
- Test Pickup/Walk-In desks, staff login, cart drawer and actual checkout steps with representative stock/pickup states **without placing production test orders**.
- Check mobile screens at 390, 500 and tablet sizes, including navigation, modals, input focus rings, Thai and Simplified Chinese labels/fonts.
- Check representative layouts on current Safari, Firefox and Chrome. Tailwind 4's official browser baseline is Safari 16.4+, Chrome 111+ and Firefox 128+; older browsers require a separate support decision.
- Inspect Cloudflare Pages PR preview. Backend schemas, database state, and staff/customer permissions are unchanged.

Upstream guide: https://tailwindcss.com/docs/upgrade-guide

## Release / rollback

This branch is PR-only. **Do not merge or deploy automatically.** Once reviewed, run the existing SHA-locked, rollback-capable production deployment flow and smoke tests. The old `main` commit before this PR was `ae4e0a6ba8b23897380b2f63248e1941319190ac`; a release can be rolled back to the prior deployment artifact if visual or user-flow regressions are found. This change does not require a Supabase migration or Edge Function deployment.
