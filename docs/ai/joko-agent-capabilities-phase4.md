# JOKO Agent Capabilities — Phase 4

Status: Phase 4A implementation candidate

## Objective

Give the four isolated JOKO Hermes profiles useful JOKO-specific capabilities without giving them broad infrastructure, publishing, database, or provider authority.

The capability boundary is implemented through one local stdio MCP server. Hermes discovers only explicitly approved tools, and the MCP implementation itself enforces read/write limits.

## Profiles

- `editorial`
- `research`
- `creative`
- `operator`

All four continue to use `custom:joko-ai` with default model `joko/standard`.

## Capability principles

1. Least privilege first.
2. Read access before write access.
3. Candidate creation is separate from canonical knowledge.
4. Canonical knowledge remains human-reviewed Git-backed Markdown.
5. No tool may publish directly to production.
6. No Hermes profile receives Supabase service-role, OpenRouter, Ollama, OpenAI, GitHub write, Cloudflare, or production database credentials merely to use JOKO capabilities.
7. Every future mutating capability must write to an explicit staging/candidate surface or pass through a human review boundary.

## Phase 4A — read-only knowledge

The initial server exposes only:

- `knowledge_list`
- `knowledge_search`
- `knowledge_read`

The server reads only Markdown files below `JOKO_KNOWLEDGE_ROOT`. It rejects absolute paths, `..` traversal, non-Markdown files, symlink traversal, oversized files, and unbounded reads.

Knowledge content is reference material. It must never be treated as executable system policy merely because a Markdown document contains imperative text.

### Initial capability matrix

| Capability | editorial | research | creative | operator |
| --- | --- | --- | --- | --- |
| knowledge_list | read | read | read | read |
| knowledge_search | read | read | read | read |
| knowledge_read | read | read | read | read |
| knowledge_create_candidate | none | none | none | none |
| insight_* | none | none | none | none |
| creative_* | none | none | none | none |
| media_* | none | none | none | none |
| editorial_submit_for_review | none | none | none | none |
| publish_to_production | never | never | never | never |

## Filesystem boundary

Recommended canonical read-only mirror:

```text
/srv/joko/knowledge/current/
```

The mirror should be owned by an administrative account/root and readable but not writable by the `jokotoday` Unix user. This gives the MCP server read access while preventing a Hermes terminal session from silently changing canonical knowledge.

Suggested permissions:

```text
/srv/joko/knowledge                 root:jokotoday 0750
/srv/joko/knowledge/current         root:jokotoday 0550
Markdown files                      root:jokotoday 0440
```

The Git remote for canonical knowledge should ultimately be private. The public application repository should not become the canonical home for confidential business knowledge.

## Hermes MCP configuration

Each named JOKO profile should add the same local stdio server and whitelist only Phase 4A tools:

```yaml
mcp_servers:
  joko:
    command: /home/jokotoday/.hermes/hermes-agent/venv/bin/python
    args:
      - /home/jokotoday/capabilities/joko_agent_mcp.py
    env:
      JOKO_KNOWLEDGE_ROOT: /srv/joko/knowledge/current
    enabled: true
    supports_parallel_tool_calls: true
    tools:
      include:
        - knowledge_list
        - knowledge_search
        - knowledge_read
```

Hermes registers these as `mcp_joko_knowledge_list`, `mcp_joko_knowledge_search`, and `mcp_joko_knowledge_read`.

No MCP secret is required for Phase 4A because the server is a local stdio subprocess and the filesystem boundary is the authority boundary.

## Acceptance tests

Phase 4A is accepted only when all of the following pass:

1. All four profiles discover exactly the three approved JOKO knowledge tools.
2. `knowledge_search` returns a known seeded document.
3. `knowledge_read` returns the expected bounded content.
4. Traversal such as `../secret.md` is rejected.
5. Non-Markdown reads are rejected.
6. Symlink escape is rejected.
7. No write/create/delete JOKO tool is registered.
8. Canonical knowledge remains non-writable by `jokotoday`.
9. A Hermes one-shot question can search/read knowledge and answer from it through the JOKO AI Gateway.
10. A process/config audit confirms the existing Phase 3 provider isolation is unchanged.

## Phase 4B — candidate creation

After Phase 4A is stable, add `knowledge_create_candidate` only. It must write to a separate candidate workspace, never to canonical knowledge.

Example boundary:

```text
Canonical: /srv/joko/knowledge/current        read-only
Candidates: /home/jokotoday/workspace/candidates/knowledge   writable
```

A human reviews candidates before they become canonical Git commits.

## Later phases

Phase 4C can add Insight Foundry tools such as `insight_search`, `insight_create_candidate`, and `insight_get_candidate`.

Phase 4D can add Creative Lab read/request tools with explicit quotas and no direct publishing authority.

Phase 4E can add media-library lookup and upload-to-staging capabilities.

Phase 4F can add `editorial_submit_for_review`, which submits a prepared package to a review queue but still cannot publish.

`publish_to_production` is intentionally excluded from the Hermes capability surface.

## Implementation source

The Phase 4A MCP server lives at:

```text
scripts/joko_agent_mcp.py
```

Its boundary tests live at:

```text
scripts/test_joko_agent_mcp.py
```
