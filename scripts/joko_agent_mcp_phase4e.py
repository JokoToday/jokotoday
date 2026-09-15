#!/usr/bin/env python3
"""Phase 4E MCP extension: controlled Creative Answer candidate pipeline."""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import joko_agent_mcp as base
import joko_agent_mcp_phase4c as p4c
import joko_agent_mcp_phase4d as p4d
from joko_creative_answer_workspace import CreativeAnswerWorkspace, CreativeAssetStore, CreativeReleaseStore
from joko_editorial_review import EditorialReviewWorkspace, package_fingerprint
from joko_question_intelligence import QuestionIntelligenceError, rank_possible_duplicates
from joko_research_workspace import ResearchWorkspace

CREATIVE_ROOT_ENV = "JOKO_CURIOSITY_CREATIVE_ROOT"
CREATIVE_RELEASE_ROOT_ENV = "JOKO_CURIOSITY_CREATIVE_RELEASE_ROOT"
CREATIVE_ASSET_ROOT_ENV = "JOKO_CURIOSITY_CREATIVE_ASSET_ROOT"
PHASE4E_CAPABILITIES = (
    "creative_review_package_read",
    "creative_guide_propose",
    "creative_doodle_script_create_candidate",
    "creative_storyboard_create_candidate",
    "creative_lab_request_generation",
    "creative_bundle_read",
)


def phase4e_capability_names(role: str) -> tuple[str, ...]:
    normalized = (role or "").strip().casefold()
    if normalized == "creative":
        return PHASE4E_CAPABILITIES
    if normalized in {"editorial", "research", "operator"}:
        return ()
    raise QuestionIntelligenceError("profile role is not approved")


