#!/usr/bin/env python3
"""Phase 4D MCP extension for editorial review handoff and Curiosity Graph proposals."""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import joko_agent_mcp as base
import joko_agent_mcp_phase4c as p4c
from joko_editorial_review import EditorialReviewWorkspace
from joko_question_intelligence import QuestionIntelligenceError
from joko_research_workspace import ResearchWorkspace

REVIEW_ROOT_ENV = "JOKO_CURIOSITY_REVIEW_ROOT"
PHASE4D_ROLES = {"editorial", "research"}
PHASE4D_COMMON_CAPABILITIES = (
    "curiosity_relationship_create_candidate",
    "curiosity_relationship_list",
    "editorial_review_status",
)
PHASE4D_EDITORIAL_CAPABILITIES = (
    "editorial_prepare_review",
    "editorial_submit_for_review",
)


def phase4d_capability_names(role: str) -> tuple[str, ...]:
    normalized = (role or "").strip().casefold()
    if normalized == "editorial":
        return PHASE4D_COMMON_CAPABILITIES + PHASE4D_EDITORIAL_CAPABILITIES
    if normalized == "research":
        return PHASE4D_COMMON_CAPABILITIES
    if normalized in {"creative", "operator"}:
        return ()
    raise QuestionIntelligenceError("profile role is not approved")


class Phase4DService:
    def __init__(self, canonical: Any, candidates: Any, research: ResearchWorkspace,
                 review: EditorialReviewWorkspace, role: str):
        self.role = (role or "").strip().casefold()
        phase4d_capability_names(self.role)
        self.canonical = canonical
        self.candidates = candidates
        self.research = research
        self.review = review
        self.phase4c = p4c.Phase4CService(canonical, candidates, research, self.role)

    def create_relationship(self, candidate_id: str, relation_type: str,
                            target_kind: str, target_ref: str, rationale: str = "") -> dict[str, Any]:
        if self.role not in PHASE4D_ROLES:
            raise QuestionIntelligenceError("this profile cannot create Curiosity Graph proposals")
        return self.review.create_relation(
            candidate_id, self.role, relation_type, target_kind, target_ref, rationale
        )

    def list_relationships(self, candidate_id: str) -> dict[str, Any]:
        if self.role not in PHASE4D_ROLES:
            raise QuestionIntelligenceError("this profile cannot inspect Curiosity Graph proposals")
        return self.review.list_relations(candidate_id, self.role)

    def _review_package(self, candidate_id: str, duplicate_limit: int = 5) -> dict[str, Any]:
        candidate = self.candidates.read(candidate_id)
        question = p4c._parse_question(candidate)
        metadata = candidate.get("metadata") or {}
        source_grounding = self.phase4c.source_grounding(candidate_id)
        try:
            classification = self.research.read_classification(candidate_id, self.role)
        except QuestionIntelligenceError:
            classification = None
        sources = self.research.get_sources(candidate_id, self.role)
        answers = self.research.get_answers(candidate_id, self.role)
        latest_answer = answers[0] if answers else None
        cited_ids = list((latest_answer or {}).get("source_ids") or [])
        sources_by_id = {item.get("source_id"): item for item in sources}
        cited_sources = [sources_by_id[sid] for sid in cited_ids if sid in sources_by_id]
        readiness = self.research.readiness(candidate_id, self.role)
        relationships = self.review.list_relations(candidate_id, self.role)["relationships"]
        duplicate_scope = str(metadata.get("requested_scope") or "all")
        duplicates = self.phase4c.duplicate_check(candidate_id, duplicate_scope, duplicate_limit)
        return {
            "schema_version": 1,
            "artifact_type": "editorial_review_package",
            "candidate_id": candidate_id,
            "candidate_metadata": metadata,
            "question": question,
            "source_grounding": source_grounding,
            "classification": classification,
            "latest_answer": latest_answer,
            "cited_sources": cited_sources,
            "source_count": len(sources),
            "answer_count": len(answers),
            "relationship_candidates": relationships,
            "duplicate_check": duplicates,
            "readiness": readiness,
            "ready_to_submit": bool(readiness.get("eligible_for_editorial_review")),
            "human_review_required": True,
            "approval_authority": False,
            "publication_authority": False,
            "trust": "review preparation only; not approval, canonicalization, or publication authority",
        }

    def prepare_review(self, candidate_id: str, duplicate_limit: int = 5) -> dict[str, Any]:
        if self.role != "editorial":
            raise QuestionIntelligenceError("only editorial can prepare the human review handoff")
        return self._review_package(candidate_id, duplicate_limit)

    def submit_for_review(self, candidate_id: str, review_notes: str = "", duplicate_limit: int = 5) -> dict[str, Any]:
        if self.role != "editorial":
            raise QuestionIntelligenceError("only editorial can submit a candidate for human review")
        package = self._review_package(candidate_id, duplicate_limit)
        return self.review.submit(candidate_id, self.role, package, review_notes)

    def review_status(self, candidate_id: str, duplicate_limit: int = 5) -> dict[str, Any]:
        if self.role not in PHASE4D_ROLES:
            raise QuestionIntelligenceError("this profile cannot inspect editorial review status")
        package = self._review_package(candidate_id, duplicate_limit)
        return self.review.status(candidate_id, self.role, package)


