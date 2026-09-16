# JOKO Agent Capabilities — Phase 4F Host Relationships & Embeds

## Status

Implemented. Protected live acceptance passed on 2026-09-16; activation/publication authority remains unavailable.

## Purpose

Phase 4F connects reviewed Curiosity candidates to **host-local presentation surfaces** without moving host configuration into the canonical Curiosity Episode.

The governing rule is:

> A Curiosity may travel. A placement does not travel with it.

A Shared Curiosity can therefore appear on a JOKO TODAY product, page, place, or site surface without becoming JOKO-local knowledge. The host relationship and embed configuration are separate candidate-stage artifacts.

## Pipeline

```text
Curiosity candidate
  → research + answer
  → human editorial review submission
  → optional Phase 4E creative clearance / creative candidates
  → editorial host relationship candidate
  → editorial or Creative embed candidate
  → deterministic native-React preview contract
  → STOP
```

There is still no activation, canonicalization, promotion, external embed-code generation, or publication tool.

## Storage boundary

Phase 4F uses a separate candidate workspace:

```text
/home/jokotoday/workspace/candidates/curiosity-host-embeds/
  cur-.../
    relationships/
      hostrel-....json
    embeds/
      embed-....json
```

This workspace is not canonical Curiosity storage and is not a production page/CMS store.

## Host relationship candidates

A relationship binds one exact current Phase 4D review-package fingerprint to a JOKO host target.

Phase 4F pilot host domains:

- `site`
- `page`
- `product`
- `place`

Registered site: `joko-today`.

Registered page ids:

- `homepage`
- `curiosity-notebook`
- `how-it-works`
- `products`
- `about`

Product/place identifiers are accepted as opaque stable ids; Phase 4F does **not** query the commerce database and does not claim they exist. Site/page registry entries are locally verified by policy.

Relationship kinds:

- `featured_on`
- `context_for`
- `explains`
- `related_to`
- `originated_at`

Only Editorial may create host relationship candidates. Creative may read current relationships after a valid Phase 4E human creative clearance.

## Portability rule

Phase 4D Curiosity Graph rules protect canonical knowledge dependencies. Phase 4F host relationships are different: they are deliberately host-local presentation metadata.

Therefore:

```text
Shared Curiosity → JOKO host relationship   allowed
JOKO Curiosity   → JOKO host relationship   allowed
```

The relationship artifact always carries:

```text
canonical_episode_mutation=false
publication_authority=false
```

A Shared Curiosity does not become JOKO-local merely because JOKO chooses to display it.

## Embed presets

Phase 4F provides five reviewed presentation presets:

- `notebook-card`
- `homepage-feature`
- `product-context`
- `inline-answer`
- `how-it-works`

Each preset maps to the existing native React `CuriosityEmbed` presentation model (`compact` or `homepage-explainer`) and a default feature set.

Candidate configuration may choose:

- show asker
- show Answer Guide
- show animation
- show text answer
- show sources
- show related questions
- show `I wondered that too`
- show host CTA
- language: `auto`, `en`, `th`, `zh`
- theme: `paper`, `mineral`, `neutral`

These are presentation choices. They never alter the factual answer, sources, Curiosity scope, or canonical episode.

`show_asker` never gives Phase 4F access to private customer identity. The preview contract contains no private customer/account data. A future public Curiosity Persona adapter must supply any public asker representation.

## CTA safety

Phase 4F accepts only site-relative CTA paths. Absolute URLs, protocol-relative URLs, executable HTML, scripts and iframe snippets are rejected or never generated.

An embed preview returns a deterministic renderer contract:

```text
renderer=CuriosityEmbed
implementation=native-react
variant=...
locale=...
theme=...
features=...
host=...
host_cta=...
```

and explicitly returns no HTML/script/iframe payload.

## Fingerprint and stale behavior

Every host relationship and embed candidate binds to the exact current Phase 4D review-package fingerprint.

