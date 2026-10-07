# PR #219 — Top Menu & Hero Typography v1

## Admin controls

Go to **Admin → Homepage Builder**. Changes use the existing Admin-only, versioned **Save Draft → Preview draft → Publish** workflow. Changes do **not** appear on the public website until published.

### Top menu

In **Site identity → Top menu — desktop & mobile**, Admin can:

- Edit English, Thai, and Simplified Chinese labels (switch editing language).
- Reorder six predefined destinations with the up/down controls.
- Show or hide any item. The logo always navigates home, even if the Home menu item is hidden.
- Restore default labels, order and visibility. Blank edited labels revert to their defaults.

Destinations and actions remain **hard-coded** and cannot be edited as arbitrary links. Both desktop and mobile navigation consume the same published `branding.topMenu` configuration. Older documents without the field still show all six default items in their prior order.

### Hero tagline, headline, subtitle

Choose the **Bakery Hero** section in the right-hand editor.

- **Tagline:** language-specific text; font (`JOKO display`, `JOKO body`, `Handwritten`, default), size (9–42 px), bold/italic and alignment.
- **Main headline:** controlled rich-text editing with manual line breaks; base font, size, bold/italic and alignment; **line-by-line** font, size and alignment; plus **per-word** font, size, color, weight and italic overrides.
- **Subtitle:** rich-text editor plus base font, size (12–42 px), bold/italic and alignment.
- **Preview:** same `HeroTypography` renderer in the page and editor; viewport controls for desktop/tablet/mobile. These changes also work for EN, TH and ZH with independent localized line layouts.
- **One-click design starting point (EN only):** **Apply “Baked & Beyond” preset (EN)** sets `GOOD BAKING. ACCESSIBLE TO EVERYONE.` and three centered lines:
  1. `Baked & Beyond`
  2. `for a` (smaller)
  3. `Brighter` (orange, notebook handwriting, italic) `Today` (charcoal, regular)

The preset modifies only the **English draft headline and tagline**, never the subtitle, Thai/Chinese content, public site or published revisions. Admin can edit every part afterward.

## Implementation and safety

- Existing `home.hero.v1` fields extended with **optional**, validated, bounded typography settings; no schema-version increase or database migration.
- Existing `BuilderRichText` supports optional word font and size; explicit `false` on bold/italic overrides allows `Today` to be regular even under a bold base title.
- Font choices are restricted to known brand and notebook stacks; colors to the published text/accent/turquoise tokens. No arbitrary CSS, HTML or URLs are persisted.
- The six menu destinations are stable identifiers and validated exactly once per published document. User accounts, cart and language buttons remain outside editable menu items.
- The existing published homepage document and revisions remain unchanged until Admin explicitly publishes. Rollback via existing Homepage Builder revision history.
- A **lockfile-only** `source-map-js` `1.2.1 → 1.2.2` refresh resolves security advisory `GHSA-68fv-2mgg-jv7q`; no new direct dependencies.

## QA

- `npm ci`, TypeScript, ESLint, static assets, design-system audit, production build, Tailwind compatibility and both full/production dependency security audits.
- Headless/SSR targeted tests: legacy fixture validates without new fields; safe nav defaults/reorder/hide; arbitrary menu destinations rejected; rich-text 3-line example accepted; oversized word font rejected; notebook font, orange color, regular charcoal word, centered lines preserved when rendered.
- Admin authenticated editing, Save Draft, Preview and Publish should receive interactive acceptance testing after deployment; no production data was written by this PR.

### Verified browser behavior

Local Chromium preview was checked at 1440px desktop and 390px mobile. The existing published hero and tagline remained visible, all six existing desktop navigation labels were unchanged, and the mobile menu opened with the identical labels. Separate logic tests passed for English three-line word styling, legacy document compatibility, safe menu reorder/hide and strict input validation.

## October 6 – defaults and discoverability

- The **Site identity** label is a small label at the top of the **left-hand pane** in Admin → Website / Homepage Builder (not a separate Admin navigation tab). It now reads **Top Menu & Branding** beneath that label, with the **Top Menu** expanded immediately below it before the logo and typography controls. On desktop, use the small `›` arrow to reopen that pane if collapsed.
- Default English menu labels are now **Baked** and **Beyond**. Thai and Chinese remain unchanged, as do the fixed navigation destinations. If an Admin has published customized menu labels, those still take precedence.
- Default English hero tagline is now **Love for Baking. Shared with Everyone.**. This is the fallback when the published hero has no English tagline; explicit published text still takes precedence. The default is aligned across public hero, Builder preview and the optional English-only preset. Display respects the specified capitalization (no forced uppercase).
- No Homepage Builder draft or published database revisions are changed by these default updates. They take effect on the public site only after production deployment.

## 2026-10-07 — Preview fidelity, line spacing and EN/TH/ZH

The **public Homepage** runs in Experience mode. Earlier Builder preview used a separate
Hero mock with different layout breakpoints, section widths, image treatment, and
headline spacing. Both **Live Draft** and **Preview Draft** now opt into rendering the
*same* `HomepageExperiencePage` hero used on production, injected with the
unsaved/saved Builder Hero section and active editor language. Only the Hero is
guaranteed this shared composition: the website's outer navigation sits outside
the Hero; other Builder section previews are still representations rather than
pixel-exact Experience-mode reproductions.

In the Bakery Hero section, use **Headline & subtitle language → EN / TH / 中文**.
The tab switches the Builder preview language too. Each language has separate
plain/rich headline and subtitle text, per-word formatting, line/font alignment,
headline line styles, and **locale-specific headline and subtitle typography**
(overriding legacy shared styles). Under each **Typography** control, set
**Line spacing (× font size)**, from **0.8** to **2.5** (e.g., **0.9** tight,
**1.5** airy), with blank preserving the previous style. Unitless CSS
`line-height` applies consistently to natural text wrapping and explicit
newlines in the actual public renderer.

Thai/Chinese word formatting uses browser word segmentation where available;
otherwise it falls back to whitespace segmentation. Text can still be styled
in the rich-text selection editor on older browsers.

Old published revisions remain valid: the extra fields are optional and
legacy shared text styles still act as fallback. An existing Thai/Chinese
plain headline is honored even without a `titleRichText` entry. No schema
migration or changes to stored unpublished/published content are performed by
this code change. As before, the public site shows the **published revision**,
not unsaved or merely saved drafts. Content parity requires publishing and
a matching locale/viewport.
