# JOKO Notes System v1

## Purpose

JOKO Notes are small notebook-style editorial interruptions placed strategically across JOKO TODAY.

They are **not** alerts, banners, system messages or speech bubbles. Their job is to add Joe & Phuttan's human editorial voice: a recommendation, observation, contextual comment, small story, or gentle bit of personality.

The separate **“Oh my Good-ness.” bubble** remains a different visual language and is intentionally outside JOKO Notes v1.

## Core design rule

Use roughly **one prominent JOKO Note per page**. A genuinely long page may eventually justify a second controlled slot, but repetition should feel discovered rather than templated.

A JOKO Note may add:
- warmth;
- context;
- recommendation;
- personality;
- a short editorial aside;
- a link to another relevant page.

A JOKO Note must **never be the only place** that communicates:
- price;
- stock or availability;
- order cutoff;
- pickup eligibility;
- payment instructions;
- cancellation rules;
- errors;
- security/account instructions;
- any information required to complete a purchase.

Essential commerce and operational information must remain normal accessible UI.

## Two visual languages

### JOKO Notes
Paper, tape, punched holes, hand-written/editorial feel. Personal and contextual.

### Brand bubbles
Short reactive expressions such as “Oh my Good-ness.” Decorative, playful, almost like JOKO reacting to the page.

The two systems should not be merged.

## Architecture

### Placement is code-owned

Editors do not position notes using arbitrary coordinates.

Each public note belongs to one page and appears in a **registered safe zone** defined by code. Admin chooses the page and then one of that page's approved safe zones:

```
page_key + placement_key
```

Example:

```
how-it-works + intro
```

This prevents layout drift and keeps responsive behaviour under design-system control. Admin can move a note between safe zones without code changes, but cannot free-drag it to arbitrary coordinates.

### Content is Admin-owned

Admin can edit:
- publish / draft;
- localized heading EN / TH / ZH;
- localized body EN / TH / ZH;
- optional image;
- localized image alt text;
- optional link;
- controlled font preset;
- heading/body size within safe ranges;
- small controlled rotation;
- controlled image layout.

Admin cannot edit:
- arbitrary CSS;
- paper shape;
- punched holes;
- tape treatment;
- shadow system;
- page coordinates;
- unsupported placement slots.

## Data model

`site_joko_notes` is the canonical store for site-wide notes outside the Homepage Hero.

One row represents one page note. Its `placement_key` selects one of that page's approved safe zones.

Important fields:
- `site_key`
- `page_key`
- `placement_key`
- localized title/body/alt fields
- `image_url`
- `link_url`
- `font_preset`
- `heading_size`
- `body_size`
- `rotation`
- `image_layout`
- `is_published`

The database has a unique constraint on:

```
(site_key, page_key)
```

so v1 enforces one JOKO Note per page. The database also validates that `page_key + placement_key` is one of the registered safe-zone combinations.

## Security

- Anonymous/authenticated public readers can select **published notes only**.
- Admins can create, update and delete notes.
- RLS uses the existing `private.current_user_is_admin()` gate.
- Draft notes never render publicly.
- Uploaded note imagery reuses JOKO Media and strips EXIF/GPS metadata in-browser.

## Homepage compatibility

The existing Homepage Hero notebook note remains stored inside the immutable Homepage Builder revision for v1.

The visual primitive is shared, but content ownership is deliberately not migrated yet. This avoids rewriting published Homepage Builder history just to introduce the wider note system.

A later phase may move the Hero note onto the same editorial data model if that proves useful.

## v1 safe-zone registry

### Products

- **Below browse controls** — between the Products/browse area and category filters.
- **Below categories** — between category filters and the product catalogue.
- **After catalogue** — a closing note below the catalogue.

The Products header center remains intentionally reserved for the separate **“Oh my Good-ness.”** bubble system.

### How It Works

- **Below introduction** — directly below the heading and subtitle.
- **After the four steps** — between the step overview and ordering details.
- **Before Start Ordering** — after ordering details and before the final CTA.

### About

- **Below page title** — directly below the About heading.
- **After story** — between the story/mission card and value cards.
- **Before pickup locations** — between the value cards and pickup-location panel.

The migration seeds one **unpublished** starter draft for How It Works:

> A little note from JOKO  
> Order first. We’ll get the oven ready.

It does not change the live site until an Admin explicitly publishes it.

## Future safe zones

Add new page zones only after reviewing the real responsive composition. Likely future candidates include:

- Product detail · baker/editor note
- Gallery · behind-the-scenes note
- dedicated public Pickup page · pickup-day note

## Component structure

`JokoNote`
- reusable public visual primitive;
- shares the established paper family with the Homepage Hero note.

`JokoNoteSlot`
- loads one published note for a registered page slot;
- localizes EN / TH / ZH;
- renders nothing if no note is published.

`JokoNotesManagement`
- Admin editor;
- page selector;
- clickable safe-zone selector for the chosen page;
- real-component preview;
- no arbitrary x/y positioning.

## Editorial test

Before publishing a note, ask:

> If this note vanished, could a customer still understand and complete the page?

If the answer is no, the content belongs in normal UI, not in a JOKO Note.
