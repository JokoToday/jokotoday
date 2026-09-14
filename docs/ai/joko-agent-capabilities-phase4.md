# JOKO Agent Capabilities — Phase 4+

Status: Phase 4A accepted; Phase 4B implementation candidate

## Objective

Give the four isolated JOKO Hermes profiles controlled JOKO-specific capabilities while preserving the Phase 1–3 isolation model and the updated Curiosity Engine architecture.

The important architectural rule is now:

> Curiosities are atomic and portable. The Curiosity Engine owns the canonical episode; the Notebook, embeds, homepage, product pages, and later third-party surfaces are presentations of that episode.

Hermes therefore works against Curiosity Engine capability contracts, not against Notebook pages and not against production commerce tables directly.

## Profiles

- `editorial`
- `research`
- `creative`
- `operator`

All four continue to use `custom:joko-ai` with default model `joko/standard`. Phase 3 provider isolation remains unchanged.

## Non-negotiable capability principles

1. Least privilege first.
2. Read access before write access.
3. Shared and JOKO/local Curiosities are explicit scopes, never inferred silently.
4. Candidate creation is separate from canonical Curiosity content.
5. Canonical episodes remain human-reviewed and versioned.
6. JOKO products and operational business objects remain outside the Curiosity Engine; Curiosities may reference them through host relationships.
7. Private customer identity is never exposed through portable Curiosity capability output.
8. Answer Guides are presentation/explainer characters; factual authority comes from sources, review, and confidence checks.
9. No raw AI answer becomes trusted canonical knowledge automatically.
10. No Hermes tool may publish directly to production.
11. No Hermes profile receives Supabase service-role, OpenRouter, Ollama, OpenAI, GitHub-write, Cloudflare, or production database credentials merely to use JOKO capabilities.
12. Every future mutating capability writes to an explicit candidate/staging surface or passes through a human approval boundary.

## Canonical Curiosity layout for the Phase 4 pilot

Before a database-backed Curiosity domain is approved, Phase 4 uses a small Git-backed Markdown mirror as the canonical read surface:

```text
/srv/joko/curiosity/current/
├── shared/
│   └── <episode>.md
└── hosts/
    └── joko-today/
        └── <episode>.md
```

`shared/` is portable general knowledge.

`hosts/joko-today/` is JOKO-specific knowledge and must never be treated as reusable Shared Library content merely because the subject is broadly interesting.

The mirror is owned by an administrative account/root and readable but not writable by Unix user `jokotoday`.

Recommended permissions:

```text
/srv/joko/curiosity                 root:jokotoday 0750
/srv/joko/curiosity/current         root:jokotoday 0550
Markdown episode files              root:jokotoday 0440
```

The public application repository is not the long-term home for confidential canonical JOKO knowledge. The canonical Git remote should ultimately be private and compatible with the planned JOKO documentation/Obsidian workflow.

## Phase 4A — Curiosity Read Surface

Initial MCP surface:

- `curiosity_list`
- `curiosity_search`
- `curiosity_read`

These tools expose only reviewed Curiosity Episode Markdown below the two approved namespaces. They do not expose private account data, production database access, raw CMS content, shell execution, or writes.

All reads are bounded. Absolute paths, `..` traversal, non-Markdown files, symlink escapes, oversized files, and unapproved top-level namespaces are rejected.

The tool output labels every episode as `shared` or `joko` from its namespace so scope remains explicit to the agent.

### Phase 4A capability matrix

| Capability | editorial | research | creative | operator |
| --- | --- | --- | --- | --- |
| curiosity_list | read | read | read | read |
| curiosity_search | read | read | read | read |
| curiosity_read | read | read | read | read |
| curiosity_create_candidate | none | none | none | none |
| research_* | none | none | none | none |
| creative_* | none | none | none | none |
| embed_* | none | none | none | none |
| editorial_submit_for_review | none | none | none | none |
| publish_to_production | never | never | never | never |

## Hermes MCP configuration for Phase 4A

Each named profile receives the same local stdio server and an explicit tool whitelist:

```yaml
mcp_servers:
  joko:
    command: /home/jokotoday/.hermes/hermes-agent/venv/bin/python
    args:
      - /home/jokotoday/capabilities/joko_agent_mcp.py
    env:
      JOKO_CURIOSITY_ROOT: /srv/joko/curiosity/current
    enabled: true
    supports_parallel_tool_calls: true
    tools:
      include:
        - curiosity_list
        - curiosity_search
        - curiosity_read
```

