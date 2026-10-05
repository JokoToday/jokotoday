# JOKO TODAY — Dependency security audit, 2026-10-05

Baseline: `main` at `ec48d1c33b441bd8717767e1a6384e00e16eff5e` (PRs #211–#215 merged).

## Remediation in this PR

- Refresh **only** the transitive `dompurify` lockfile entry, from `3.4.14` to `3.4.16`, within `jspdf@4.2.1`'s compatible range.
- `package.json`, direct dependency versions and application code remain untouched.
- Addresses npm advisory [`GHSA-p98j-92pf-mc4p`](https://github.com/advisories/GHSA-p98j-92pf-mc4p).

## Verified from clean install

- `npm ci` — pass.
- `npm run audit:design-system` — pass.
- `npm run audit:static-assets` — pass.
- `npm run typecheck` — pass.
- `npm run lint` — pass (0 errors; 32 existing warnings).
- `npm run build` — pass (Vite chunk-size warnings remain).
- `npm audit --omit=dev --audit-level=low` — **pass, zero production dependency advisories at any severity**.
- `npm audit --audit-level=high` — **still fails**, reporting five high-severity dependency findings in development tooling.

## Open: Tailwind CSS 3 build-time tooling

The full audit still reports `GHSA-vfj7-8cjw-p6xm` (stack exhaustion in `braces`, pulled in through `chokidar` / `micromatch` / `fast-glob` / `tailwindcss`). At this audit, `braces@3.0.3` is the latest published version on npm and is affected. `npm audit fix --force` proposes Tailwind CSS **4.3.3**, which is a major version change from this application's Tailwind **3.4.17**.

Do **not** silently dismiss the development-toolchain risk, force a major Tailwind upgrade, or relax the existing full-audit check to make CI green. Tailwind 4 requires an explicit migration and review of the app's Tailwind and PostCSS configuration, responsive styling, generated classes and production visual output. The remediation above removes the outstanding **production** finding but **does not resolve** this build-time advisory. Schedule Tailwind migration / replacement as a separate reviewed PR with end-to-end and screenshot checks before calling the full dependency audit green.

Production deployment was not part of this PR.