class Phase4EService:
    def __init__(self, canonical: Any, candidates: Any, research: ResearchWorkspace,
                 review: EditorialReviewWorkspace, releases: CreativeReleaseStore,
                 creative: CreativeAnswerWorkspace, role: str):
        self.role = (role or "").strip().casefold()
        if self.role != "creative":
            raise QuestionIntelligenceError("Phase 4E creative service requires the creative profile")
        self.canonical = canonical
        self.candidates = candidates
        self.research = research
        self.review = review
        self.releases = releases
        self.creative = creative

    def _duplicate_check(self, candidate_id: str, scope: str, limit: int = 5) -> dict[str, Any]:
        question = p4c._parse_question(self.candidates.read(candidate_id))
        items: list[dict[str, Any]] = []
        for path, rel, episode_scope in self.canonical._iter_markdown(scope):
            text = path.read_text(encoding="utf-8", errors="replace")
            items.append({
                "id": rel, "kind": "reviewed", "scope": episode_scope,
                "question": self.canonical._title(text, path.stem),
            })
        root = getattr(self.candidates, "root", None)
        rows = [(path.stem, None) for path in sorted(root.glob("cur-*.md"))] if root is not None else [
            (str(item.get("candidate_id", "")), item)
            for item in self.candidates.list_candidates(scope=scope, limit=200).get("candidates", [])
        ]
        for other_id, listed in rows:
            if not other_id or other_id == candidate_id:
                continue
            try:
                payload = self.candidates.read(other_id)
                metadata = payload.get("metadata") or {}
                candidate_scope = str(metadata.get("requested_scope") or (listed or {}).get("requested_scope") or "")
                if scope != "all" and candidate_scope != scope:
                    continue
                other_question = p4c._parse_question(payload)
            except Exception:
                continue
            items.append({
                "id": other_id, "kind": "candidate", "scope": candidate_scope, "question": other_question,
            })
        return {
            "candidate_id": candidate_id,
            "question": question,
            "possible_matches": rank_possible_duplicates(question, items, limit=limit),
            "authority": "advisory retrieval only; never auto-merge or semantic-equivalence authority",
        }

    def _current_package(self, candidate_id: str, duplicate_limit: int = 5) -> dict[str, Any]:
        candidate = self.candidates.read(candidate_id)
        question = p4c._parse_question(candidate)
        metadata = candidate.get("metadata") or {}
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
        duplicates = self._duplicate_check(candidate_id, duplicate_scope, duplicate_limit)
        return {
            "schema_version": 1,
            "artifact_type": "editorial_review_package",
            "candidate_id": candidate_id,
            "candidate_metadata": metadata,
            "question": question,
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

    def _released(self, candidate_id: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        package = self._current_package(candidate_id)
        latest = self.review.latest_submission(candidate_id, self.role)
        if latest is None:
            raise QuestionIntelligenceError("candidate has not been submitted for human editorial review")
        status = self.review.status(candidate_id, self.role, package)
        if status.get("status") != "awaiting_human_review" or status.get("stale") is True:
            raise QuestionIntelligenceError("editorial review handoff is missing or stale")
        fingerprint = package_fingerprint(package)
        clearance = self.releases.require_current(candidate_id, latest, fingerprint)
        return package, latest, clearance

    def read_review_package(self, candidate_id: str) -> dict[str, Any]:
        package, submission, clearance = self._released(candidate_id)
        return {
            "candidate_id": candidate_id,
            "review_package": package,
            "review_submission": submission,
            "creative_clearance": clearance,
            "creative_derivation_only": True,
            "factual_authority": False,
            "publication_authority": False,
            "trust": "human-cleared input for staging creative derivation; canonical text/sources remain authoritative",
        }

    def propose_guide(self, candidate_id: str, guide_ref: str, guide_label: str,
                      style_profile_id: str, voice_mode: str, rationale: str = "") -> dict[str, Any]:
        _, _, clearance = self._released(candidate_id)
        return self.creative.propose_guide(
            candidate_id, self.role, clearance, guide_ref, guide_label,
            style_profile_id, voice_mode, rationale,
        )

    def create_script(self, candidate_id: str, guide_proposal_id: str, duration_seconds: int,
                      beats_json: str, accessibility_text: str) -> dict[str, Any]:
        package, _, clearance = self._released(candidate_id)
        source_ids = set((package.get("latest_answer") or {}).get("source_ids") or [])
        return self.creative.create_script(
            candidate_id, self.role, clearance, guide_proposal_id, duration_seconds,
            beats_json, accessibility_text, source_ids,
        )

    def create_storyboard(self, candidate_id: str, doodle_script_id: str, panels_json: str,
                          accessibility_summary: str, style_profile_id: str = "living-notebook-v1",
                          aspect_ratio: str = "9:16") -> dict[str, Any]:
        _, _, clearance = self._released(candidate_id)
        return self.creative.create_storyboard(
            candidate_id, self.role, clearance, doodle_script_id, panels_json,
            style_profile_id, aspect_ratio, accessibility_summary,
        )

    def request_generation(self, candidate_id: str, storyboard_id: str,
                           generation_mode: str = "doodle_keyframes", candidate_count: int = 1) -> dict[str, Any]:
        _, _, clearance = self._released(candidate_id)
        return self.creative.request_generation(
            candidate_id, self.role, clearance, storyboard_id, generation_mode, candidate_count,
        )

    def bundle(self, candidate_id: str) -> dict[str, Any]:
        _, _, clearance = self._released(candidate_id)
        return self.creative.bundle(candidate_id, self.role, clearance)


def create_server():
    role = base._normalize_profile_role(os.environ.get(base.PROFILE_ROLE_ENV, "reader"))
    server = p4d.create_server()
    if role != "creative":
        return server

    required = {
        "candidate": os.environ.get(base.CANDIDATE_ROOT_ENV, "").strip(),
        "research": os.environ.get(p4c.RESEARCH_ROOT_ENV, "").strip(),
        "review": os.environ.get(p4d.REVIEW_ROOT_ENV, "").strip(),
        "creative": os.environ.get(CREATIVE_ROOT_ENV, "").strip(),
        "release": os.environ.get(CREATIVE_RELEASE_ROOT_ENV, "").strip(),
        "assets": os.environ.get(CREATIVE_ASSET_ROOT_ENV, "").strip(),
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise QuestionIntelligenceError("Phase 4E creative profile is missing roots: " + ", ".join(missing))

    canonical = base.CuriosityStore.from_env()
    candidates = base.CandidateStore(required["candidate"])
    research = ResearchWorkspace(required["research"])
    review = EditorialReviewWorkspace(required["review"], candidates, canonical)
    assets = CreativeAssetStore(required["assets"])
    creative = CreativeAnswerWorkspace(required["creative"], assets)
    service = Phase4EService(
        canonical, candidates, research, review, CreativeReleaseStore(required["release"]), creative, role
    )

    @server.tool()
    def creative_review_package_read(candidate_id: str) -> str:
        """Read one current human-cleared review package for staging creative derivation only."""
        return json.dumps(service.read_review_package(candidate_id), ensure_ascii=False)

    @server.tool()
    def creative_guide_propose(candidate_id: str, guide_ref: str, guide_label: str,
                               style_profile_id: str, voice_mode: str,
                               rationale: str = "") -> str:
        """Propose an Answer Guide; guides are presentation devices and never factual authority."""
        return json.dumps(service.propose_guide(
            candidate_id, guide_ref, guide_label, style_profile_id, voice_mode, rationale
        ), ensure_ascii=False)

    @server.tool()
    def creative_doodle_script_create_candidate(candidate_id: str, guide_proposal_id: str,
                                                duration_seconds: int, beats_json: str,
                                                accessibility_text: str) -> str:
        """Create a 15-30 second source-anchored doodle-script candidate with accessibility text."""
        return json.dumps(service.create_script(
            candidate_id, guide_proposal_id, duration_seconds, beats_json, accessibility_text
        ), ensure_ascii=False)

    @server.tool()
    def creative_storyboard_create_candidate(candidate_id: str, doodle_script_id: str,
                                             panels_json: str, accessibility_summary: str,
                                             style_profile_id: str = "living-notebook-v1",
                                             aspect_ratio: str = "9:16") -> str:
        """Create an unreviewed storyboard candidate linked to a current cleared doodle script."""
        return json.dumps(service.create_storyboard(
            candidate_id, doodle_script_id, panels_json, accessibility_summary,
            style_profile_id, aspect_ratio
        ), ensure_ascii=False)

    @server.tool()
    def creative_lab_request_generation(candidate_id: str, storyboard_id: str,
                                        generation_mode: str = "doodle_keyframes",
                                        candidate_count: int = 1) -> str:
        """Queue a quota-limited Creative Lab staging request; Phase 4E does not call a provider."""
        return json.dumps(service.request_generation(
            candidate_id, storyboard_id, generation_mode, candidate_count
        ), ensure_ascii=False)

    @server.tool()
    def creative_bundle_read(candidate_id: str) -> str:
        """Read creative candidates, queued requests, and validated generated staging-asset metadata."""
        return json.dumps(service.bundle(candidate_id), ensure_ascii=False)

    return server


def main() -> int:
    try:
        asyncio.run(create_server().run_stdio_async())
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as exc:
        print(f"joko-phase4e-mcp: {exc}", file=os.sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