Hermes registers these as `mcp_joko_curiosity_list`, `mcp_joko_curiosity_search`, and `mcp_joko_curiosity_read`.

No MCP secret is required for Phase 4A because the server is a local stdio subprocess and the filesystem permission boundary is the authority boundary.

## Phase 4A acceptance tests

Phase 4A is accepted only when all of the following pass:

1. All four profiles discover exactly the three approved JOKO Curiosity tools.
2. Shared and JOKO scope filtering returns only its own namespace.
3. `curiosity_search` finds a known reviewed episode.
4. `curiosity_read` returns bounded content and explicit scope.
5. Traversal such as `../secret.md` is rejected.
6. Non-Markdown reads are rejected.
7. Symlink escape is rejected.
8. Files outside `shared/` and `hosts/joko-today/` are rejected.
9. No write/create/delete JOKO tool is registered.
10. Canonical Curiosity content remains non-writable by `jokotoday`.
11. A Hermes one-shot request can search/read an episode and answer from it through the JOKO AI Gateway.
12. Process/config audit confirms Phase 3 provider isolation is unchanged.

## Phase 4B — Curiosity Candidate Intake

Phase 4B adds the first mutating JOKO capability, but only on a separate unreviewed candidate surface. Canonical Curiosity Episodes remain read-only.

Initial MCP additions:

- `curiosity_candidate_list`
- `curiosity_candidate_read`
- `curiosity_create_candidate`

Candidate storage is intentionally separate from canonical knowledge:

```text
Canonical:  /srv/joko/curiosity/current                      root-owned, read-only
Candidates: /home/jokotoday/workspace/candidates/curiosity   jokotoday-owned, staging only
```

Every candidate records:

- generated immutable candidate ID
- proposed question
- explicit requested scope: `shared` or `joko`
- true origin type
- JOKO host when scope is local
- provenance notes
- creating Hermes profile
- UTC creation time
- status `candidate`

Allowed origin types for this pilot are `editorial_prompt`, `research_discovery`, `user_question`, `host_observation`, and `import`. This is provenance, not editorial approval.

Shared candidates reject a host-specific scope. JOKO/local candidates require `host=joko-today`. This prevents an agent from silently converting JOKO-specific facts into portable Shared knowledge.

Candidate files are untrusted staging artifacts. Reading a candidate never upgrades its trust level and no Phase 4B tool can promote, approve, move into canonical storage, delete, or publish it.

### Phase 4B capability matrix

| Capability | editorial | research | creative | operator |
| --- | --- | --- | --- | --- |
| curiosity_list | read | read | read | read |
| curiosity_search | read | read | read | read |
| curiosity_read | read | read | read | read |
| curiosity_candidate_list | read | read | none | none |
| curiosity_candidate_read | read | read | none | none |
| curiosity_create_candidate | create | create | none | none |
| research_* | none | none | none | none |
| creative_* | none | none | none | none |
| editorial_submit_for_review | none | none | none | none |
| publish_to_production | never | never | never | never |

The MCP server enforces the profile role using `JOKO_PROFILE_ROLE` and Hermes also uses an explicit per-profile tool whitelist. This is deliberate defense in depth. `editorial` and `research` receive six JOKO tools; `creative` and `operator` remain on the three Phase 4A read-only tools.

Example editorial/research MCP environment:

```yaml
env:
  JOKO_CURIOSITY_ROOT: /srv/joko/curiosity/current
  JOKO_CURIOSITY_CANDIDATE_ROOT: /home/jokotoday/workspace/candidates/curiosity
  JOKO_PROFILE_ROLE: editorial  # or research
```

Creative/operator set only `JOKO_CURIOSITY_ROOT` plus their own role and do not receive the candidate root.

### Phase 4B acceptance tests

Phase 4B is accepted only when all of the following pass:

