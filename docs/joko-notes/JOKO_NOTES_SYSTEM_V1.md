# JOKO Page Accents v1

## Purpose

JOKO TODAY uses a small number of deliberate visual/editorial accents to add personality without turning every page into a decorative layer.

Ordinary public pages may have **one accent only**:

- a **JOKO Note**; or
- an **illustrated speech bubble**.

This is an either/or rule for ordinary pages.

The **Homepage is the deliberate exception** because it is a long, narrative scroll. Its existing Builder-owned Hero notebook note may coexist with one lower-page bubble placed several sections farther down.

## Accent types

### JOKO Note

A notebook-style editorial interruption carrying Joe & Phuttan’s human voice: recommendation, observation, contextual comment, small story, or gentle personality.

Notes are localized in EN / TH / ZH.

A JOKO Note may add warmth, context, recommendation or personality, but it must never be the only place for price, stock, cutoffs, pickup eligibility, payment instructions, cancellation rules, errors, security instructions, or anything required to complete a purchase.

### Illustrated speech bubble

A short visual brand reaction such as **“Oh my Good-ness.”**

The bubble is treated as finished artwork rather than translatable UI text. Its English wordplay remains unchanged on Thai and Chinese versions of the site.

The same bubble artwork can also be reused outside the website — for print, packaging, stickers, cards and other brand material.

## Placement model

Placement is code-owned.

Editors do not drag accents to arbitrary x/y coordinates. Each accent type has registered responsive safe zones:

```
page_key + accent_type + placement_key
```

Admin chooses:

1. page;
2. accent type;
3. one of the safe zones registered for that page/type;
4. content/artwork;
5. draft or published state.

Responsive positioning remains owned by the frontend.

## Either/or enforcement

The canonical store remains `site_joko_notes` for backwards compatibility.

The database has a unique constraint on:

```
(site_key, page_key)
```

so there can be only one Page Accent row per page.

The Homepage Hero notebook note is not stored in this table; it remains part of the Homepage Builder document. Therefore the Homepage can have the Builder-owned Hero note plus one lower-page Page Accent without weakening the one-row rule for the Page Accents table.

The `accent_type` field is either:

```
note
bubble
```

Changing a page from Note to Bubble updates that same row. It does not create a second accent.

## JOKO Note controls

Admin may edit:

- safe zone;
- publish / draft;
- localized heading EN / TH / ZH;
- localized body EN / TH / ZH;
- optional note image;
- localized image alt text;
- optional link;
- controlled font preset;
- heading/body size;
- controlled rotation;
- controlled image layout.

Paper shape, tape, holes, shadows and arbitrary page coordinates remain design-controlled.

## Bubble controls

Admin may edit:

- registered bubble safe zone;
- bubble illustration upload;
- English accessibility label;
- optional link;
- size preset: small / medium / large;
- publish / draft.

Bubble artwork is intentionally not translated.

Bubble artwork is stored separately from JOKO Note imagery so switching accent types cannot accidentally reuse the wrong image.

## v1 safe zones

### Homepage — Bubble

- **Before About JOKO** — between “Not Bread. Still Good.” and the About JOKO section, well below the Hero.

The Homepage Hero notebook note remains managed in Homepage Builder. No second Page Accent row is allowed for Home in v1.

### Products — JOKO Note

- **Below browse controls**
- **Below categories**
- **After catalogue**

### Products — Bubble

- **Header center** — visually between the Products heading and browse controls on desktop; below the heading on smaller screens.

This is the first web bubble placement and is intended for the “Oh my Good-ness.” artwork.

### How It Works — JOKO Note

- **Below introduction**
- **After the four steps**
- **Before Start Ordering**

No bubble safe zone is registered yet.

### About — JOKO Note

- **Below page title**
- **After story**
- **Before pickup locations**

No bubble safe zone is registered yet.

New bubble safe zones should only be added after reviewing the actual responsive composition of the target page.

## Components

`JokoNote`
- notebook visual primitive.

`JokoNoteSlot`
- loads only published accents where `accent_type = note`.

`JokoBubbleSlot`
- loads only published accents where `accent_type = bubble`;
- renders the uploaded illustration unchanged across languages;
- applies responsive size presets.

`JokoNotesManagement`
- retained component filename for backwards compatibility;
- Admin UI is now presented as **Page Accents**.

## Security

- Public readers can select published accent rows only.
- Admins manage accents through the existing admin RLS gate.
- Draft accents never render publicly.
- Uploaded images reuse JOKO Media; source metadata is stripped in-browser before upload.

## Homepage compatibility

The Homepage Hero notebook note remains Builder-owned. Page Accents v1 does not rewrite Homepage Builder revisions.

The long Homepage is the intentional exception to the ordinary-page either/or presentation rule: one Hero notebook note may coexist with one lower-page bubble. The lower bubble is still controlled through Page Accents and is limited to the registered **Before About JOKO** safe zone.

## Editorial test

For a JOKO Note, ask:

> If this note vanished, could a customer still understand and complete the page?

If not, that information belongs in normal UI.

For a speech bubble, ask:

> Is this a short brand reaction, or are we trying to make it carry information?

If it carries operational information, it should not be a bubble.


## Bubble artwork library

Bubble artwork is a reusable brand asset, not page-owned media.

Admin uploads a finished bubble illustration once into `site_page_accent_assets`. The Bubble Library stores:
- a reusable admin label;
- image URL;
- accessibility label.

A page placement still stores its selected image URL and accessibility label so public rendering does not depend on public access to the Admin asset library. Deleting or changing a library entry therefore does not silently break an already-published page.

The library migration imports any bubble artwork already used by an existing Page Accent, so artwork uploaded before the library was introduced becomes reusable automatically.

## Real-page preview

Admin can preview the current unsaved Page Accent in its actual registered safe zone before saving.

The preview workflow:
1. serializes the current draft into browser-local storage under a random short-lived token;
2. opens the real target page with that token in the URL;
3. Page Accent slots on that page temporarily render the local draft instead of the saved accent;
4. a fixed **Page Accent preview · not saved** badge makes the preview state explicit.

Preview data expires after 30 minutes and is never written to Supabase. For ordinary pages, previewing one accent also suppresses the saved accent of the other type, accurately reflecting the either/or rule. The Homepage Builder-owned Hero note remains visible while previewing its lower-page bubble.
