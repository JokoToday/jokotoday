#!/usr/bin/env python3
"""Phase 4F MCP extension: candidate-stage host relationships and native embed contracts."""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import joko_agent_mcp as base
import joko_agent_mcp_phase4c as p4c
import joko_agent_mcp_phase4d as p4d
import joko_agent_mcp_phase4e as p4e
from joko_creative_answer_workspace import CreativeReleaseStore
from joko_editorial_review import EditorialReviewWorkspace, package_fingerprint
from joko_host_embed_workspace import HostEmbedWorkspace
from joko_question_intelligence import QuestionIntelligenceError
from joko_research_workspace import ResearchWorkspace

HOST_EMBED_ROOT_ENV = "JOKO_CURIOSITY_HOST_EMBED_ROOT"
PHASE4F_ROLES = {"editorial", "creative"}
PHASE4F_EDITORIAL_CAPABILITIES = (
    "host_relationship_list",
    "host_relationship_create_candidate",
    "embed_preset_list",
    "embed_create_candidate",
    "embed_candidate_list",
    "embed_preview",
)
PHASE4F_CREATIVE_CAPABILITIES = (
    "host_relationship_list",
    "embed_preset_list",
    "embed_create_candidate",
    "embed_candidate_list",
    "embed_preview",
)


def phase4f_capability_names(role: str) -> tuple[str, ...]:
    normalized = (role or "").strip().casefold()
    if normalized == "editorial":
        return PHASE4F_EDITORIAL_CAPABILITIES
    if normalized == "creative":
        return PHASE4F_CREATIVE_CAPABILITIES
    if normalized in {"research", "operator"}:
        return ()
    raise QuestionIntelligenceError("profile role is not approved")


class Phase4FService:
    def __init__(self, canonical: Any, candidates: Any, research: ResearchWorkspace,
                 review: EditorialReviewWorkspace, workspace: HostEmbedWorkspace,
                 role: str, releases: CreativeReleaseStore | None = None):
        self.role = (role or "").strip().casefold()
        phase4f_capability_names(self.role)
        if self.role not in PHASE4F_ROLES:
            raise QuestionIntelligenceError("Phase 4F service requires editorial or creative")
        self.canonical = canonical
        self.candidates = candidates
        self.research = research
        self.review = review
        self.workspace = workspace
        self.releases = releases
        # Always build the fingerprint through the Phase 4D editorial package
        # contract. This grants no editorial write capability to Creative; it is
        # a deterministic read-only package builder used to preserve fingerprint
        # identity across Phase 4D, 4E and 4F.
        self.package_builder = p4d.Phase4DService(
            canonical, candidates, research, review, "editorial"
        )

    def _context(self, candidate_id: str, require_current: bool = True) -> dict[str, Any]:
        package = self.package_builder._review_package(candidate_id)
        fingerprint = package_fingerprint(package)
        latest = self.review.latest_submission(candidate_id, "editorial")
        status = self.review.status(candidate_id, "editorial", package)
        current = bool(
            latest
            and status.get("status") == "awaiting_human_review"
            and status.get("stale") is not True
        )
        if require_current and not current:
            raise QuestionIntelligenceError("current non-stale human review submission is required")
        clearance = None
        if self.role == "creative" and require_current:
            if self.releases is None:
                raise QuestionIntelligenceError("creative release store is required")
            clearance = self.releases.require_current(candidate_id, latest, fingerprint)
        classification = package.get("classification") or {}
        metadata = package.get("candidate_metadata") or {}
        source_scope = str(
            classification.get("proposed_scope")
            or classification.get("scope")
            or metadata.get("requested_scope")
            or ""
        ).strip().casefold()
        if source_scope not in {"shared", "joko"}:
            raise QuestionIntelligenceError("candidate scope is not ready for Phase 4F")
        return {
            "package": package,
            "fingerprint": fingerprint,
            "latest_submission": latest,
            "review_status": status,
            "source_scope": source_scope,
            "creative_clearance": clearance,
            "current": current,
        }

    def create_host_relationship(self, candidate_id: str, host_site_id: str,
                                 host_domain: str, host_id: str,
                                 relationship_kind: str, host_label: str = "",
                                 host_path: str = "", rationale: str = "") -> dict[str, Any]:
        if self.role != "editorial":
            raise QuestionIntelligenceError("only editorial can create host relationship candidates")
        context = self._context(candidate_id, require_current=True)
        latest = context["latest_submission"] or {}
        return self.workspace.create_host_relationship(
            candidate_id, self.role, context["fingerprint"],
            str(latest.get("review_submission_id") or ""), context["source_scope"],
            host_site_id, host_domain, host_id, relationship_kind,
            host_label, host_path, rationale,
        )

    def list_host_relationships(self, candidate_id: str) -> dict[str, Any]:
        context = self._context(candidate_id, require_current=self.role == "creative")
        result = self.workspace.list_host_relationships(
            candidate_id, self.role, context["fingerprint"]
        )
        result["review_status"] = context["review_status"]
        result["source_scope"] = context["source_scope"]
        return result

    def preset_list(self) -> dict[str, Any]:
        return self.workspace.preset_list(self.role)

    def create_embed(self, candidate_id: str, host_relationship_id: str,
                     preset_id: str, feature_overrides_json: str = "",
                     language: str = "auto", theme: str = "paper",
                     cta_label: str = "", cta_path: str = "") -> dict[str, Any]:
        context = self._context(candidate_id, require_current=True)
        latest = context["latest_submission"] or {}
        return self.workspace.create_embed(
            candidate_id, self.role, context["fingerprint"],
            str(latest.get("review_submission_id") or ""), host_relationship_id,
            preset_id, feature_overrides_json, language, theme, cta_label, cta_path,
        )

    def list_embeds(self, candidate_id: str) -> dict[str, Any]:
        context = self._context(candidate_id, require_current=self.role == "creative")
        result = self.workspace.list_embeds(candidate_id, self.role, context["fingerprint"])
        result["review_status"] = context["review_status"]
        return result

    def preview(self, candidate_id: str, embed_candidate_id: str) -> dict[str, Any]:
        context = self._context(candidate_id, require_current=self.role == "creative")
        result = self.workspace.preview(
            candidate_id, self.role, context["fingerprint"], embed_candidate_id
        )
        package = context["package"]
        latest_answer = package.get("latest_answer") or {}
        result["content_preview"] = {
            "question": package.get("question"),
            "concise_answer": latest_answer.get("concise_answer"),
            "cited_source_count": len(package.get("cited_sources") or []),
            "source_grounding_present": package.get("source_grounding") is not None,
            "private_customer_identity_included": False,
        }
        result["review_status"] = context["review_status"]
        result["activation_status"] = "not_activated"
        return result


