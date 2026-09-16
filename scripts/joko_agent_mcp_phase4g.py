#!/usr/bin/env python3
"""Phase 4G MCP extension: controlled, non-autonomous Curiosity orchestration."""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import joko_agent_mcp as base
import joko_agent_mcp_phase4c as p4c
import joko_agent_mcp_phase4d as p4d
import joko_agent_mcp_phase4e as p4e
import joko_agent_mcp_phase4f as p4f
from joko_creative_answer_workspace import CreativeAnswerWorkspace, CreativeAssetStore, CreativeReleaseStore
from joko_editorial_review import EditorialReviewWorkspace, package_fingerprint
from joko_host_embed_workspace import HostEmbedWorkspace
from joko_orchestration_workspace import OrchestrationWorkspace, question_sha256
from joko_question_intelligence import QuestionIntelligenceError
from joko_research_workspace import ResearchWorkspace

ORCHESTRATION_ROOT_ENV = "JOKO_CURIOSITY_ORCHESTRATION_ROOT"
PHASE4G_ROLES = {"editorial", "research", "creative", "operator"}
PHASE4G_COMMON_CAPABILITIES = (
    "orchestration_template_list",
    "orchestration_run_list",
    "orchestration_run_status",
    "orchestration_next_action",
)
PHASE4G_OPERATOR_CAPABILITIES = ("orchestration_run_create",)


def phase4g_capability_names(role: str) -> tuple[str, ...]:
    role = (role or "").strip().casefold()
    if role == "operator":
        return PHASE4G_COMMON_CAPABILITIES + PHASE4G_OPERATOR_CAPABILITIES
    if role in {"editorial", "research", "creative"}:
        return PHASE4G_COMMON_CAPABILITIES
    raise QuestionIntelligenceError("profile role is not approved")


