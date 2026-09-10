# Creative Lab — Library Upload v1

## Purpose

Creative Lab must be able to ingest approved or exploratory artwork created outside JOKO TODAY. The Library is the visual memory of the creative system, not a record of which generator produced an asset.

A character illustration made in ChatGPT, a drawing app, or another approved tool should be importable once and then become reusable input for Character Generation, Scene Builder, Review, and future agent workflows.

## Product rule

**Creative Lab owns and organizes creative assets regardless of where they were created.**

External artwork is therefore not treated as an anonymous file upload. Every imported image becomes a structured Library Asset with a stable ID and metadata describing what it is and how it may be reused.

## v1 asset fields

- stable asset ID
- asset name
- kind: Character / Scene / Setting / Activity / Object / Reference
- optional subject/entity name
- Library role
- optional Style Profile binding
- optional notes
- source = external upload
- original filename
- MIME type
- file size
- creation timestamp
- image Blob

### Library roles

- Character master
- Character identity reference
- Style reference
- Pose / activity reference
- Setting reference
- Object / prop reference
- Supporting reference

## Emma example

An Emma illustration created outside Creative Lab can be imported as:

- Kind: Character
- Character name: Emma
- Role: Character master (or Character identity reference)
- Style: JOKO Curious Community v1

The same Library Asset should later be selectable by Reference + Character Generation rather than requiring Emma to be recreated from scratch.

## Prototype persistence

Library Upload v1 intentionally does **not** write to Supabase. Imported files and metadata are stored in browser IndexedDB so the interaction can be tested without introducing production storage or database changes.

This means the browser copy can survive ordinary Creative Lab navigation and reloads on the same browser profile, but it is not yet canonical, shared across devices, or backed up by JOKO TODAY infrastructure.

## Production persistence gate

After the upload/classification UX is approved, the production implementation should move the same asset contract to Supabase-backed persistence:

1. private Creative Lab source/working storage
2. relational/JSON metadata record with stable asset ID
3. Admin-only create/update permissions
4. explicit approval/publishing boundary
5. no hard-coded transient storage URLs in consuming records

Applying database migrations, RLS changes, new production storage configuration, or production-data writes remains a separately approved operational step.

## Agent readiness

Future Hermes and other agents should select Library Assets by stable IDs and structured metadata, using the same objects visible to human Creative Lab users. The image file is evidence/reference; the Library Asset record is the machine-operable creative object.