1. Existing Phase 4A canonical read tests still pass.
2. `editorial` and `research` discover exactly six JOKO tools.
3. `creative` and `operator` still discover exactly three JOKO tools.
4. Editorial and research can create valid Shared candidates.
5. JOKO/local candidate creation requires explicit `host=joko-today`.
6. Shared candidate creation rejects host-specific scope.
7. Creative and operator cannot discover or call candidate tools.
8. Candidate IDs are server-generated and candidate reads cannot accept arbitrary filesystem paths.
9. Candidate writes are atomic, non-overwriting, and mode `0600`.
10. Malformed/unmarked files in the candidate workspace are not treated as candidates.
11. Canonical `/srv/joko/curiosity/current` remains non-writable by `jokotoday`.
12. No candidate operation can publish or promote content.
13. Hermes can create a test candidate through MCP, read it back, and continue reasoning through the JOKO AI Gateway.
14. Phase 3 provider isolation and the no-persistent-JOKO-daemon rule remain unchanged.

## Phase 4C — Question Intelligence and Research

Add controlled candidate-stage tools for the workflow:

```text
question submitted or editorial prompt
        ↓
duplicate / semantic-equivalence check
        ↓
Shared vs JOKO/local scope classification
        ↓
topic classification
        ↓
research + source capture
        ↓
answer draft
        ↓
confidence / sensitivity / factual checks
        ↓
review package
```

Representative capabilities may include:

- `curiosity_duplicate_check`
- `curiosity_classify_candidate`
- `research_add_source_candidate`
- `research_get_sources`
- `answer_create_candidate`
- `answer_run_checks`

All outputs remain candidate artifacts. High-sensitivity topics such as allergens, food safety, health, legal, financial, or dangerous instructions require stronger review rules and must never bypass human approval.

## Phase 4D — Editorial Review and Curiosity Graph

Introduce controlled editorial packaging, not publication:

- `curiosity_related_candidate`
- `curiosity_prepare_review`
- `editorial_submit_for_review`
- `editorial_review_status`

This phase may also prepare related-question links, follow-up questions, and the `This made Jokomi wonder…` continuation candidate.

Human review remains the gate from candidate state into canonical Curiosity content.

`publish_to_production` remains absent.

## Phase 4E — Creative Answer Pipeline

Only after reviewed text/source flow is stable, expose controlled creative capabilities to the `creative` profile:

- read approved Curiosity review packages
- select/propose an Answer Guide
- create a doodle-script candidate
- create a storyboard candidate
- request Creative Lab generation under quotas
- read generated staging assets

Creative outputs remain staging assets until reviewed. They do not redefine factual content.

The preferred output can include the 15–30 second hand-drawn/doodle explanation, but every episode must retain a text answer and accessibility representation.

## Phase 4F — Host Relationships and Embeds

Curiosity Episodes remain canonical; presentation configuration remains separate.

Add candidate-stage host relationship and embed tools such as:

- `host_relationship_list`
- `host_relationship_create_candidate`
- `embed_preset_list`
- `embed_create_candidate`
- `embed_preview`

Internal JOKO embeds should eventually render natively in React. Future external integrations may use a web component, embed script, iframe, or API renderer as appropriate.

An embed may choose whether to show asker, Answer Guide, animation, text answer, sources, related questions, `I wondered that too`, host CTA, theme, and language. Those choices belong to the embed, not the canonical Curiosity Episode.

## Phase 4G — Controlled Orchestration and Prioritisation

After the individual capability boundaries have been proven, the `operator` profile may orchestrate approved workflows as a state machine.

Permitted signals can eventually include:

- unanswered question demand
- duplicate/submission frequency
- `I wondered that too` count
- review age
- missing translation
- missing animation
- editorial priority

These signals may prioritize work but must not independently authorize publication.

Automation should operate on one iteration/job at a time, record status, and stop at explicit review gates.

## Beyond Phase 4 — database-backed Curiosity Engine

Only after the Curiosity domain model is reviewed should the static Git-backed pilot be replaced or supplemented by database-backed entities for episodes, answers, topics, sources, relationships, personas, wonders, translations, review state, and generation jobs.

That later migration must preserve:

- Shared vs host-specific scope
- private-account vs public-persona separation
- canonical episode vs presentation/embed separation
- host business objects outside the Curiosity core
- human review before trusted publication
- portable Shared Curiosity data containing no private customer data

The JOKO pilot comes first. Do not prematurely build a multi-tenant commercial platform.

## Implementation source

Phase 4A MCP server:

```text
scripts/joko_agent_mcp.py
```

Boundary tests:

```text
scripts/test_joko_agent_mcp.py
```