class Phase4GService:
    """Read-only domain projection + immutable run intent. Never executes suggested actions."""

    def __init__(self, canonical: Any, candidates: Any, research: ResearchWorkspace,
                 review: EditorialReviewWorkspace, releases: CreativeReleaseStore,
                 creative: CreativeAnswerWorkspace, host: HostEmbedWorkspace,
                 orchestration: OrchestrationWorkspace, role: str):
        self.role = (role or "").strip().casefold()
        phase4g_capability_names(self.role)
        self.canonical = canonical
        self.candidates = candidates
        self.research = research
        self.review = review
        self.releases = releases
        self.creative = creative
        self.host = host
        self.orchestration = orchestration
        self.package_builder = p4d.Phase4DService(
            canonical, candidates, research, review, "editorial"
        )

    def templates(self) -> dict[str, Any]:
        return self.orchestration.template_list(self.role)

    def create_run(self, candidate_id: str, template_id: str) -> dict[str, Any]:
        if self.role != "operator":
            raise QuestionIntelligenceError("only operator can create orchestration runs")
        candidate = self.candidates.read(candidate_id)
        question = p4c._parse_question(candidate)
        return self.orchestration.create(candidate_id, self.role, template_id, question)

    def list_runs(self, candidate_id: str = "") -> dict[str, Any]:
        return self.orchestration.list_runs(self.role, candidate_id)

    @staticmethod
    def _current_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [row for row in rows if row.get("stale") is not True]

    def _snapshot(self, run: dict[str, Any]) -> dict[str, Any]:
        candidate_id = str(run.get("candidate_id") or "")
        candidate = self.candidates.read(candidate_id)
        question = p4c._parse_question(candidate)
        question_changed = question_sha256(question) != run.get("candidate_question_sha256")

        readiness = self.research.readiness(candidate_id, "editorial")
        sources = self.research.get_sources(candidate_id, "editorial")
        answers = self.research.get_answers(candidate_id, "editorial")
        try:
            classification = self.research.read_classification(candidate_id, "editorial")
        except QuestionIntelligenceError:
            classification = None

        latest_submission = self.review.latest_submission(candidate_id, "editorial")
        duplicate_limit = int((latest_submission or {}).get("duplicate_limit", 5))
        package = self.package_builder._review_package(candidate_id, duplicate_limit)
        fingerprint = package_fingerprint(package)
        review_status = self.review.status(candidate_id, "editorial", package)
        review_current = bool(
            latest_submission
            and review_status.get("status") == "awaiting_human_review"
            and review_status.get("stale") is not True
        )

        clearance = None
        if review_current and latest_submission:
            try:
                clearance = self.releases.require_current(candidate_id, latest_submission, fingerprint)
            except QuestionIntelligenceError:
                clearance = None

        creative_summary = {
            "clearance_current": clearance is not None,
            "guides": 0,
            "scripts": 0,
            "storyboards": 0,
            "generation_requests": 0,
            "staging_assets": 0,
            "staged": False,
        }
        if clearance is not None:
            bundle = self.creative.bundle(candidate_id, "creative", clearance)
            guides = self._current_rows(bundle.get("guide_candidates") or [])
            scripts = self._current_rows(bundle.get("doodle_script_candidates") or [])
            boards = self._current_rows(bundle.get("storyboard_candidates") or [])
            requests = self._current_rows(bundle.get("generation_requests") or [])
            assets = self._current_rows(bundle.get("staging_assets") or [])
            creative_summary.update({
                "guides": len(guides),
                "scripts": len(scripts),
                "storyboards": len(boards),
                "generation_requests": len(requests),
                "staging_assets": len(assets),
                "staged": bool(guides and scripts and boards and requests),
            })

        relationships = self.host.list_host_relationships(
            candidate_id, "editorial", fingerprint
        ).get("relationships", [])
        embeds = self.host.list_embeds(candidate_id, "editorial", fingerprint).get("embeds", [])
        current_relationships = self._current_rows(relationships)
        current_embeds = self._current_rows(embeds)

        return {
            "candidate_id": candidate_id,
            "candidate_question_changed_since_run_start": question_changed,
            "research": {
                "classification_present": classification is not None,
                "source_count": len(sources),
                "answer_count": len(answers),
                "eligible_for_editorial_review": bool(readiness.get("eligible_for_editorial_review")),
                "checks": readiness.get("checks") or [],
            },
            "editorial_review": {
                "submitted": latest_submission is not None,
                "current": review_current,
                "stale": bool(review_status.get("stale")),
                "review_submission_id": (latest_submission or {}).get("review_submission_id"),
                "human_review_required": True,
            },
            "creative": creative_summary,
            "host_embed": {
                "current_relationship_count": len(current_relationships),
                "current_embed_count": len(current_embeds),
                "relationship_ready": bool(current_relationships),
                "embed_ready": bool(current_embeds),
            },
            "review_package_fingerprint": fingerprint,
        }

    @staticmethod
    def _research_action(snapshot: dict[str, Any]) -> dict[str, Any] | None:
        research = snapshot["research"]
        if not research["classification_present"]:
            return {
                "kind": "tool", "required_profile": "research",
                "tool": "curiosity_classify_candidate",
                "reason": "classification is missing",
            }
        checks = {str(item.get("check")): bool(item.get("pass")) for item in research.get("checks") or []}
        if not checks.get("at_least_one_source", False):
            return {
                "kind": "tool", "required_profile": "research",
                "tool": "research_add_source_candidate",
                "reason": "recorded research source is missing",
            }
        if not checks.get("answer_present", False) or not checks.get("answer_cites_known_sources", False):
            return {
                "kind": "tool", "required_profile": "research",
                "tool": "answer_create_candidate",
                "reason": "a source-linked answer candidate is missing or incomplete",
            }
        if not research["eligible_for_editorial_review"]:
            if not checks.get("high_sensitivity_two_sources", True) or not checks.get("high_sensitivity_strong_source", True):
                return {
                    "kind": "tool", "required_profile": "research",
                    "tool": "research_add_source_candidate",
                    "reason": "high-sensitivity evidence gate is not satisfied",
                }
            return {
                "kind": "tool", "required_profile": "research",
                "tool": "answer_run_checks",
                "reason": "research readiness still has an unresolved deterministic gate",
            }
        return None

    def _next_action(self, run: dict[str, Any], snapshot: dict[str, Any]) -> dict[str, Any]:
        template = str(run.get("template_id") or "")
        if snapshot["candidate_question_changed_since_run_start"]:
            return {
                "kind": "human_gate", "required_profile": "operator",
                "tool": None, "reason": "candidate question changed after orchestration start",
                "gate": "restart_orchestration_run",
            }

        research_action = self._research_action(snapshot)
        if research_action:
            return research_action

        review = snapshot["editorial_review"]
        if not review["current"]:
            return {
                "kind": "tool", "required_profile": "editorial",
                "tool": "editorial_submit_for_review",
                "reason": "current research package has not been handed to human editorial review",
            }

        if template == "research-review":
            return {
                "kind": "human_gate", "required_profile": "human_editorial",
                "tool": None, "gate": "human_editorial_review",
                "reason": "controlled orchestration stops after the current human-review handoff",
                "terminal_for_template": True,
            }

        if template in {"creative-answer", "full-curiosity"}:
            creative = snapshot["creative"]
            if not creative["clearance_current"]:
                return {
                    "kind": "human_gate", "required_profile": "human_admin",
                    "tool": None, "gate": "creative_clearance",
                    "reason": "Creative cannot derive assets until the root-owned human clearance exists",
                }
            if creative["guides"] < 1:
                return {"kind": "tool", "required_profile": "creative", "tool": "creative_guide_propose", "reason": "Answer Guide proposal is missing"}
            if creative["scripts"] < 1:
                return {"kind": "tool", "required_profile": "creative", "tool": "creative_doodle_script_create_candidate", "reason": "doodle-script candidate is missing"}
            if creative["storyboards"] < 1:
                return {"kind": "tool", "required_profile": "creative", "tool": "creative_storyboard_create_candidate", "reason": "storyboard candidate is missing"}
            if creative["generation_requests"] < 1:
                return {"kind": "tool", "required_profile": "creative", "tool": "creative_lab_request_generation", "reason": "Creative Lab staging request is missing"}
            if template == "creative-answer":
                return {
                    "kind": "human_gate", "required_profile": "human_release",
                    "tool": None, "gate": "human_release_review",
                    "reason": "creative answer staging is complete; no publication action exists",
                    "terminal_for_template": True,
                }

        if template in {"host-embed", "full-curiosity"}:
            host = snapshot["host_embed"]
            if not host["relationship_ready"]:
                return {
                    "kind": "tool", "required_profile": "editorial",
                    "tool": "host_relationship_create_candidate",
                    "reason": "current host relationship candidate is missing",
                }
            if not host["embed_ready"]:
                required_profile = (
                    "editorial_or_creative"
                    if snapshot["creative"]["clearance_current"]
                    else "editorial"
                )
                return {
                    "kind": "tool", "required_profile": required_profile,
                    "tool": "embed_create_candidate",
                    "reason": "current native embed candidate is missing",
                }
            return {
                "kind": "human_gate", "required_profile": "human_release",
                "tool": None, "gate": "human_release_review",
                "reason": "all requested staging outputs exist; activation/publication remains external",
                "terminal_for_template": True,
            }

        raise QuestionIntelligenceError("orchestration template is invalid")

    def status(self, orchestration_run_id: str) -> dict[str, Any]:
        run = self.orchestration.read(orchestration_run_id, self.role)
        snapshot = self._snapshot(run)
        next_action = self._next_action(run, snapshot)
        return {
            "orchestration_run": run,
            "snapshot": snapshot,
            "next_action": next_action,
            "auto_execution": False,
            "cross_role_execution": False,
            "human_gates_bypassable": False,
            "canonicalization_authority": False,
            "publication_authority": False,
            "trust": "deterministic coordination status only; Phase 4G never invokes the suggested domain tool",
        }

    def next_action(self, orchestration_run_id: str) -> dict[str, Any]:
        status = self.status(orchestration_run_id)
        return {
            "orchestration_run_id": orchestration_run_id,
            "candidate_id": status["orchestration_run"]["candidate_id"],
            "template_id": status["orchestration_run"]["template_id"],
            "next_action": status["next_action"],
            "caller_profile": self.role,
            "caller_can_execute_suggested_action": (
                status["next_action"].get("required_profile") == self.role
                or (
                    status["next_action"].get("required_profile") == "editorial_or_creative"
                    and self.role in {"editorial", "creative"}
                )
            ),
            "auto_execution": False,
            "publication_authority": False,
        }