If the question, source-grounding provenance, classification, answer, cited evidence, duplicate context, or Curiosity Graph proposals change and Editorial resubmits, previous Phase 4F artifacts become `stale=true`.

Creative requires both:

1. a current non-stale Phase 4D review submission; and
2. a matching current root-owned Phase 4E human creative-clearance receipt.

Editorial may inspect stale Phase 4F artifacts but cannot activate or publish them.

## Phase 4E fingerprint compatibility hardening

Source-Grounded SPARK added `source_grounding` to the Phase 4D review fingerprint after Phase 4E initially shipped. Phase 4F includes a compatibility correction so Phase 4E creative release checks now carry the same source-grounding field. This prevents newly source-grounded review submissions from being incorrectly treated as stale by Creative.

## Phase 4F MCP additions

Editorial:

- `host_relationship_list`
- `host_relationship_create_candidate`
- `embed_preset_list`
- `embed_create_candidate`
- `embed_candidate_list`
- `embed_preview`

Creative:

- `host_relationship_list`
- `embed_preset_list`
- `embed_create_candidate`
- `embed_candidate_list`
- `embed_preview`

Research and Operator receive no Phase 4F additions.

Because merged Source-Grounded SPARK already adds four tools to Editorial and Research, expected live totals are:

```text
editorial  26
research   21
creative   14
operator    3
```

## Authority matrix

| Operation | editorial | research | creative | operator |
| --- | --- | --- | --- | --- |
| reviewed Curiosity reads | yes | yes | yes | yes |
| research/source writes | no | yes | no | no |
| submit human editorial review | yes | no | no | no |
| Phase 4E creative derivation | no | no | yes | no |
| create host relationship candidate | yes | no | no | no |
| list current host relationships | yes | no | yes* | no |
| list embed presets | yes | no | yes | no |
| create embed candidate | yes | no | yes* | no |
| preview embed contract | yes | no | yes* | no |
| activate/publish/canonicalize | never | never | never | never |

`*` Creative requires current human creative clearance for candidate-specific Phase 4F operations.

## Concurrency and filesystem safety

Phase 4F candidate writes use an inter-process lock across duplicate checking + artifact creation. Candidate directories, relationship/embed directories and JSON files reject symlink substitution; roots must be absolute ordinary directories; artifacts are size bounded and atomically written.

## Acceptance gates

Before Phase 4F is merge/deploy ready:

1. all Phase 4A–4F + Source-Grounded SPARK regression tests pass;
2. Phase 4E and Phase 4D review-package fingerprints match when source grounding exists;
3. Shared → JOKO host placement is allowed without canonical scope mutation;
4. only Editorial can create host relationship candidates;
5. Creative requires exact current human creative clearance;
6. product/place host refs remain opaque and do not query production commerce data;
7. CTA targets are site-relative only;
8. embed previews generate no HTML, JavaScript, iframe or external embed code;
9. stale review fingerprints stale both relationship and embed candidates;
10. duplicate current relationship/embed candidates are rejected atomically;
11. exact MCP tool counts are 26 / 21 / 14 / 3;
12. canonical Curiosity storage remains non-writable;
13. no direct provider keys are added to Hermes;
14. no DB/RLS/Cloudflare/DNS/secret/publication change is introduced;
15. no persistent JOKO Hermes/MCP daemon is introduced;
16. Hermes E2E reaches host relationship → embed candidate → preview and stops before activation.

## Deferred

Phase 4F deliberately does not implement:

- production CMS/page activation
- canonical Curiosity promotion
- publication workflow
- Supabase-backed host/embed persistence
- product database lookup from Hermes
- public Persona lookup
- external web components, embed scripts or iframe delivery
- third-party host registration
- animation/DAM promotion
- autonomous end-to-end orchestration (Phase 4G)

Phase 4F establishes a portable **Curiosity → host-local presentation** contract while keeping content authority, host placement and publication authority separate.
