# JOKO Hermes Phase 4E — Creative Answer Pipeline

## Status

Implementation candidate. Phase 4E extends the accepted Phase 4D editorial handoff with a controlled creative staging pipeline for the `creative` Hermes profile.

The phase does **not** publish, canonicalize, approve factual content, or call an image/video provider directly. It prepares source-anchored creative candidates and quota-limited Creative Lab generation requests for later execution/review.

## Purpose

Phase 4E turns a human-cleared Curiosity review package into presentation candidates without allowing the creative layer to change what is true.

```text
Question candidate
  → Research answer + sources
  → Editorial review submission
  → HUMAN creative clearance
  → Answer Guide proposal
  → 15–30 second doodle script candidate
  → Storyboard candidate
  → quota-limited Creative Lab generation request
  → generated staging assets
  → human creative review
```

The factual answer and cited sources remain authoritative. Answer Guides, scripts, storyboards, and generated media are presentation layers only.

## Human creative-clearance gate

A Phase 4D submission is still only `awaiting_human_review`. The creative profile must not treat that state as approval.

Phase 4E therefore adds a separate root-owned **human creative clearance** receipt. Hermes cannot create this receipt.

Production location:

```text
/srv/joko/creative/clearances/
  cur-.../
    clr-....json
```

The receipt records the exact Phase 4D review submission ID and package fingerprint. It grants only:

```text
creative_derivation_authority = true
canonicalization_authority = false
publication_authority = false
```

A clearance becomes unusable if the current review package changes, if the latest review submission changes, or if Phase 4D reports the submission stale.

The root/admin helper is intentionally outside MCP:

```text
sudo python3 /home/jokotoday/capabilities/joko_creative_clearance.py <candidate_id> --note "..."
```

This is the human gate from reviewed text/source work into creative staging. A later Admin UI may replace the CLI without changing the receipt contract.

## Creative workspace

Creative candidate artifacts are written only to:

```text
/home/jokotoday/workspace/candidates/curiosity-creative/
  cur-.../
    guides/
    scripts/
    storyboards/
    generation_requests/
```

They are not canonical Curiosities and are not public media.

Generated staging assets are read from a separate worker-owned/read-only surface:

```text
/srv/joko/creative/staging-assets/
  cur-.../
    asset-....json
    files/
      ...
```

The `creative` MCP surface has no tool that writes generated asset files or asset metadata. A future approved Creative Lab worker/adapter owns that execution path.

## Answer Guide proposals

`creative_guide_propose` creates a presentation-only guide proposal.

The proposal uses:

- a stable lowercase `guide_ref`
- a human label
- an approved JOKO Style Profile
- a voice mode
- rationale

Approved v1 Style Profile IDs are:

- `living-notebook-v1`
- `jokomi-master-v1`
- `curious-community-v1`

Voice modes are:

- `silent`
- `first_person_inner`
- `neutral_narrator`

Answer Guides have `factual_authority=false`. Jokomi or another guide may explain an answer, but cannot create facts or override sources.

## Doodle script candidates

`creative_doodle_script_create_candidate` creates a short source-anchored explanation candidate.

Rules:

- total duration must be 15–30 seconds
- 1–10 beats
- beat timings must sum to the declared duration within one second
- every beat declares `claim_type`
- `visual_only` beats must not claim source support
- `factual_explanation` beats must cite at least one source ID from the released answer
- source IDs outside the released answer are rejected
- accessibility text is mandatory

This lets the visual layer be playful while factual statements remain traceable to the reviewed answer evidence.

## Storyboard candidates

`creative_storyboard_create_candidate` converts a current doodle script into an unreviewed storyboard.

Rules:

- 1–12 panels
- every panel must map to a real doodle-script beat
- approved Style Profile ID required
- supported aspect ratio required
- accessibility summary required
- storyboard is fingerprint-bound to the current human clearance

A change to the underlying review package makes older creative artifacts stale rather than silently reusing them.

## Creative Lab generation requests

`creative_lab_request_generation` creates a provider-neutral queue item. Phase 4E deliberately does **not** execute the external generation request itself.

Supported v1 request modes:

- `storyboard_frames`
- `doodle_keyframes`
- `scene_illustration`

The request carries `route_hint=joko/image-standard` for a future Creative Lab worker, but provider/model selection remains owned by JOKO AI Gateway policy.

Each request is explicitly:

```text
status = queued_for_creative_lab
queue_only = true
provider_call_executed = false
publication_authority = false
```

