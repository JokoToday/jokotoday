# QR Pass Admin Designer v1

## Purpose

QR Pass Admin Designer v1 lets an authenticated JOKO TODAY Admin change the branding and visible sections of the customer QR Pass without editing application code.

The design is stored as one versioned JSON document in the existing `cms_settings` table under:

`qr_pass_config_v1`

No new database table or migration is required.

## Editable fields

- bundled same-origin logo asset path
- logo scale (60–140%)
- title
- subtitle
- footer text
- show/hide title
- show/hide subtitle
- show/hide customer name
- show/hide VIP short code
- show/hide two-dot footer mark
- show/hide footer text
- outer background
- card surface
- card border
- QR frame color
- heading color
- accent/VIP color
- customer-name color
- secondary-text color

The Admin workspace includes a live preview using dummy member data and a harmless QR target (`https://joko.today/`).

## Locked QR safety zone

The following are deliberately not editable in v1:

- QR foreground/background colors
- QR error-correction level
- QR quiet zone
- QR physical area
- card physical PDF size

The QR remains black-on-white with error correction `H`, the existing quiet zone, and the existing scan-safe physical area. PDF output remains 55 × 85 mm.

## Logo handling

v1 accepts only a bundled same-origin asset path beginning with a single `/`, for example:

`/JOKO.TODAY_logo.v0.4.webp`

External image URLs are deliberately not accepted in v1 because a remotely hosted image may render in the browser but still fail canvas export when its server does not allow cross-origin image access. Restricting v1 to same-origin assets keeps PNG/PDF generation deterministic.

Direct Admin file upload is intentionally deferred until the Storage write policy and desired asset-management lifecycle are explicitly validated. A later Storage-backed upload flow can extend the existing config format without weakening export reliability.

## Runtime behavior

Customer QR Passes load the saved configuration when rendered. If the setting is missing, malformed, cannot be read, or contains an unsupported logo path, the component falls back to the checked-in QR Pass v2 defaults.

Saving occurs only when an authenticated Admin explicitly clicks **Save QR Pass design**. The QR Pass download controls are explicitly non-submit buttons, so previewing a PNG or PDF cannot publish an unsaved Admin draft. Merely viewing the designer, opening a customer QR Pass, CI, or building the frontend performs no production write.

## Deployment dependency

QR Pass v2 (PR #123) was merged first. QR Pass Admin Designer v1 is the follow-up layer that configures that card.
