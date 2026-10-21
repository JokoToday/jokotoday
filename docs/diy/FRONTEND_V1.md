# JOKO DIY frontend v1 — editorial preview

Route: `/diy`. Built on the approved photo catalog and clipped notebook concept (2026-10-21). This is a frontend foundation, not the completed publishing system.

## Included

- Shared JOKO shell: sticky mineral-turquoise navigation and existing account/cart controls.
- Scoped Inter headings/body and orange italic headline; existing Itim notebook font. No global homepage font changes or added dependencies. A raster mockup does not identify an exact font.
- Reuses the existing notebook paper component with an optional children slot. Existing notes retain their content and behavior.
- Responsive photo cards; keyword/category filters, empty state, browser-local saved recipes.
- Native accessible modal: deep links `/diy?recipe=shortbread-cookies`, browser Back, Escape, focus containment/return, scroll lock.
- Original source credit and URL; YouTube iframe loads only after user action, using youtube-nocookie. Playback is subject to creator/platform availability.
- EN/TH/ZH interface copy. Editorial fixture titles/descriptions are English, disclosed for other languages.
- Store crosslink uses the existing non-bakery catalog navigation; no cart or payment changes.

## Content boundaries

The collection is visibly labelled preview. All cards use visibly labelled illustrative local stock photos. Video thumbnails could not be loaded in this environment, so the layout uses local placeholders without broken external images. Replace placeholders with recipe-specific approved photos before publication. Original creator video URLs and credits remain independent. The text DIY wordmark is a placeholder pending the approved transparent logo. Five cards lack selected sources and explicitly show a pending state, without misleading video play controls. The notebook feature and shortbread card retain actual creator video URLs. Three shortbread ingredients were checked against the creator's written description in the supplied comparison report; the remaining method, timings, yield, translations and video still need review. Unknown quantities/times are never guessed.

Content is isolated in `src/app/joko-today/diy/recipes.ts`. It does not read/write recipe data in Supabase. No admin, ingestion automation, AI API, translation service, account-synced likes, kitchen-tested claims or purchase-ingredient mapping is implemented.

## Next slice

1. Review the actual rendered UI against the approved mockup on desktop/mobile.
2. Supply the approved transparent DIY logo and editorial photos/permissions.
3. Approve the first complete source-faithful recipe card.
4. Design the admin draft/publish workflow and storage schema separately, retaining creator identity, original URLs and field-level unknowns.
5. Add reviewed source languages and Store ingredient mappings, then evaluate extraction automation against this stable recipe contract.

Do not publish this preview collection as approved editorial content. No migrations or production changes are part of this branch.

## Validation — 2026-10-21

- TypeScript typecheck, scoped ESLint, production build, Tailwind compatibility audit, static-asset audit and whitespace/diff checks passed.
- Chromium/Playwright at 1440×1100 and 390×844: 6 initial cards; Bread filter narrows to 1; unmatched search shows empty state; reset restores collection; saved-only narrows to 1; local save survives reload.
- Source card opens with a query-string deep link and three ingredient checkboxes. Escape restores `/diy`; direct-link close also restores `/diy`.
- Header bounding top remains 0 after scrolling; no mobile horizontal overflow.
- No iframe exists before the load action. Clicking creates the expected youtube-nocookie embed URL. Actual provider playback was not tested: embed network responses were stubbed.
- Thai/Chinese language preference reloads render the corresponding interface language. No page-level JavaScript errors observed.
- All Supabase traffic was stubbed for local UI verification. Screenshots therefore show fallback shell branding, not a verification of current published admin branding or production data.

### Rendered previews

![Desktop implementation](preview-desktop.webp)

![Mobile implementation](preview-mobile.webp)
