#!/usr/bin/env python3
"""Phase 4C MCP extension for JOKO Curiosity Question Intelligence + Research."""
from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Any

from joko_question_intelligence import (
    QuestionIntelligenceError,
    build_spark_brief,
    rank_possible_duplicates,
    validate_spark_questions,
)
from joko_research_workspace import ResearchWorkspace

RESEARCH_ROOT_ENV = "JOKO_CURIOSITY_RESEARCH_ROOT"
PHASE4C_READ_ROLES = {"editorial", "research"}
PHASE4C_WRITE_ROLES = {"research"}
PHASE4C_COMMON_CAPABILITIES = (
    "spark_question_brief",
    "spark_create_candidates",
    "curiosity_duplicate_check",
    "research_get_sources",
    "answer_run_checks",
)
PHASE4C_RESEARCH_CAPABILITIES = (
    "curiosity_classify_candidate",
    "research_add_source_candidate",
    "answer_create_candidate",
)


def phase4c_capability_names(role: str) -> tuple[str, ...]:
    role = (role or "").strip().casefold()
    if role == "research":
        return PHASE4C_COMMON_CAPABILITIES + PHASE4C_RESEARCH_CAPABILITIES
    if role == "editorial":
        return PHASE4C_COMMON_CAPABILITIES
    if role in {"creative", "operator"}:
        return ()
    raise QuestionIntelligenceError("profile role is not approved")


def _parse_question(candidate_payload: dict[str, Any]) -> str:
    content = str(candidate_payload.get("content", ""))
    match = re.search(r"^## Proposed question\s*\n+(.+?)(?:\n+## |\Z)", content, flags=re.M | re.S)
    if not match:
        raise QuestionIntelligenceError("candidate question section is missing")
    question = re.sub(r"\s+", " ", match.group(1)).strip()
    if not question:
        raise QuestionIntelligenceError("candidate question is empty")
    return question


class Phase4CService:
    def __init__(self, canonical_store: Any, candidate_store: Any, research_workspace: ResearchWorkspace, role: str):
        role = (role or "").strip().casefold()
        phase4c_capability_names(role)
        self.canonical = canonical_store
        self.candidates = candidate_store
        self.research = research_workspace
        self.role = role

    def _candidate_question(self, candidate_id: str) -> str:
        return _parse_question(self.candidates.read(candidate_id))

    def spark_brief(self, mode: str, topic: str = "", context: str = "", count: int = 8) -> dict[str, Any]:
        if self.role not in PHASE4C_READ_ROLES:
            raise QuestionIntelligenceError("this profile cannot invoke SPARK")
        return build_spark_brief(mode, topic=topic, context=context, count=count)

    def spark_create(self, questions: list[str], mode: str, requested_scope: str,
                     host: str = "", provenance_notes: str = "") -> dict[str, Any]:
        if self.role not in PHASE4C_READ_ROLES:
            raise QuestionIntelligenceError("this profile cannot invoke SPARK")
        validated = validate_spark_questions(questions, mode=mode)
        created = []
        for item in validated:
            notes = f"SPARK mode={item['spark_mode']}"
            if provenance_notes.strip():
                notes += f"; {provenance_notes.strip()}"
            created.append(self.candidates.create(
                profile_role=self.role,
                question=item["question"],
                requested_scope=requested_scope,
                origin_type="spark_discovery",
                provenance_notes=notes,
                host=host,
            ))
        return {
            "count": len(created), "mode": mode, "candidates": created,
            "trust": "SPARK created question candidates only; no factual or publication authority",
        }

    def duplicate_check(self, candidate_id: str, scope: str = "all", limit: int = 5) -> dict[str, Any]:
        if self.role not in PHASE4C_READ_ROLES:
            raise QuestionIntelligenceError("this profile cannot inspect duplicate candidates")
        scope = (scope or "all").strip().casefold()
        if scope not in {"all", "shared", "joko"}:
            raise QuestionIntelligenceError("scope must be all, shared, or joko")
        question = self._candidate_question(candidate_id)
        items: list[dict[str, Any]] = []
        for episode in self.canonical.list_episodes(scope=scope, limit=200).get("episodes", []):
            items.append({
                "id": episode.get("path"), "kind": "reviewed",
                "scope": episode.get("scope"), "question": episode.get("title", ""),
            })
        for candidate in self.candidates.list_candidates(scope=scope, limit=200).get("candidates", []):
            other_id = str(candidate.get("candidate_id", ""))
            if not other_id or other_id == candidate_id:
                continue
            try:
                other_question = self._candidate_question(other_id)
            except Exception:
                continue
            items.append({
                "id": other_id, "kind": "candidate",
                "scope": candidate.get("requested_scope"), "question": other_question,
            })
        return {
            "candidate_id": candidate_id,
            "question": question,
            "possible_matches": rank_possible_duplicates(question, items, limit=limit),
            "authority": "advisory retrieval only; never auto-merge or semantic-equivalence authority",
        }

    def classify(self, candidate_id: str, proposed_scope: str, topic: str,
                 sensitivity: str = "normal", rationale: str = "", host: str = "") -> dict[str, Any]:
        if self.role not in PHASE4C_WRITE_ROLES:
            raise QuestionIntelligenceError("only research can write classification candidates")
        self._candidate_question(candidate_id)
        return self.research.save_classification(
            candidate_id, self.role, proposed_scope, topic, sensitivity, rationale, host
        )

    def add_source(self, candidate_id: str, url: str, title: str, publisher: str = "",
                   source_type: str = "reputable_secondary", notes: str = "") -> dict[str, Any]:
        if self.role not in PHASE4C_WRITE_ROLES:
            raise QuestionIntelligenceError("only research can add source candidates")
        self._candidate_question(candidate_id)
        return self.research.add_source(candidate_id, self.role, url, title, publisher, source_type, notes)

    def get_sources(self, candidate_id: str) -> dict[str, Any]:
        self._candidate_question(candidate_id)
        sources = self.research.get_sources(candidate_id, self.role)
        return {"candidate_id": candidate_id, "count": len(sources), "sources": sources}

    def create_answer(self, candidate_id: str, concise_answer: str, full_answer: str,
                      source_ids: list[str]) -> dict[str, Any]:
        if self.role not in PHASE4C_WRITE_ROLES:
            raise QuestionIntelligenceError("only research can create answer candidates")
        self._candidate_question(candidate_id)
        return self.research.create_answer(candidate_id, self.role, concise_answer, full_answer, source_ids)

    def readiness(self, candidate_id: str) -> dict[str, Any]:
        self._candidate_question(candidate_id)
        return self.research.readiness(candidate_id, self.role)


