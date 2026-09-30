# QR Pass Admin Designer v1

## Purpose

QR Pass Admin Designer v1 lets an authenticated JOKO TODAY Admin control the appearance of the customer QR Pass without editing application code.

The design is stored as one validated JSON document in the existing `cms_settings` table under:

`qr_pass_config_v1`

No new database table, migration, RLS policy, or auth change is required.

## Canonical renderer

The customer QR Pass, Admin live preview, PNG export, and PDF export all use the same `BrandedQRCard` component/config path.

The staff operational desks do not maintain a separate printable membership-pass renderer; they scan or look up the customer QR and print order receipts. The legacy `QRCodeDisplay` remains an onboarding/QR-only component and is not the QR Pass renderer.

This keeps the Admin preview aligned with actual customer exports.

## Physical format

The QR Pass is locked to portrait wallet-card proportions:

**55 × 85 mm**

PDF export uses that exact page size and portrait orientation.

## Editable controls

### Logo

- upload/replace via the existing JOKO Media brand upload workflow
- bundled same-origin logos remain valid
- `media.joko.today` brand assets are accepted
- logo scale: 60–140%

### Typography

Font selection is script-aware so card text does not depend on accidental browser fallback.

English:

- Noto Sans
- Inter
- Playfair Display

Thai:

- Maitree
- Noto Sans Thai Looped
- Noto Sans Thai
- Sarabun
- Bai Jamjuree

Chinese:

- Noto Sans SC
- Noto Serif SC

Semantic text roles:

- card title / brand
- customer name
- short code
- small labels / helper text

Each text role has constrained font weight and size controls. Noto Sans includes Light 300, Regular 400, Medium 500, SemiBold 600, Bold 700, ExtraBold 800, and Black 900. The editor reuses the Homepage Editor font option/weight definitions rather than maintaining a second font list.

### Text / visibility

- title
- subtitle
- footer text
- show/hide title
- show/hide subtitle
- show/hide customer name
- show/hide VIP short code
- show/hide two-dot footer mark
- show/hide footer text

### Colors

- outer background
- card surface
- card border
- QR frame
- title / brand
- accent / VIP code
- customer name
- helper text

## Locked QR safety zone

The following are deliberately not editable:

- QR foreground/background colors
- QR error-correction level
- QR quiet zone
- QR minimum physical area
- QR/logo overlap
- card physical PDF dimensions

The QR remains black-on-white with error correction `H`, a white quiet zone, and a fixed scan-safe area.

## Logo export safety

JOKO Media logo images are loaded with anonymous CORS for canvas export. The production JOKO Media domain is the only external origin accepted by the saved QR Pass config.

Arbitrary remote image URLs are rejected by the config parser.

## Runtime behavior

Customer QR Passes load the saved configuration when rendered. Missing, malformed, or unsupported fields fall back independently to checked-in defaults, so older `qr_pass_config_v1` JSON remains compatible.

Saving occurs only when an authenticated Admin explicitly clicks **Save QR Pass design**. Uploading a logo adds it to the local QR Pass draft; the design is not published until Save is clicked.

Preview/download buttons are non-submit controls, so previewing or exporting cannot publish an unsaved Admin draft.

## Architecture

Persistence remains the existing `cms_settings` record. This is intentionally narrower than creating a dedicated design table because v1 is one global QR Pass design document.

If future work introduces multiple named layouts, version history, front/back designs, or per-segment designs, a dedicated model can be considered then.