def create_server():
    role = base._normalize_profile_role(os.environ.get(base.PROFILE_ROLE_ENV, "reader"))
    server = p4e.create_server()
    if role not in PHASE4F_ROLES:
        return server

    root = os.environ.get(HOST_EMBED_ROOT_ENV, "").strip()
    candidate_root = os.environ.get(base.CANDIDATE_ROOT_ENV, "").strip()
    research_root = os.environ.get(p4c.RESEARCH_ROOT_ENV, "").strip()
    review_root = os.environ.get(p4d.REVIEW_ROOT_ENV, "").strip()
    if not root:
        raise QuestionIntelligenceError(f"{HOST_EMBED_ROOT_ENV} is required for Phase 4F profiles")
    if not candidate_root or not research_root or not review_root:
        raise QuestionIntelligenceError("Phase 4F requires candidate, research and review roots")

    canonical = base.CuriosityStore.from_env()
    candidates = base.CandidateStore(candidate_root)
    research = ResearchWorkspace(research_root)
    review = EditorialReviewWorkspace(review_root, candidates, canonical)
    releases = None
    if role == "creative":
        release_root = os.environ.get(p4e.CREATIVE_RELEASE_ROOT_ENV, "").strip()
        if not release_root:
            raise QuestionIntelligenceError("creative Phase 4F requires the Phase 4E release root")
        releases = CreativeReleaseStore(release_root)
    service = Phase4FService(
        canonical, candidates, research, review, HostEmbedWorkspace(root), role, releases
    )

    @server.tool()
    def host_relationship_list(candidate_id: str) -> str:
        """List candidate-stage host relationships; never mutates canonical Curiosity content."""
        return json.dumps(service.list_host_relationships(candidate_id), ensure_ascii=False)

    if role == "editorial":
        @server.tool()
        def host_relationship_create_candidate(candidate_id: str, host_site_id: str,
                                               host_domain: str, host_id: str,
                                               relationship_kind: str,
                                               host_label: str = "", host_path: str = "",
                                               rationale: str = "") -> str:
            """Create an editorial host-placement relationship candidate; never activates or publishes it."""
            return json.dumps(service.create_host_relationship(
                candidate_id, host_site_id, host_domain, host_id, relationship_kind,
                host_label, host_path, rationale
            ), ensure_ascii=False)

    @server.tool()
    def embed_preset_list() -> str:
        """List approved renderer-neutral Phase 4F embed presentation presets."""
        return json.dumps(service.preset_list(), ensure_ascii=False)

    @server.tool()
    def embed_create_candidate(candidate_id: str, host_relationship_id: str,
                               preset_id: str, feature_overrides_json: str = "",
                               language: str = "auto", theme: str = "paper",
                               cta_label: str = "", cta_path: str = "") -> str:
        """Create a native-React embed configuration candidate; never emits executable embed code or publishes."""
        return json.dumps(service.create_embed(
            candidate_id, host_relationship_id, preset_id, feature_overrides_json,
            language, theme, cta_label, cta_path
        ), ensure_ascii=False)

    @server.tool()
    def embed_candidate_list(candidate_id: str) -> str:
        """List candidate-stage embed configurations and stale status."""
        return json.dumps(service.list_embeds(candidate_id), ensure_ascii=False)

    @server.tool()
    def embed_preview(candidate_id: str, embed_candidate_id: str) -> str:
        """Return a deterministic native React preview contract; never returns HTML, scripts, iframes, or publication authority."""
        return json.dumps(service.preview(candidate_id, embed_candidate_id), ensure_ascii=False)

    return server


def main() -> int:
    try:
        asyncio.run(create_server().run_stdio_async())
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as exc:
        print(f"joko-phase4f-mcp: {exc}", file=os.sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
