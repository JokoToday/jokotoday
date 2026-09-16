# JOKO Agent Capabilities — Phase 4C

Status: implementation in progress

## Objective

Phase 4C turns the Phase 4B candidate inbox into a controlled **Question Intelligence + Research** workflow while preserving the core safety rule:

> Questions may be generated freely; facts, answers, and publication authority must not be.

All Phase 4C artifacts remain candidate-stage material. Canonical Curiosity Episodes stay read-only and human review remains mandatory before anything can become trusted or publishable.

## SPARK becomes Question Discovery

SPARK is now a first-class workflow role with a very narrow purpose:

> **Come up with unusual questions worth investigating.**

SPARK is not an answer engine, expert, factual authority, or publisher. Its freedom should be concentrated on *what to ask*.

Recommended SPARK modes:

- `never_asked` — questions people rarely think to ask
- `childlike` — simple questions adults often stop noticing
- `counterintuitive` — apparent contradictions and surprising reversals
- `expert_blind_spot` — beginner questions experts forget need explaining
- `local_observation` — questions triggered by real local observations
- `product_adjacent` — useful curiosity around products without sales copy
- `seasonal` — recurring seasonal/calendar curiosities

SPARK outputs question candidates only. It must not include private customer identity and it must not turn guesses into facts.

### Technical decision for the pilot

SPARK is **not a fifth persistent Hermes profile yet**. Phase 4C treats SPARK as a constrained question-discovery role/contract invoked through the existing editorial or research workflow. This preserves the proven four-profile isolation model while we learn how often SPARK is used and whether it later merits its own profile.

SPARK-originated questions should enter the same Phase 4B candidate intake with explicit provenance such as `origin_type=spark_discovery` plus a `spark_mode`.

### Source-Grounded SPARK / Insight Foundry

Phase 4C now also supports a source-grounded discovery mode:

```text
Source Pack → Insight Foundry → question trigger → SPARK question candidate
```

A private Source Pack contains bounded excerpts supplied by editorial/research. Insight Foundry looks for surprise, contradiction, causal mechanism, hidden variable, exception, assumption, boundary, consequence, and knowledge gap. SPARK then turns those grounded triggers into focused questions.

This is question-generation provenance only. Source Pack material is **not automatically accepted as answer evidence** and URLs are not fetched by the JOKO MCP server. The normal research source-capture and human-review rules still apply.

Question lenses are `mixed`, `decompose`, `explain`, `surprise`, `challenge_assumptions`, `contradictions`, `practical_consequences`, `hidden_variables`, `unanswered`, and `never_asked`. `decompose` requires an optional Source Pack `seed_question` and uses the supplied material to split that broad question into narrower mechanism, boundary, variable, exception, and consequence questions. Source excerpts are always untrusted data and embedded instructions must never be followed.

## Phase 4C workflow

```text
SPARK / user / editorial observation
        ↑
optional Source Pack → Insight Foundry
        ↓
Curiosity candidate
        ↓
possible-duplicate discovery
        ↓
researcher decides whether it is actually equivalent
        ↓
Shared vs JOKO/local classification
        ↓
topic + sensitivity classification
        ↓
source capture
        ↓
answer draft with explicit source references
        ↓
mechanical readiness checks
        ↓
human editorial review (Phase 4D)
```

The duplicate step deliberately produces **possible matches**, not an automatic semantic-equivalence verdict. The lexical scorer is a retrieval aid; the research/editorial model still has to reason about whether two questions are actually the same.

## First implementation slice

Phase 4C starts with dependency-free Python helpers so workflow policy can be tested independently of Hermes/MCP wiring.

The implementation provides:

- lexical possible-duplicate ranking
- SPARK prompt/role contracts and batch validation
- Source Pack staging, Insight Foundry briefs, grounded-question validation, and structured source grounding
- explicit Shared vs JOKO classification candidates
- topic and sensitivity classification
- research source metadata capture
- answer candidates that reference known source IDs
- deterministic readiness checks
- stronger readiness requirements for high-sensitivity subjects

Research artifacts live on a separate candidate-stage surface; they never modify canonical Curiosity Markdown.

## Research workspace

Planned server path:

```text
/home/jokotoday/workspace/candidates/curiosity-research/
  source-packs/
    spk-....json
  source-grounding/
    cur-....json
  cur-<candidate-id>/
    classification.json
    sources/
      src-....json
    answers/
      ans-....json
```

This workspace is unreviewed staging material. It is distinct from both:

```text
Canonical:  /srv/joko/curiosity/current
Candidates: /home/jokotoday/workspace/candidates/curiosity
```

## Roles and authority

The first Phase 4C slice keeps write authority narrow:

