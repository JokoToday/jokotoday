# JOKO Agent Capabilities — Phase 4+

Status: revised Phase 4A implementation candidate

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

Only after Phase 4A is stable, add candidate creation. The first mutating capability should be narrow and explicit, for example:

- `curiosity_create_candidate`
- `curiosity_candidate_list`
- `curiosity_candidate_read`

Candidate writes go only to a separate workspace such as:

```text
Canonical:  /srv/joko/curiosity/current                      read-only
Candidates: /home/jokotoday/workspace/candidates/curiosity   writable
```

A candidate records the proposed question, requested scope, true origin type, host when relevant, and provenance notes. It is not a published Curiosity and cannot silently become canonical.

Initial write authority should be limited to `editorial` and `research`. `creative` remains read-only; `operator` may inspect workflow state later but should not invent editorial content merely because it orchestrates jobs.

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
