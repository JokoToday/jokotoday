# JOKO Creative Lab — Shared Activity & Setting Libraries

Status: **PROTOTYPE CONTRACT — FRONTEND ONLY**

This document defines the first reusable scene-building libraries for JOKO Creative Lab. It is intentionally provider-neutral and database-neutral. No Supabase migration, RLS, Storage, or persistence is activated by this work.

## Core principle

A scene should increasingly be assembled from reusable, approved visual building blocks rather than reconstructed from a blank prompt every time.

The first shared scene libraries are:

1. **Characters** — who the subject is. Character Mode owns character identity and canon.
2. **Activities** — what the subject is doing. Activity templates are identity-neutral and reusable across characters.
3. **Settings** — where the scene happens. Setting templates are reusable environment structures.

A human and a future agent such as Hermes should ultimately create the same structured project contract:

```text
Character + Activity Variant + Setting Variant + Story Detail + Style → Creative Project
```

Example:

```text
Emma v3
+ Sitting on sofa v2 — Leaning forward
+ Sunday Walking Street v1 — Wide market street
+ Curious mood
+ Curious Community v1
```

The Creative Director layer should interpret the combination coherently rather than mechanically compositing source images.

## Stable IDs and human labels

Names are for people. Stable IDs are for systems.

Every reusable template and every variant must have a stable machine-readable ID in addition to a human-readable name.

Example:

```text
template_id: activity-sitting-on-sofa
variant_id: activity-sitting-on-sofa-v2
version: 2
label: Leaning forward
```

Do not make future automation depend on matching display strings such as `Sitting on sofa`.

## Template vs variant

A **template** expresses the reusable concept:

```text
Sitting on sofa
Sunday Walking Street
Doi Suthep Temple
```

A **variant** expresses one approved interpretation of that concept:

```text
Sitting on sofa
  v1 — Upright
  v2 — Leaning forward
  v3 — Relaxed side-angle

Sunday Walking Street
  v1 — Wide market street
  v2 — Intimate stall view
  v3 — Quiet side lane
```

Version numbers are stable technical identifiers. Descriptive labels make the variants understandable to humans and searchable by agents.

## Thumbnail-first UX

The Scene Builder should present variants as visual thumbnail cards.

Current prototype thumbnails are lightweight generated sketch previews. They are placeholders for future DAM-backed approved thumbnails and should be replaceable without changing the library contract.

The intended interaction is:

```text
Choose character → click activity thumbnail → click setting thumbnail → add story detail → choose/confirm style
```

Structured dropdowns remain available as an escape hatch for new or unusual scenes.

## Activity semantics

An Activity is more than a skeletal pose. It may encode:

- body posture
- movement
- object relationship
- activity-specific prop requirements
- useful semantic tags

Activities must remain **character-independent**. `Sitting on sofa v2` must be reusable by Emma, Theo, Jo, Jokomi where appropriate, or another compatible subject.

The character keeps its own canonical proportions, silhouette, personality, and identity. The activity only defines what the body is doing.

An activity may express requirements such as:

```text
seat:sofa
prop:magnifying-glass
```

Future compatibility logic may use these requirements when selecting or validating combinations.

## Setting semantics

A Setting defines reusable environmental structure, not merely a background image.

A Setting variant may encode:

- place identity
- environment type
- scene scale
- composition emphasis
- spatial affordances
- semantic tags

Examples:

```text
Sunday Walking Street v2
→ intimate stall view
→ useful for looking, browsing, holding, talking

Doi Suthep Temple v2
→ Naga stair approach
→ useful for walking, climbing, pausing
```

Settings should eventually attach to approved reference assets and real location research where appropriate.

## Narrative focus remains separate

Activity requirements and setting structure must not automatically become the story's narrative focus.

For example, `Sitting on sofa` requires a sofa, but the scene may still be about Emma noticing a flower. The `Object / focus`, story beat, and mood remain scene-specific direction.

## Human and agent parity

The user-facing thumbnail grid and future Hermes automation should be two interfaces to the same underlying objects.

A future agent workflow should be able to:

```text
search_characters()
search_activities()
search_settings()
get_activity(template_id, variant_id)
get_setting(template_id, variant_id)
assemble_scene(...)
```

Agents should retrieve, rank, and select approved structured options rather than randomly fill dropdowns.

Useful machine metadata includes:

- stable IDs
- version
- category
- tags
- requirements
- affordances
- style compatibility
- approval status
- reference asset IDs

## Compatibility

Do not make compatibility a hard prohibition by default.

A future compatibility layer can classify a combination as:

```text
natural
possible
unusual
conflicting
```

For example, `Sitting on sofa` plus `Sunday Walking Street` may be unusual but not impossible. The Creative Director may reinterpret it, recommend another option, or ask for human guidance.

## Creative Package direction

The long-term canonical flow remains:

```text
Human or Hermes
→ structured project selections
→ Creative Package
→ Creative Director AI
→ provider adapter
→ candidate generation
→ Style Guardian
→ human approval
```

Prompts remain disposable provider translations. JOKO-owned character, activity, setting, style, reference, and revision data remain canonical.

## Persistence later

The prototype currently keeps scene projects and known characters in browser/session state. Shared Activity and Setting definitions are frontend seed data.

A future persistence phase may introduce canonical entities such as:

```text
creative_activity_templates
creative_activity_versions
creative_setting_templates
creative_setting_versions
```

with relationships to DAM assets, approvals, and scene projects.

Do not activate database persistence until the prototype libraries have been tested with representative JOKO scenes and explicit human approval is given for the migration/RLS phase.
