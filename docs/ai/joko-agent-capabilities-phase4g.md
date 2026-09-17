# JOKO Agent Capabilities — Phase 4G Controlled Orchestration

## Status

Implementation candidate. Live installation remains gated behind explicit production/security approval.

## Purpose

Phase 4G adds a **control plane** above the bounded Phase 4A–4F capabilities. It coordinates who should act next and where a human gate blocks progress, without turning Hermes into an autonomous publisher or granting one profile another profile's write authority.

The governing rule is:

> Orchestration may coordinate authority. It may not absorb authority.

Phase 4G therefore never calls the suggested domain tool on behalf of another profile. It creates an immutable run intent, derives status from the existing candidate-stage artifacts, and returns one deterministic next action or human gate.

## Pipeline

```text
existing Curiosity candidate
        ↓
operator creates orchestration run intent
        ↓
research work (Research profile)
        ↓
editorial review handoff (Editorial profile)
        ↓
optional human creative clearance
        ↓
optional creative staging (Creative profile)
        ↓
optional host relationship + embed staging
        ↓
human release review
        ↓
STOP
```

There is no Phase 4G publish, activate, approve, canonicalize, promote, provider-execution, scheduled-worker, or cross-role execution capability.

## Control-plane storage

```text
/home/jokotoday/workspace/candidates/curiosity-orchestration/
  runs/
    orch-YYYYMMDDTHHMMSSZ-xxxxxxxx.json
```

Run records are immutable intents, not copies of research, review, creative, host, or canonical content.

Each run records only:

- candidate id
- template id
- hash of the candidate question at run creation
- created-by profile and timestamp
- explicit no-authority flags

The run status itself is **derived live** from the Phase 4C–4F workspaces. Phase 4G does not maintain a manually editable workflow-state field that could drift away from source-of-truth artifacts.

## Templates

### `research-review`

Coordinates an existing candidate through research readiness and Editorial's human-review handoff, then stops at `human_editorial_review`.

### `creative-answer`

Coordinates research + review, waits for the root-owned Phase 4E creative-clearance receipt, then guides Creative through Answer Guide → doodle script → storyboard → queued Creative Lab request. It stops at `human_release_review`.

### `host-embed`

Coordinates research + review, then Editorial host relationship → native React embed candidate. It stops at `human_release_review`; no activation occurs.

### `full-curiosity`

Coordinates all requested staging layers in sequence:

```text
research
→ editorial handoff
→ human creative clearance
→ creative staging
→ host relationship
→ embed candidate
→ human release review
→ STOP
```

## Deterministic next-action model

Phase 4G reads the actual current artifacts and selects one next action:

- missing classification → `curiosity_classify_candidate`
- missing research source → `research_add_source_candidate`
- missing/source-invalid answer → `answer_create_candidate`
- unresolved research gate → `answer_run_checks` or additional source work
- missing/stale review handoff → `editorial_submit_for_review`
- missing human creative clearance → human gate only
- missing creative guide → `creative_guide_propose`
- missing doodle script → `creative_doodle_script_create_candidate`
- missing storyboard → `creative_storyboard_create_candidate`
- missing generation request → `creative_lab_request_generation`
- missing host relationship → `host_relationship_create_candidate`
- missing embed → `embed_create_candidate`
- completed staging → human release-review gate

The returned tool name is a recommendation to the correct profile. **Phase 4G never invokes it.**

## Staleness and restart behavior

Phase 4G inherits the Phase 4D–4F fingerprint gates.

If research changes after review submission, orchestration detects the stale review package and routes back to Editorial for resubmission.

Each orchestration run also binds to the candidate question hash at creation. If the candidate question itself changes, that run stops with `restart_orchestration_run`; Operator may then create a new run for the changed question. The old run remains immutable audit history.

## Human gates

Human gates are first-class states, not errors to bypass:

- `human_editorial_review`
- `creative_clearance`
- `human_release_review`
- `restart_orchestration_run`

No Phase 4G tool can create the root-owned creative clearance receipt or convert a human-review handoff into approval.

## Phase 4G MCP additions

All four profiles receive read-only coordination tools:

- `orchestration_template_list`
- `orchestration_run_list`
- `orchestration_run_status`
- `orchestration_next_action`

Operator alone additionally receives:

- `orchestration_run_create`

`orchestration_run_create` writes only an immutable control-plane run record. It does not create Curiosity, research, review, creative, host, or publication artifacts.

Expected live totals after Phase 4G:

```text
editorial  30
research   25
creative   18
operator    8
```

## Authority matrix

| Operation | editorial | research | creative | operator |
| --- | --- | --- | --- | --- |
| existing Phase 4A–4F authority | unchanged | unchanged | unchanged | unchanged |
| list orchestration templates | yes | yes | yes | yes |
| list/read orchestration status | yes | yes | yes | yes |
| obtain deterministic next action | yes | yes | yes | yes |
| create orchestration run intent | no | no | no | yes |
| execute another profile's action | never | never | never | never |
| create human clearance | never | never | never | never |
| approve/canonicalize/publish | never | never | never | never |

## Cross-workspace reads

To derive one coherent status, the Phase 4G projection reads bounded metadata from the existing candidate, research, review, creative, clearance, and host/embed workspaces.

These reads do not expose new domain-write tools. They are used only to return counts, readiness flags, stale/current status, artifact presence, ids needed for coordination, and the next required authority.

Phase 4G does not return private customer identity, order/account data, secrets, provider keys, or raw staging-asset bytes.

## Filesystem safety

The orchestration root and `runs/` directory must be pre-created ordinary absolute directories. Symlinked roots/run directories are rejected.

Run files are size bounded, atomically written, mode `0600`, and duplicate current question/template runs are rejected under an inter-process lock.

The installer owns directory creation and permissions. Merely loading the MCP server does not create orchestration directories.

## No daemon / no scheduler

Phase 4G is request-driven. It does not add:

- a persistent Hermes process
- cron
- polling
- background autonomous loops
- provider execution
- webhook automation

A user or higher-level authorized controller must explicitly invoke the next profile/tool after inspecting the returned next action.

## Acceptance gates

Before Phase 4G is merge/deploy ready:

1. all Phase 4A–4G regression tests pass;
2. exact Phase 4G unit tests pass;
3. only Operator can create orchestration runs;
4. all other Phase 4G tools are read-only projections;
5. run creation does not create/modify domain artifacts;
6. changed candidate question requires a new run;
7. stale review package routes back to Editorial;
8. creative work cannot proceed without current root-owned human clearance;
9. full flow stops at human release review;
10. no publish/approve/promote/canonicalize/activate/execute capability exists;
11. exact MCP totals are 30 / 25 / 18 / 8;
12. no direct provider keys are added;
13. canonical Curiosity storage remains non-writable;
14. no DB/RLS/Cloudflare/DNS/secret change is introduced;
15. no persistent JOKO daemon is introduced;
16. Hermes E2E proves Operator → Research → Editorial → human gate → Creative → host/embed coordination while every write remains owned by its original profile.

## Deferred beyond Phase 4G

Phase 4G deliberately does not implement:

- autonomous worker-to-worker execution
- automatic human approvals
- production publication/activation
- canonical promotion
- Supabase orchestration persistence
- scheduled/background runs
- third-party host registration or remote callbacks
- production CMS writes
- autonomous paid provider generation

Phase 4G closes the Phase 4 capability programme with a bounded **coordination layer**, not an autonomous agent with aggregated authority.