def create_server():
    role = base._normalize_profile_role(os.environ.get(base.PROFILE_ROLE_ENV, "reader"))
    server = p4f.create_server()
    if role not in PHASE4G_ROLES:
        return server

    required = {
        "orchestration": os.environ.get(ORCHESTRATION_ROOT_ENV, "").strip(),
        "candidate": os.environ.get(base.CANDIDATE_ROOT_ENV, "").strip(),
        "research": os.environ.get(p4c.RESEARCH_ROOT_ENV, "").strip(),
        "review": os.environ.get(p4d.REVIEW_ROOT_ENV, "").strip(),
        "creative": os.environ.get(p4e.CREATIVE_ROOT_ENV, "").strip(),
        "release": os.environ.get(p4e.CREATIVE_RELEASE_ROOT_ENV, "").strip(),
        "assets": os.environ.get(p4e.CREATIVE_ASSET_ROOT_ENV, "").strip(),
        "host": os.environ.get(p4f.HOST_EMBED_ROOT_ENV, "").strip(),
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise QuestionIntelligenceError("Phase 4G profile is missing roots: " + ", ".join(missing))

    canonical = base.CuriosityStore.from_env()
    candidates = base.CandidateStore(required["candidate"])
    research = ResearchWorkspace(required["research"])
    review = EditorialReviewWorkspace(required["review"], candidates, canonical)
    assets = CreativeAssetStore(required["assets"])
    service = Phase4GService(
        canonical, candidates, research, review,
        CreativeReleaseStore(required["release"]),
        CreativeAnswerWorkspace(required["creative"], assets),
        HostEmbedWorkspace(required["host"]),
        OrchestrationWorkspace(required["orchestration"]), role,
    )

    @server.tool()
    def orchestration_template_list() -> str:
        """List controlled orchestration templates. Templates never execute domain actions automatically."""
        return json.dumps(service.templates(), ensure_ascii=False)

    @server.tool()
    def orchestration_run_list(candidate_id: str = "") -> str:
        """List immutable Phase 4G run intents, optionally for one Curiosity candidate."""
        return json.dumps(service.list_runs(candidate_id), ensure_ascii=False)

    @server.tool()
    def orchestration_run_status(orchestration_run_id: str) -> str:
        """Derive current cross-stage status from candidate artifacts without executing any next step."""
        return json.dumps(service.status(orchestration_run_id), ensure_ascii=False)

    @server.tool()
    def orchestration_next_action(orchestration_run_id: str) -> str:
        """Return one deterministic next action or human gate; never invokes the suggested tool."""
        return json.dumps(service.next_action(orchestration_run_id), ensure_ascii=False)

    if role == "operator":
        @server.tool()
        def orchestration_run_create(candidate_id: str, template_id: str) -> str:
            """Create an immutable control-plane run intent for an existing Curiosity candidate only."""
            return json.dumps(service.create_run(candidate_id, template_id), ensure_ascii=False)

    return server


def main() -> int:
    try:
        asyncio.run(create_server().run_stdio_async())
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as exc:
        print(f"joko-phase4g-mcp: {exc}", file=os.sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