| Operation | editorial | research | creative | operator |
| --- | --- | --- | --- | --- |
| read reviewed Curiosities | yes | yes | yes | yes |
| create Curiosity candidate | yes | yes | no | no |
| run SPARK question brief | yes | yes | no | no |
| create/read Source Pack | yes | yes | no | no |
| run Insight Foundry source brief | yes | yes | no | no |
| create source-grounded SPARK candidate | yes | yes | no | no |
| inspect possible duplicates | yes | yes | no | no |
| write classification candidate | no | yes | no | no |
| add research source candidate | no | yes | no | no |
| create answer candidate | no | yes | no | no |
| inspect readiness checks | yes | yes | no | no |
| approve/promote/publish | never | never | never | never |

Editorial may inspect research artifacts because Phase 4D will consume them, but research remains the only Phase 4C writer for classifications, sources, and answer drafts.

## Source policy

Phase 4C answer research stores **source metadata**, not scraped source content, in its candidate research workspace. Answer-source capture requires an `http` or `https` URL and an explicit source type:

- `primary`
- `official`
- `academic`
- `expert`
- `reputable_secondary`
- `other`

Recording a source does not certify the truth of its claims. It only establishes provenance for the answer candidate.

Source-Grounded SPARK uses a separate **pre-candidate Source Pack** which may store bounded excerpts explicitly supplied for question discovery. Those excerpts are never promoted automatically into answer-source artifacts. The distinction is deliberate: Source Packs explain *why we asked*; research sources support *how we answer*.

For live research, Phase 4C may use Hermes' existing read-only `web_search` and `web_extract` core tools. These are discovery/retrieval tools only: results must still be evaluated by the research profile and then recorded explicitly through the JOKO source-candidate tool before an answer may cite them. Search/extract output never becomes canonical knowledge by itself.

No private customer identity, order data, account information, or secrets may be sent in external web-search/extract queries. JOKO-local facts should prefer reviewed local Curiosity material or first-party/official sources where available.

## Sensitivity policy

At minimum, these topics are automatically escalated to high sensitivity when classified under the matching topic label:

- allergy / allergens
- food safety
- nutrition
- health / medical
- legal
- financial
- dangerous instructions

A high-sensitivity candidate cannot pass mechanical readiness with one ordinary secondary source. The pilot requires at least two sources and at least one `primary`, `official`, or `academic` source before it can even be marked **eligible for editorial review**.

Eligibility is not approval. `requires_human_review=true` remains mandatory for every candidate.

## Proposed MCP surface

After the pure workflow module is accepted, wire it into the JOKO MCP server with narrowly scoped tools such as:

- `spark_question_brief`
- `spark_source_pack_create`
- `spark_source_pack_read`
- `insight_foundry_source_brief`
- `spark_source_create_candidates`
- `curiosity_duplicate_check`
- `curiosity_classify_candidate`
- `research_add_source_candidate`
- `research_get_sources`
- `answer_create_candidate`
- `answer_run_checks`

No tool named or equivalent to `approve`, `promote_to_canonical`, or `publish_to_production` is permitted in Phase 4C.

## Acceptance gates before Phase 4C can be installed

1. Existing Phase 4A and 4B tests remain green.
2. SPARK can only emit question candidates and never gains factual/publication authority.
3. Source-grounded questions must retain source-pack, trigger, and source-reference provenance, while Source Pack material remains non-authoritative for answers.
4. Duplicate scoring is explicitly advisory and cannot auto-merge candidates.
5. Shared/JOKO scope remains explicit.
6. Only research can write classification/source/answer artifacts.
7. Source URLs are restricted to HTTP(S) metadata entries, and external web research remains read-only discovery rather than authority.
8. Answer candidates may reference only source IDs actually stored for the same candidate.
9. High-sensitivity readiness rules are stricter than ordinary topics.
10. Every readiness result still requires human editorial review.
11. Creative/operator remain unable to discover Phase 4C research-write tools.
12. Canonical Curiosity storage remains non-writable by `jokotoday`.
13. No database/RLS/Cloudflare/provider-secret/publishing change is introduced.
14. Hermes end-to-end acceptance is performed before the PR becomes merge-ready.

## Deferred decisions

The following are intentionally not decided by this slice:

- whether SPARK later becomes its own Hermes profile
- semantic embeddings/vector search for duplicate detection
- database-backed Curiosity entities
- automatic web retrieval inside the JOKO MCP server (Hermes core `web_search` / `web_extract` remain the read-only research path)
- editorial approval/promotion workflow (Phase 4D)
- automatic publishing

Those should be added only after the simple candidate workflow proves useful and observable.