This avoids giving Hermes a hidden paid-generation path before the Scene/Answer Creative Lab adapter is ready.

## Quotas

The candidate queue enforces conservative v1 staging quotas before accepting a request:

```text
per candidate / UTC day: 6 output units
global / UTC day:        30 output units
max per request:          3 outputs
```

A future execution worker must enforce its own cost/rate limits again. Queue quota is not a substitute for provider-side cost control.

## Generated staging assets

`creative_bundle_read` includes validated staging-asset metadata when a future Creative Lab worker has produced files.

Asset entries are returned only when:

- metadata has a valid asset ID and candidate ID
- referenced media file is inside the staging asset directory
- neither metadata nor media is a symlink
- file size is within the staging limit
- the file SHA-256 matches metadata

MCP returns metadata and file availability only; it does not inline large image bytes.

## Phase 4E MCP additions

Creative only:

- `creative_review_package_read`
- `creative_guide_propose`
- `creative_doodle_script_create_candidate`
- `creative_storyboard_create_candidate`
- `creative_lab_request_generation`
- `creative_bundle_read`

Expected final JOKO tool counts:

```text
editorial  16
research   17
creative    9
operator    3
```

Editorial and Research keep their accepted Phase 4D surfaces. Operator remains Phase 4A read-only.

## Role and authority matrix

| Operation | editorial | research | creative | operator |
| --- | --- | --- | --- | --- |
| reviewed Curiosity reads | yes | yes | yes | yes |
| research writes | no | yes | no | no |
| Phase 4D review handoff | yes | status only | no | no |
| create human creative clearance | no MCP tool | no MCP tool | no MCP tool | no MCP tool |
| read human-cleared review package | no | no | yes | no |
| propose Answer Guide | no | no | yes | no |
| create doodle script/storyboard candidate | no | no | yes | no |
| queue Creative Lab generation request | no | no | yes | no |
| read creative staging bundle/assets | no | no | yes | no |
| factual approval / canonicalize / publish | never | never | never | never |

## Accessibility and text-first rule

Creative media is optional presentation. Every Curiosity answer must retain its text answer and source representation.

Every doodle script requires accessibility text, and every storyboard requires an accessibility summary. Generated media may enrich an answer but can never become the only representation of the factual content.

## Security boundaries

Phase 4E preserves the previous boundaries:

- no database migration
- no RLS change
- no Cloudflare/DNS change
- no provider-secret change
- no direct OpenAI/OpenRouter/Ollama key in JOKO Hermes
- no new production-data write
- canonical Curiosity storage remains read-only
- no `approve`, `canonicalize`, `promote`, or `publish_to_production` capability
- no external image/video provider call from Phase 4E MCP
- no persistent JOKO Hermes/MCP daemon

The root-owned clearance directory must be non-writable by the `jokotoday` Unix user.

## Acceptance gates

Before Phase 4E is merge-ready:

1. Phase 4A–4D tests remain green.
2. Creative cannot use a review package without a matching current human-clearance receipt.
3. Creative cannot create or alter clearance receipts through MCP.
4. A changed answer/source/classification/question/graph/duplicate context invalidates the clearance through the review fingerprint.
5. Creative remains unable to write Research or Editorial Review authority artifacts.
6. Factual doodle beats can cite only source IDs from the released answer.
7. Doodle duration remains 15–30 seconds and accessibility text is mandatory.
8. Storyboards remain source-script linked and staging-only.
9. Generation requests remain queue-only and quota-limited.
10. Generated asset reads validate containment, symlinks, size and SHA-256.
11. Editorial remains exactly 16 JOKO tools; Research 17; Creative becomes 9; Operator remains 3.
12. Phase 3 provider isolation remains intact.
13. Canonical Curiosity storage remains non-writable by `jokotoday`.
14. No persistent JOKO Hermes/MCP daemon is introduced.
15. Hermes E2E acceptance passes before the PR becomes merge-ready.

## Deferred

Phase 4E deliberately does not implement:

- factual approval/canonicalization of Curiosity Episodes
- public publishing
- Supabase-backed creative persistence
- a headless Scene/Answer generation worker
- paid image/video generation directly from Hermes
- Style Guardian scoring
- animation rendering
- production DAM promotion
- host/embed relationships (Phase 4F)
- end-to-end autonomous orchestration (Phase 4G)

The key Phase 4E achievement is a safe, source-anchored creative staging contract that can later connect to the full Creative Lab without giving the creative agent factual or publication authority.