def create_server():
    role = base._normalize_profile_role(os.environ.get(base.PROFILE_ROLE_ENV, "reader"))
    server = p4c.create_server()
    if role not in PHASE4D_ROLES:
        return server

    review_root = os.environ.get(REVIEW_ROOT_ENV, "").strip()
    research_root = os.environ.get(p4c.RESEARCH_ROOT_ENV, "").strip()
    if not review_root:
        raise QuestionIntelligenceError(f"{REVIEW_ROOT_ENV} is required for Phase 4D profiles")
    if not research_root:
        raise QuestionIntelligenceError(f"{p4c.RESEARCH_ROOT_ENV} is required for Phase 4D profiles")

    canonical = base.CuriosityStore.from_env()
    candidates = base.CandidateStore.from_env()
    research = ResearchWorkspace(research_root)
    review = EditorialReviewWorkspace(review_root, candidates, canonical)
    service = Phase4DService(canonical, candidates, research, review, role)

    @server.tool()
    def curiosity_relationship_create_candidate(candidate_id: str, relation_type: str,
                                                target_kind: str, target_ref: str,
                                                rationale: str = "") -> str:
        """Create an unreviewed related/follow-up Curiosity Graph proposal only."""
        return json.dumps(service.create_relationship(
            candidate_id, relation_type, target_kind, target_ref, rationale
        ), ensure_ascii=False)

    @server.tool()
    def curiosity_relationship_list(candidate_id: str) -> str:
        """List unreviewed Curiosity Graph proposals for one candidate."""
        return json.dumps(service.list_relationships(candidate_id), ensure_ascii=False)

    @server.tool()
    def editorial_review_status(candidate_id: str, duplicate_limit: int = 5) -> str:
        """Return review-handoff status; this never approves, promotes, or publishes."""
        return json.dumps(service.review_status(candidate_id, duplicate_limit), ensure_ascii=False)

    if role == "editorial":
        @server.tool()
        def editorial_prepare_review(candidate_id: str, duplicate_limit: int = 5) -> str:
            """Assemble a deterministic human-review package without changing review state."""
            return json.dumps(service.prepare_review(candidate_id, duplicate_limit), ensure_ascii=False)

        @server.tool()
        def editorial_submit_for_review(candidate_id: str, review_notes: str = "",
                                        duplicate_limit: int = 5) -> str:
            """Submit an eligible candidate for human editorial review; never approve or publish."""
            return json.dumps(service.submit_for_review(
                candidate_id, review_notes, duplicate_limit
            ), ensure_ascii=False)

    return server


def main() -> int:
    try:
        asyncio.run(create_server().run_stdio_async())
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as exc:
        print(f"joko-phase4d-mcp: {exc}", file=os.sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
