from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import joko_agent_mcp as base
from joko_agent_mcp_phase4d import Phase4DService
from joko_agent_mcp_phase4e import Phase4EService
from joko_agent_mcp_phase4f import Phase4FService
from joko_agent_mcp_phase4g import Phase4GService, phase4g_capability_names
from joko_creative_answer_workspace import (
    CreativeAnswerWorkspace, CreativeAssetStore, CreativeReleaseStore, create_clearance_receipt,
)
from joko_editorial_review import EditorialReviewWorkspace
from joko_host_embed_workspace import HostEmbedWorkspace
from joko_orchestration_workspace import OrchestrationWorkspace
from joko_question_intelligence import QuestionIntelligenceError
from joko_research_workspace import ResearchWorkspace


class Phase4GOrchestrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.canonical_root = root / "canonical"
        self.candidate_root = root / "candidates"
        self.research_root = root / "research"
        self.review_root = root / "review"
        self.release_root = root / "release"
        self.creative_root = root / "creative"
        self.asset_root = root / "assets"
        self.host_root = root / "host"
        self.orch_root = root / "orchestration"
        for path in (
            self.canonical_root / "shared", self.candidate_root, self.research_root,
            self.review_root, self.release_root, self.creative_root, self.asset_root,
            self.host_root, self.orch_root,
        ):
            path.mkdir(parents=True, exist_ok=True)
        (self.orch_root / "runs").mkdir()
        (self.canonical_root / "shared" / "existing.md").write_text(
            "# Why do croissants have layers?\n", encoding="utf-8"
        )
        self.canonical = base.CuriosityStore(self.canonical_root)
        self.candidates = base.CandidateStore(self.candidate_root)
        self.research = ResearchWorkspace(self.research_root)
        self.review = EditorialReviewWorkspace(self.review_root, self.candidates, self.canonical)
        self.releases = CreativeReleaseStore(self.release_root)
        self.creative = CreativeAnswerWorkspace(self.creative_root, CreativeAssetStore(self.asset_root))
        self.host = HostEmbedWorkspace(self.host_root)
        self.orchestration = OrchestrationWorkspace(self.orch_root)
        created = self.candidates.create(
            profile_role="research",
            question="Why does laminated dough rise into separate layers?",
            requested_scope="shared",
            origin_type="research_discovery",
        )
        self.cid = created["candidate_id"]
        self.source = None
        self.submission = None

    def tearDown(self):
        self.tmp.cleanup()

    def service(self, role: str = "operator") -> Phase4GService:
        return Phase4GService(
            self.canonical, self.candidates, self.research, self.review,
            self.releases, self.creative, self.host, self.orchestration, role,
        )

    def make_research_ready(self):
        self.research.save_classification(self.cid, "research", "shared", "baking science")
        self.source = self.research.add_source(
            self.cid, "research", "https://example.org/layers", "Lamination mechanics",
            source_type="reputable_secondary",
        )
        self.research.create_answer(
            self.cid, "research", "Steam and fat layers help separate the dough.",
            "Laminated dough separates because thin fat layers and steam create separation during baking.",
            [self.source["source_id"]],
        )

    def submit_review(self):
        self.submission = Phase4DService(
            self.canonical, self.candidates, self.research, self.review, "editorial"
        ).submit_for_review(self.cid, "Ready for human review")
        return self.submission

    def clear_creative(self):
        return create_clearance_receipt(
            self.release_root, self.cid, self.submission,
            "human-admin:test", "Cleared for controlled creative staging",
        )

    def build_creative(self):
        self.clear_creative()
        service = Phase4EService(
            self.canonical, self.candidates, self.research, self.review,
            self.releases, self.creative, "creative",
        )
        guide = service.propose_guide(
            self.cid, "jokomi", "Jokomi", "jokomi-master-v1", "first_person_inner"
        )
        beats = json.dumps([
            {
                "seconds": 10, "claim_type": "factual_explanation",
                "visual": "Layers open", "narration": "Steam separates the layers.",
                "on_screen_text": "Layers", "source_ids": [self.source["source_id"]],
            },
            {
                "seconds": 10, "claim_type": "visual_only",
                "visual": "Jokomi watches", "narration": "", "on_screen_text": "", "source_ids": [],
            },
        ])
        script = service.create_script(
            self.cid, guide["guide_proposal_id"], 20, beats,
            "Two-beat accessible explanation of laminated dough layers.",
        )
        board = service.create_storyboard(
            self.cid, script["doodle_script_id"],
            json.dumps([
                {"beat": 1, "shot": "Close-up", "action": "Layers open"},
                {"beat": 2, "shot": "Wide", "action": "Jokomi watches"},
            ]),
            "Two panel storyboard.",
        )
        service.request_generation(self.cid, board["storyboard_id"], "doodle_keyframes", 1)

    def build_host_embed(self):
        service = Phase4FService(
            self.canonical, self.candidates, self.research, self.review,
            self.host, "editorial",
        )
        rel = service.create_host_relationship(
            self.cid, "joko-today", "page", "homepage", "featured_on",
            "Homepage", "/", "Featured Curiosity",
        )
        service.create_embed(
            self.cid, rel["host_relationship_id"], "homepage-feature",
            "", "en", "paper", "Open notebook", "/notebook",
        )

    def test_capability_matrix(self):
        self.assertEqual(len(phase4g_capability_names("editorial")), 4)
        self.assertEqual(len(phase4g_capability_names("research")), 4)
        self.assertEqual(len(phase4g_capability_names("creative")), 4)
        self.assertEqual(len(phase4g_capability_names("operator")), 5)
        joined = " ".join(phase4g_capability_names("operator"))
        for forbidden in ("publish", "approve", "promote", "canonicalize", "execute"):
            self.assertNotIn(forbidden, joined)

    def test_templates_are_non_autonomous(self):
        result = self.service().templates()
        self.assertEqual(len(result["templates"]), 4)
        self.assertFalse(result["auto_execution"])
        self.assertFalse(result["cross_role_execution"])
        self.assertFalse(result["publication_authority"])

    def test_only_operator_creates_runs_and_duplicate_is_rejected(self):
        with self.assertRaises(QuestionIntelligenceError):
            self.service("editorial").create_run(self.cid, "full-curiosity")
        created = self.service().create_run(self.cid, "full-curiosity")
        self.assertFalse(created["auto_execution"])
        with self.assertRaises(QuestionIntelligenceError):
            self.service().create_run(self.cid, "full-curiosity")

    def test_initial_next_action_is_research_classification(self):
        run = self.service().create_run(self.cid, "full-curiosity")
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["required_profile"], "research")
        self.assertEqual(action["tool"], "curiosity_classify_candidate")

    def test_research_progression_reaches_editorial_handoff(self):
        run = self.service().create_run(self.cid, "research-review")
        self.research.save_classification(self.cid, "research", "shared", "baking")
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["tool"], "research_add_source_candidate")
        self.source = self.research.add_source(
            self.cid, "research", "https://example.org/source", "Source", source_type="reputable_secondary"
        )
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["tool"], "answer_create_candidate")
        self.research.create_answer(self.cid, "research", "Answer", "Full answer", [self.source["source_id"]])
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["tool"], "editorial_submit_for_review")
        self.submit_review()
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["gate"], "human_editorial_review")
        self.assertTrue(action["terminal_for_template"])

    def test_creative_answer_waits_for_human_clearance(self):
        self.make_research_ready(); self.submit_review()
        run = self.service().create_run(self.cid, "creative-answer")
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["gate"], "creative_clearance")
        self.assertEqual(action["required_profile"], "human_admin")

    def test_creative_answer_progression_stops_at_human_release(self):
        self.make_research_ready(); self.submit_review(); self.clear_creative()
        run = self.service().create_run(self.cid, "creative-answer")
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["tool"], "creative_guide_propose")
        self.build_creative_without_new_clearance()
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["gate"], "human_release_review")
        self.assertTrue(action["terminal_for_template"])

    def build_creative_without_new_clearance(self):
        service = Phase4EService(
            self.canonical, self.candidates, self.research, self.review,
            self.releases, self.creative, "creative",
        )
        guide = service.propose_guide(self.cid, "jokomi", "Jokomi", "jokomi-master-v1", "silent")
        beats = json.dumps([
            {
                "seconds": 10, "claim_type": "factual_explanation", "visual": "Layers",
                "narration": "", "on_screen_text": "Layers", "source_ids": [self.source["source_id"]],
            },
            {
                "seconds": 10, "claim_type": "visual_only", "visual": "Jokomi observes",
                "narration": "", "on_screen_text": "", "source_ids": [],
            },
        ])
        script = service.create_script(self.cid, guide["guide_proposal_id"], 20, beats, "Layer explanation")
        board = service.create_storyboard(
            self.cid, script["doodle_script_id"],
            json.dumps([{"beat": 1, "shot": "Close", "action": "Layers open"}]),
            "Single panel storyboard",
        )
        service.request_generation(self.cid, board["storyboard_id"], "doodle_keyframes", 1)

    def test_uncleared_host_embed_handoff_keeps_embed_creation_editorial_only(self):
        self.make_research_ready(); self.submit_review()
        run = self.service().create_run(self.cid, "host-embed")
        service = Phase4FService(
            self.canonical, self.candidates, self.research, self.review,
            self.host, "editorial",
        )
        service.create_host_relationship(
            self.cid, "joko-today", "page", "homepage", "featured_on",
            "Homepage", "/", "Featured Curiosity",
        )
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["tool"], "embed_create_candidate")
        self.assertEqual(action["required_profile"], "editorial")
        creative_view = self.service("creative").next_action(run["orchestration_run_id"])
        self.assertFalse(creative_view["caller_can_execute_suggested_action"])

    def test_host_embed_progression_stops_before_activation(self):
        self.make_research_ready(); self.submit_review()
        run = self.service().create_run(self.cid, "host-embed")
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["tool"], "host_relationship_create_candidate")
        self.build_host_embed()
        status = self.service().status(run["orchestration_run_id"])
        self.assertTrue(status["snapshot"]["host_embed"]["embed_ready"])
        self.assertEqual(status["next_action"]["gate"], "human_release_review")
        self.assertFalse(status["publication_authority"])

    def test_full_flow_requires_both_creative_and_embed_staging(self):
        self.make_research_ready(); self.submit_review(); self.clear_creative()
        run = self.service().create_run(self.cid, "full-curiosity")
        self.build_creative_without_new_clearance()
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["tool"], "host_relationship_create_candidate")
        self.build_host_embed()
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["gate"], "human_release_review")

    def test_new_answer_stales_review_and_routes_back_to_editorial(self):
        self.make_research_ready(); self.submit_review()
        run = self.service().create_run(self.cid, "host-embed")
        self.research.create_answer(
            self.cid, "research", "Updated", "Updated answer", [self.source["source_id"]]
        )
        status = self.service().status(run["orchestration_run_id"])
        self.assertTrue(status["snapshot"]["editorial_review"]["stale"])
        self.assertEqual(status["next_action"]["tool"], "editorial_submit_for_review")

    def test_question_change_requires_new_run_instead_of_silent_progress(self):
        run = self.service().create_run(self.cid, "research-review")
        path = self.candidate_root / f"{self.cid}.md"
        text = path.read_text(encoding="utf-8")
        path.write_text(text.replace(
            "Why does laminated dough rise into separate layers?",
            "Why does laminated dough rise into many separate layers?",
        ), encoding="utf-8")
        action = self.service().next_action(run["orchestration_run_id"])["next_action"]
        self.assertEqual(action["gate"], "restart_orchestration_run")
        replacement = self.service().create_run(self.cid, "research-review")
        self.assertNotEqual(replacement["orchestration_run_id"], run["orchestration_run_id"])


    def test_runs_directory_symlink_substitution_is_rejected(self):
        service = self.service()
        real_runs = self.orch_root / "runs-real"
        real_runs.mkdir()
        (self.orch_root / "runs").rmdir()
        (self.orch_root / "runs").symlink_to(real_runs, target_is_directory=True)
        with self.assertRaises(QuestionIntelligenceError):
            service.list_runs()

    def test_operator_never_executes_suggested_domain_action(self):
        run = self.service().create_run(self.cid, "full-curiosity")
        result = self.service().next_action(run["orchestration_run_id"])
        self.assertFalse(result["caller_can_execute_suggested_action"])
        self.assertFalse(result["auto_execution"])
        self.assertFalse(result["publication_authority"])


if __name__ == "__main__":
    unittest.main()
