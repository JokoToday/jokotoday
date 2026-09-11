# QR Pass Admin Designer v1

## Purpose

QR Pass Admin Designer v1 lets an authenticated JOKO TODAY Admin change the branding and visible sections of the customer QR Pass without editing application code.

The design is stored as one versioned JSON document in the existing `cms_settings` table under:

`qr_pass_config_v1`

No new database table or migration is required.

## Editable fields

- logo URL or bundled asset path
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

v1 accepts either:

- a bundled asset path beginning with `/`; or
- a public `https://` image URL.

Direct Admin file upload is intentionally deferred until the Storage write policy and desired asset-management lifecycle are explicitly validated. This avoids silently expanding Storage permissions as part of a presentation-only feature.

## Runtime behavior

Customer QR Passes load the saved configuration when rendered. If the setting is missing, malformed, or cannot be read, the component falls back to the checked-in QR Pass v2 defaults.

Saving occurs only when an authenticated Admin explicitly clicks **Save QR Pass design**. Merely viewing the designer, opening a customer QR Pass, CI, or building the frontend performs no production write.

## Deployment dependency

This feature is stacked on QR Pass v2 (PR #123). Merge/release QR Pass v2 before or together with the Admin Designer.
