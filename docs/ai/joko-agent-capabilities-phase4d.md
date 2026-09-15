# JOKO Agent Capabilities — Phase 4D

Status: implementation in progress

## Objective

Phase 4D adds a controlled **Editorial Review Handoff + Curiosity Graph candidate** layer on top of the accepted Phase 4C Question Intelligence and Research workflow.

The boundary remains strict:

> Hermes may prepare material for human editorial review, but Hermes does not approve, canonicalize, promote, or publish Curiosity content in Phase 4D.

Canonical Curiosity Markdown remains read-only. Candidate questions, research artifacts, graph relationships, and review submissions stay on separate non-canonical staging surfaces.

## Workflow

```text
SPARK / user / editorial observation
        ↓
Curiosity candidate
        ↓
Question Intelligence + Research (Phase 4C)
        ↓
mechanically eligible for editorial review
        ↓
optional related / follow-up graph proposals
        ↓
editorial_prepare_review
        ↓
editorial_submit_for_review
        ↓
awaiting_human_review
        ↓
STOP — no approval / canonicalization / publication capability
```

## Curiosity Graph candidate model

Phase 4D introduces only two graph relationship types:

- `related` — the candidate is meaningfully related to another Curiosity
- `follow_up` — the candidate is a follow-up question to another Curiosity

The source is always a **candidate Curiosity**. A target may be:

- another candidate (`target_kind=candidate`), or
- a reviewed canonical Curiosity path (`target_kind=canonical`)

Relationship artifacts are proposals only. They do not mutate canonical content and do not establish a permanent graph edge.

### Scope rule

Portable Shared Curiosities must not acquire a dependency on JOKO-local knowledge:

- Shared → Shared: allowed
- Shared → JOKO-local: rejected
- JOKO-local → Shared: allowed
- JOKO-local → JOKO-local: allowed

This preserves the rule that local host knowledge must not automatically travel with a portable Shared Curiosity.

## Review workspace

Planned server path:

```text
/home/jokotoday/workspace/candidates/curiosity-review/
  cur-<candidate-id>/
    relationships/
      rel-....json
    submissions/
      rev-....json
```

This is a fourth distinct surface:

```text
Canonical:   /srv/joko/curiosity/current                       read-only
Candidates:  /home/jokotoday/workspace/candidates/curiosity    unreviewed
Research:    /home/jokotoday/workspace/candidates/curiosity-research
Review:      /home/jokotoday/workspace/candidates/curiosity-review
```

The review workspace is candidate-stage operational state, not durable canonical knowledge.

## Review package

`editorial_prepare_review` assembles a deterministic package containing:

- candidate metadata and question
- classification candidate
- latest answer candidate
- sources cited by that latest answer
- source/answer counts
- possible-duplicate retrieval results
- proposed Curiosity Graph relationships
- Phase 4C readiness checks
- explicit authority flags showing there is no approval or publication authority

Preparation has no state-changing effect.

## Submission semantics

`editorial_submit_for_review` is allowed only when Phase 4C mechanical readiness says the candidate is eligible for editorial review.

A submission records an immutable fingerprint of the review-relevant candidate state and sets only:

```text
status = awaiting_human_review
human_review_required = true
approval_authority = false
publication_authority = false
```

Submitting the exact same package twice is idempotent rather than creating duplicate queue entries.

If the answer, classification, cited evidence, question metadata, or graph proposals change after submission, `editorial_review_status` reports the submission as **stale** and requiring resubmission. It does not silently update or approve the previous submission.

## Role and authority matrix

| Operation | editorial | research | creative | operator |
| --- | --- | --- | --- | --- |
| Phase 4A reviewed reads | yes | yes | yes | yes |
| Phase 4B candidate intake | yes | yes | no | no |
| Phase 4C SPARK / duplicate / research reads | yes | yes | no | no |
| Phase 4C research writes | no | yes | no | no |
| create related/follow-up proposal | yes | yes | no | no |
| list relationship proposals | yes | yes | no | no |
| inspect editorial review status | yes | yes | no | no |
| prepare human review package | yes | no | no | no |
| submit for human editorial review | yes | no | no | no |
| approve / canonicalize / promote / publish | never | never | never | never |

## Phase 4D MCP additions

Editorial + research:

- `curiosity_relationship_create_candidate`
- `curiosity_relationship_list`
- `editorial_review_status`

Editorial only:

- `editorial_prepare_review`
- `editorial_submit_for_review`

No tool named or equivalent to `approve`, `reject_as_final`, `promote_to_canonical`, `canonicalize`, or `publish_to_production` is permitted.

Expected JOKO MCP tool counts after installation:

```text
editorial  16
research   17
creative    3
operator    3
```

## Duplicate-discovery hardening

Phase 4D also closes a remaining Phase 4C scale edge case: possible-duplicate discovery now scans the full candidate directory rather than relying on the presentation-oriented 200-item candidate list limit. The result remains advisory retrieval only and can never auto-merge candidates.

## Acceptance gates before installation

1. All Phase 4A–4C regression tests remain green.
2. Graph relationships remain proposal artifacts only.
3. Shared → JOKO-local graph dependencies are rejected.
4. Self-relations and duplicate relationship proposals are rejected.
5. Only editorial may prepare or submit the formal human-review handoff.
6. Research may propose relationships and inspect status but cannot submit for review.
7. Mechanical readiness is mandatory before submission.
8. Every submission remains `awaiting_human_review`; there is no approval state transition.
9. Review submissions become stale when review-relevant candidate state changes.
10. Creative/operator remain at the Phase 4A three-tool read-only surface.
11. Canonical Curiosity storage remains non-writable by `jokotoday`.
12. Phase 3 provider isolation remains intact; no direct provider keys are added to Hermes.
13. No DB/RLS/Cloudflare/DNS/provider-secret/publishing change is introduced.
14. No persistent JOKO Hermes/MCP daemon is introduced.
15. Hermes end-to-end acceptance passes before the PR becomes merge-ready.

## Deferred

Phase 4D deliberately does not decide or implement:

- human approval/rejection UI or authority
- promotion from candidate storage into canonical Curiosity storage
- publication to the website or any external surface
- database-backed graph persistence
- product/business relationships and embed presets (Phase 4F)
- automatic orchestration across the complete pipeline (Phase 4G)

The purpose of Phase 4D is to make the human editorial handoff explicit, inspectable, stale-aware, and safe without crossing the publication boundary.