def _json_list(value: str, name: str) -> list[str]:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise QuestionIntelligenceError(f"{name} must be a JSON array") from exc
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        raise QuestionIntelligenceError(f"{name} must be a JSON array of strings")
    return parsed


def create_server():
    import joko_agent_mcp as base

    # Phase 4C extends true provenance without changing Phase 4B on disk.
    base.CANDIDATE_ORIGIN_TYPES.add("spark_discovery")
    role = base._normalize_profile_role(os.environ.get(base.PROFILE_ROLE_ENV, "reader"))
    canonical = base.CuriosityStore.from_env()
    candidate_store = base.CandidateStore.from_env() if role in PHASE4C_READ_ROLES else None
    server = base.create_server(store=canonical, candidate_store=candidate_store, profile_role=role)
    if role not in PHASE4C_READ_ROLES:
        return server

    root = os.environ.get(RESEARCH_ROOT_ENV, "").strip()
    if not root:
        raise QuestionIntelligenceError(f"{RESEARCH_ROOT_ENV} is required for Phase 4C profiles")
    service = Phase4CService(canonical, candidate_store, ResearchWorkspace(root), role)

    @server.tool()
    def spark_question_brief(mode: str, topic: str = "", context: str = "", count: int = 8) -> str:
        """Return a constrained SPARK brief for unusual question generation; never answers."""
        return json.dumps(service.spark_brief(mode, topic, context, count), ensure_ascii=False)

    @server.tool()
    def spark_create_candidates(questions_json: str, mode: str, requested_scope: str,
                                host: str = "", provenance_notes: str = "") -> str:
        """Store SPARK-generated questions as unreviewed Curiosity candidates only."""
        return json.dumps(service.spark_create(
            _json_list(questions_json, "questions_json"), mode, requested_scope, host, provenance_notes
        ), ensure_ascii=False)

    @server.tool()
    def curiosity_duplicate_check(candidate_id: str, scope: str = "all", limit: int = 5) -> str:
        """Return possible lexical duplicate matches; never auto-merges or declares equivalence."""
        return json.dumps(service.duplicate_check(candidate_id, scope, limit), ensure_ascii=False)

    @server.tool()
    def research_get_sources(candidate_id: str) -> str:
        """Read source metadata captured for one Curiosity candidate."""
        return json.dumps(service.get_sources(candidate_id), ensure_ascii=False)

    @server.tool()
    def answer_run_checks(candidate_id: str) -> str:
        """Run deterministic readiness checks; result never constitutes approval."""
        return json.dumps(service.readiness(candidate_id), ensure_ascii=False)

    if role == "research":
        @server.tool()
        def curiosity_classify_candidate(candidate_id: str, proposed_scope: str, topic: str,
                                         sensitivity: str = "normal", rationale: str = "", host: str = "") -> str:
            """Write an unreviewed scope/topic/sensitivity classification candidate."""
            return json.dumps(service.classify(
                candidate_id, proposed_scope, topic, sensitivity, rationale, host
            ), ensure_ascii=False)

        @server.tool()
        def research_add_source_candidate(candidate_id: str, url: str, title: str,
                                          publisher: str = "", source_type: str = "reputable_secondary",
                                          notes: str = "") -> str:
            """Record HTTP(S) source metadata for a candidate; does not certify its claims."""
            return json.dumps(service.add_source(
                candidate_id, url, title, publisher, source_type, notes
            ), ensure_ascii=False)

        @server.tool()
        def answer_create_candidate(candidate_id: str, concise_answer: str, full_answer: str,
                                    source_ids_json: str) -> str:
            """Create an unreviewed answer candidate referencing already-captured source IDs."""
            return json.dumps(service.create_answer(
                candidate_id, concise_answer, full_answer, _json_list(source_ids_json, "source_ids_json")
            ), ensure_ascii=False)

    return server


def main() -> int:
    try:
        asyncio.run(create_server().run_stdio_async())
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as exc:
        print(f"joko-phase4c-mcp: {exc}", file=os.sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
