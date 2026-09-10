# JOKO Creative Lab — Character Mode Data Design v1

> **Status: DESIGN ONLY — NOT ACTIVE**
>
> This document defines the intended persistence model for Character Mode. It is not a Supabase migration and does not change production schema, RLS, Storage, or data. The frontend prototype must be tested before this design is converted into a migration.

## 1. Purpose

Character Mode should create reusable canonical character identities rather than isolated images. A character such as Emma or Theo needs a stable identity, version history, structured creative specification, style binding, and future links to generated media and scenes.

The frontend `CharacterSpec` is the current source contract for the character definition. Persistence should preserve that object without turning every creative attribute into a database column.

## 2. Design principles

1. **Hybrid relational + JSONB.** Stable workflow/identity fields are relational; evolving creative direction lives in versioned JSONB.
2. **Character is an entity, not an image.** Media can reference a character and a specific approved character version.
3. **Version character canon.** Changes to Emma's proportions or Theo's glasses must not silently rewrite historical work.
4. **Style binding is explicit.** Character versions retain the exact Style Profile ID/version used when approved.
5. **Approval and publishing remain separate.** Approving a character version does not publish it to Notebook, Today, Product, or Social.
6. **No provider-specific prompts in the canonical model.** Generator prompts/settings are downstream derivatives of the Creative Package.
7. **Admin-only v1.** Creative Lab persistence should initially remain inside the existing authenticated admin boundary.

## 3. Proposed tables

### `creative_projects`

Workflow container shared by future Scene, Character, Reference, and Edit modes.

| Column | Proposed type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `project_type` | `text` | `scene`, `character`, later `reference`, `edit` |
| `title` | `text` | Human working title |
| `status` | `text` | Draft/workflow status |
| `style_profile_id` | `text` or FK later | Governing profile |
| `style_profile_version` | `integer` | Exact version used |
| `spec` | `jsonb` | Mode-specific structured project specification |
| `created_by` | `uuid` | Admin/auth user who created project |
| `created_at` | `timestamptz` | Audit timestamp |
| `updated_at` | `timestamptz` | Audit timestamp |

Recommended status vocabulary initially:

- `draft`
- `in_progress`
- `ready_for_review`
- `approved`
- `archived`

`spec` for a Character Mode project contains the versioned `CharacterSpec` contract used by the frontend.

### `creative_characters`

Stable canonical character identity.

| Column | Proposed type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `name` | `text` | Display name, e.g. Emma |
| `slug` | `text` unique | Stable human-readable identifier |
| `status` | `text` | `draft`, `active`, `retired` |
| `current_version` | `integer` | Current approved canon version |
| `style_profile_id` | `text` or FK later | Default governing character style |
| `created_by` | `uuid` | Creator |
| `created_at` | `timestamptz` | Audit timestamp |
| `updated_at` | `timestamptz` | Audit timestamp |

Do not store the entire visual definition directly on this row. This table is the durable identity; versioned canon belongs in `creative_character_versions`.

### `creative_character_versions`

Immutable approved/draft character canon snapshots.

| Column | Proposed type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `character_id` | `uuid` FK | Parent canonical character |
| `version` | `integer` | Monotonic character version |
| `project_id` | `uuid` FK | Creative project that produced/revised this version |
| `spec` | `jsonb` | Complete `CharacterSpec` snapshot |
| `style_profile_id` | `text` or FK later | Governing Style Profile |
| `style_profile_version` | `integer` | Exact Style Profile version |
| `status` | `text` | `draft`, `review`, `approved`, `superseded` |
| `approved_by` | `uuid` nullable | Human approver |
| `approved_at` | `timestamptz` nullable | Approval timestamp |
| `created_at` | `timestamptz` | Creation timestamp |

Recommended uniqueness constraint:

```sql
unique (character_id, version)
```

The full `CharacterSpec` remains inside `spec JSONB`, including identity context, personality, silhouette, intentional irregularity, face/head direction, wardrobe, props, colour, presentation, style binding, and optional notes.

## 4. Future media linkage

When DAM persistence is introduced, media assets should reference canonical entities rather than become the entity themselves.

A future media/relationship layer should be able to express:

```text
media_asset
  -> creative_project
  -> creative_character
  -> creative_character_version
  -> style_profile_version
```

This enables questions such as:

- Which images use Emma v3?
- Which approved image is Theo's current master reference?
- Which older scenes were created with Emma v1?
- Which assets need review after a character canon update?

Do not hard-code media URLs into `creative_characters`.

## 5. Why JSONB for `CharacterSpec`

Creative direction is intentionally evolving. Fields such as `hairTreatment`, `signatureIrregularity`, `professionCues`, or future animation/audio attributes will change faster than stable identity/workflow fields.

Creating one SQL column per creative field would make experimentation migration-heavy and couple the database tightly to the current UI.

JSONB lets the frontend contract evolve while stable relational fields remain queryable. Frequently queried fields can later be promoted to columns or indexed JSON paths when real usage proves the need.

## 6. Proposed project-to-character lifecycle

```text
Character Mode form
  -> CharacterSpec v1
  -> creative_projects.spec
  -> candidate generation / review later
  -> human approval
  -> create/update creative_characters
  -> append creative_character_versions
  -> update creative_characters.current_version
```

A character project should not create or overwrite canonical character identity until the user explicitly approves that version as canon.

## 7. RLS / authorization intent — design only

Initial v1 intent:

- authenticated Admin can create/read/update Creative Lab projects
- only Admin can create or approve canonical character versions
- no public/anon access to draft Creative Lab records
- public site should consume only explicitly published/approved media through a separate publishing boundary

When this becomes an implementation task, exact policies must be designed against the production auth/role architecture and validated before migration. Do not rely on this design note as executable RLS.

## 8. Storage intent — design only

When reference uploads and generated outputs are added:

- original/source files should be private by default
- generated working candidates should be private by default
- approved delivery/published files should have a deliberate publishing path
- database rows should reference asset IDs/storage metadata rather than embedding transient URLs in project specs

No Storage bucket changes are part of Character Mode UI v1.

## 9. Migration activation gate

Before converting this design into SQL:

1. Use Character Mode to create representative prototypes: Emma, Theo, Tech Nerd, Joe/Ae.
2. Confirm the five-step UI captures enough information without becoming burdensome.
3. Identify which fields users repeatedly leave blank, override with `Other…`, or ask Creative Lab to decide.
4. Confirm the `CharacterSpec` object is stable enough to version.
5. Review the existing production Supabase schema and auth/RLS model read-only.
6. Prepare a migration and explicit RLS proposal.
7. **Stop for human approval before applying any migration or RLS change.**

## 10. Current implementation boundary

This document accompanies a frontend-only prototype. In the current implementation:

- Character Mode data lives only in React state for the browser session.
- `CharacterSpec.schemaVersion` is `1`.
- Style binding is included in `CharacterSpec`.
- no Supabase writes occur.
- no upload occurs.
- no generation occurs.
- no canonical character database record is created.

That boundary is intentional until the workflow has been tested by humans.
