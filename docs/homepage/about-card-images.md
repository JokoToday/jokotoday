# Homepage — About JOKO images

The public **About JOKO** section has three cards: **Our Bakery**, **Who’s in Charge?**, and **Our Story**. Each may display one image **above** the title and text.

## Admin workflow

1. Open **Admin → Homepage Builder**.
2. In **Site identity**, expand **About JOKO — card images**.
3. Upload a separate JPG / PNG / WebP image (up to 8 MB) for each card. The existing media pipeline removes image metadata, uses an Admin-authenticated signed upload, and creates a public media URL. The preview below each card shows the current selection.
4. Optionally edit the image's alt text using the EN / TH / ZH language switcher. If an alt translation is blank, the published page uses English or the localized card/person name.
5. **Save Draft → Preview draft → Publish**. Until publication, the public Homepage is unchanged. If removing an image, Save/Publish also applies to the removal.

- **Who’s in Charge?** defaults to the published hero notebook illustration of Joe & Phuttan. Uploading an image replaces it for the About card **and Meet Founders page**; removing that separate image falls back to the notebook portrait.
- **Our Bakery / Our Story** initially remain text-only if no images are uploaded; no invented stock images or visible customer-facing upload placeholders appear.
- Both new images use the same fixed 160px frame, with `object-cover` to preserve card layout. The people portrait uses `object-contain` to avoid cropping the drawing.
- Settings live in the existing published Homepage Builder document as optional `branding.aboutCards`. Older stored revisions are accepted unchanged. The existing Builder Save/Publish/Revision rollback covers these fields, and no new Supabase migration or access policy is required.
- The separate **Not Bread. Still Good.** homepage band now has a deeper turquoise (`#ACCEC8`), maintaining the existing mineral/pencil sketch texture and dark text contrast.

Validation: clean npm install, TypeScript, lint, design/static media audits, Vite build, Tailwind compatibility and dependency security audit; public anonymous screenshot and computed-style checks. Authenticated upload and publish controls still require interactive Admin review in preview before deployment.
