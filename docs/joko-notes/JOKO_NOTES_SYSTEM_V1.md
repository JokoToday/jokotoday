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

Each public note appears in a **registered placement slot** defined by code:

```
page_key + placement_key
```

Example:

```
how-it-works + intro
```

This prevents layout drift and keeps responsive behaviour under design-system control.

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

One row represents one controlled page slot.

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
(site_key, page_key, placement_key)
```

so one slot cannot accidentally contain multiple competing notes.

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

## v1 placement registry

### How It Works · Intro

```
page_key: how-it-works
placement_key: intro
```

This is the first public site-wide slot.

The migration seeds an **unpublished starter draft**:

> A little note from JOKO  
> Order first. We’ll get the oven ready.

It does not change the live site until an Admin explicitly publishes it.

## Suggested future slots

These should be added only when the page composition has been reviewed:

- Products · editorial note below browsing controls
- Product detail · product-specific baker note
- About / Meet the Founders · contextual note
- Pickup section · gentle pickup-day note
- Gallery · behind-the-scenes note

The Products header remains reserved for the separate “Oh my Good-ness.” bubble concept.

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
- real-component preview;
- registered placement selection only.

## Editorial test

Before publishing a note, ask:

> If this note vanished, could a customer still understand and complete the page?

If the answer is no, the content belongs in normal UI, not in a JOKO Note.
