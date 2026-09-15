# JOKO SPARK — Source-Grounded Question Discovery v1

Status: implementation candidate

## Purpose

Source-Grounded SPARK adds a second question-discovery path beside topic-first SPARK:

> **Find the curiosity hiding inside supplied knowledge.**

Instead of starting only with a topic, editorial/research can provide a bounded **Source Pack**. Insight Foundry inspects that material for question-generating friction; SPARK turns the strongest grounded insights into focused Curiosity candidates.

This does not make SPARK an answer engine or factual authority.

## Architecture

```text
Source Pack
  articles / papers / interviews / transcripts / field notes / product information
        ↓
Insight Foundry
  surprise / contradiction / mechanism / hidden variable / exception
  assumption / boundary / consequence / knowledge gap
        ↓
SPARK + question lens
        ↓
source-grounded question candidates
        ↓
existing duplicate → classification → research → editorial review workflow
```

The source pack explains **why a question was generated**. It does **not** automatically become accepted evidence for the answer.

## Three SPARK paths

1. **Topic SPARK** — topic/context → unusual questions.
2. **Source-Grounded SPARK** — supplied source pack → insight triggers → focused questions.
3. **Hybrid SPARK** — source pack may also carry a topic and editorial objective.

V1 uses the same editorial/research profiles as existing SPARK. No fifth persistent Hermes profile is introduced.

## Source Pack

A Source Pack is private pre-candidate staging material under the existing Curiosity research workspace.

Each source contains:

- generated `source_ref` (`source-01`, `source-02`, ...)
- source kind
- title
- optional publisher
- optional HTTP(S) URL
- required supplied excerpt

Approved source kinds:

- `article`
- `paper`
- `document`
- `interview`
- `transcript`
- `field_note`
- `product_info`
- `research_note`
- `other`

V1 does **not** fetch URLs itself. The caller supplies the excerpt to be analyzed. This avoids turning the JOKO MCP surface into an unrestricted fetcher.

Limits:

- 1–12 sources per pack
- 12,000 characters per excerpt
- bounded aggregate/file size
- HTTP(S) only when a URL is supplied
- no customer identity, account data, secrets, or other private operational data

## Insight Foundry trigger types

Insight Foundry looks for nine kinds of question-generating friction:

- `surprise`
- `contradiction`
- `causal_mechanism`
- `hidden_variable`
- `exception`
- `assumption`
- `boundary`
- `consequence`
- `knowledge_gap`

These are discovery labels, not factual verdicts. For example, `contradiction` means the supplied material appears to pull in different directions; it does not certify that either source is correct.

## Question lenses

The caller may select a lens:

- `mixed`
- `explain`
- `surprise`
- `challenge_assumptions`
- `contradictions`
- `practical_consequences`
- `hidden_variables`
- `unanswered`
- `never_asked`

`never_asked` is the closest implementation of the NAQ idea: questions a normal reader would not know they needed to ask.

## Grounded candidate contract

Every source-grounded candidate must include:

```json
{
  "question": "Can butter actually be too cold for croissants?",
  "trigger_type": "boundary",
  "source_refs": ["source-01", "source-02"],
  "rationale": "The material describes failure at both temperature extremes.",
  "why_interesting": "It challenges the simplistic colder-is-better rule."
}
```

Validation requires:

- an explicit question ending in `?` / `？`
- a recognized trigger type
- at least one source reference
- every source reference must exist in the source pack
- no duplicate questions within one SPARK batch
- bounded rationale and editorial-interest explanation

## Provenance persistence

Source-grounded candidates continue to use `origin_type=spark_discovery` for compatibility with the existing candidate schema.

In addition, V1 records an immutable candidate-stage grounding artifact. Each Source Pack has a SHA-256 content fingerprint, and the grounding artifact pins that exact fingerprint:

```text
candidate_id
source_pack_id
source_pack_sha256
lens
trigger_type
source_refs
rationale
why_interesting
```

Phase 4D review packages include this structured grounding artifact. Human editorial review can therefore see **why SPARK asked the question** and which supplied material triggered it.

The grounding artifact is not answer evidence and cannot publish anything.

## MCP additions

Available to `editorial` and `research` only:

- `spark_source_pack_create`
- `spark_source_pack_read`
- `insight_foundry_source_brief`
- `spark_source_create_candidates`

Creative and operator profiles receive none of these tools.

Expected total JOKO MCP tool counts after runtime installation:

```text
editorial  20
research   21
creative    3
operator    3
```

## Example flow

```text
1. spark_source_pack_create
   → source pack about croissant lamination

2. insight_foundry_source_brief
   lens=challenge_assumptions
   → source excerpts + trigger taxonomy + constrained generation contract

3. model identifies:
   boundary + source-01/source-02

4. spark_source_create_candidates
   → "Can butter actually be too cold for croissants?"

5. curiosity_duplicate_check

6. normal classification/research/answer checks

7. editorial_prepare_review
   → includes source_grounding
```

## Safety and authority boundaries

Source-Grounded SPARK must preserve the existing Question Intelligence boundaries:

- source packs are unreviewed staging material
- supplied claims are not treated as true merely because they were supplied
- source-pack URLs are not automatically fetched
- source-pack material is not automatically copied into answer evidence
- SPARK may ask questions but may not answer, approve, canonicalize, or publish
- every generated question remains an ordinary Curiosity candidate
- duplicate matching remains advisory
- research still needs explicit answer-source capture
- human editorial review remains mandatory

## Deferred

V1 deliberately does not add:

- a third-party upload UI
- direct PDF/document ingestion inside MCP
- automated source fetching or scraping
- embeddings/vector clustering of source packs
- autonomous generation/publication loops
- source-pack sharing between tenants
- automatic conversion of source-pack excerpts into answer sources

Those can be layered on after the grounded-question contract proves useful in real editorial work.
