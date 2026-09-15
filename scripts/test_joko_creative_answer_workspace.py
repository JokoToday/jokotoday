from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import joko_agent_mcp as base
from joko_agent_mcp_phase4d import Phase4DService
from joko_agent_mcp_phase4e import Phase4EService, phase4e_capability_names
from joko_creative_answer_workspace import (
    CreativeAnswerWorkspace,
    CreativeAssetStore,
    CreativeReleaseStore,
    create_clearance_receipt,
)
from joko_editorial_review import EditorialReviewWorkspace
from joko_question_intelligence import QuestionIntelligenceError
from joko_research_workspace import ResearchWorkspace


class Phase4ECreativeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.canonical_root = root / "canonical"
        self.candidate_root = root / "candidates"
        self.research_root = root / "research"
        self.review_root = root / "review"
        self.release_root = root / "releases"
        self.creative_root = root / "creative"
        self.asset_root = root / "assets"
        for path in (self.canonical_root / "shared", self.candidate_root, self.research_root,
                     self.review_root, self.release_root, self.creative_root, self.asset_root):
            path.mkdir(parents=True, exist_ok=True)
        (self.canonical_root / "shared" / "lamination.md").write_text(
            "# Why do croissants have layers?\n", encoding="utf-8"
        )
        self.canonical = base.CuriosityStore(self.canonical_root)
        self.candidates = base.CandidateStore(self.candidate_root)
        self.research = ResearchWorkspace(self.research_root)
        self.review = EditorialReviewWorkspace(self.review_root, self.candidates, self.canonical)
        self.assets = CreativeAssetStore(self.asset_root)
        self.creative = CreativeAnswerWorkspace(self.creative_root, self.assets)
        self.releases = CreativeReleaseStore(self.release_root)

        candidate = self.candidates.create(
            profile_role="research",
            question="Why does laminated dough puff into separate layers?",
            requested_scope="shared",
            origin_type="research_discovery",
        )
        self.cid = candidate["candidate_id"]
        self.research.save_classification(self.cid, "research", "shared", "baking")
        self.source = self.research.add_source(
            self.cid, "research", "https://example.org/lamination", "Lamination", source_type="reputable_secondary"
        )
        self.answer = self.research.create_answer(
            self.cid, "research", "Steam separates the layers.",
            "Butter layers and steam help laminated dough separate during baking.", [self.source["source_id"]]
        )
        editorial = Phase4DService(self.canonical, self.candidates, self.research, self.review, "editorial")
        self.submission = editorial.submit_for_review(self.cid, "Ready for human review")

    def tearDown(self):
        self.tmp.cleanup()

    def service(self) -> Phase4EService:
        return Phase4EService(
            self.canonical, self.candidates, self.research, self.review,
            self.releases, self.creative, "creative"
        )

    def clear(self):
        return create_clearance_receipt(
            self.release_root, self.cid, self.submission, "human-admin:test", "Approved for creative drafting"
        )

    def build_creative_chain(self):
        self.clear()
        service = self.service()
        guide = service.propose_guide(
            self.cid, "jokomi", "Jokomi", "jokomi-master-v1", "first_person_inner",
            "Quiet guide for a short explanation",
        )
        beats = json.dumps([
            {
                "seconds": 10, "claim_type": "factual_explanation",
                "visual": "A dough cross-section opens like notebook layers.",
                "narration": "The dough holds thin layers that can separate in the oven.",
                "on_screen_text": "Layers separate", "source_ids": [self.source["source_id"]],
            },
            {
                "seconds": 10, "claim_type": "visual_only",
                "visual": "Jokomi looks at one floating crumb.",
                "narration": "", "on_screen_text": "", "source_ids": [],
            },
        ])
        script = service.create_script(
            self.cid, guide["guide_proposal_id"], 20, beats,
            "A simple two-beat doodle explanation of laminated dough layers, followed by Jokomi observing a crumb.",
        )
        panels = json.dumps([
            {"beat": 1, "shot": "Close cross-section", "action": "Layers open gently", "composition": "Lots of white space"},
            {"beat": 2, "shot": "Full-body Jokomi", "action": "Jokomi watches a crumb", "transition": "Pencil line drift"},
        ])
        board = service.create_storyboard(
            self.cid, script["doodle_script_id"], panels,
            "Two-panel vertical storyboard matching the doodle script.", "living-notebook-v1", "9:16",
        )
        return service, guide, script, board

    def test_capability_matrix(self):
        self.assertEqual(len(phase4e_capability_names("creative")), 6)
        self.assertEqual(phase4e_capability_names("editorial"), ())
        self.assertEqual(phase4e_capability_names("research"), ())
        self.assertEqual(phase4e_capability_names("operator"), ())

    def test_creative_package_requires_human_clearance(self):
        with self.assertRaises(QuestionIntelligenceError):
            self.service().read_review_package(self.cid)
        self.clear()
        result = self.service().read_review_package(self.cid)
        self.assertTrue(result["creative_derivation_only"])
        self.assertFalse(result["publication_authority"])
        self.assertEqual(result["review_submission"]["review_submission_id"], self.submission["review_submission_id"])

    def test_guide_has_no_factual_authority(self):
        self.clear()
        result = self.service().propose_guide(
            self.cid, "jokomi", "Jokomi", "jokomi-master-v1", "silent"
        )
        self.assertFalse(result["factual_authority"])
        self.assertFalse(result["publication_authority"])

    def test_factual_script_beats_must_cite_released_sources(self):
        self.clear()
        service = self.service()
        guide = service.propose_guide(
            self.cid, "jokomi", "Jokomi", "jokomi-master-v1", "first_person_inner"
        )
        bad = json.dumps([{
            "seconds": 20, "claim_type": "factual_explanation", "visual": "Layers", "source_ids": []
        }])
        with self.assertRaises(QuestionIntelligenceError):
            service.create_script(self.cid, guide["guide_proposal_id"], 20, bad, "Accessible explanation")

    def test_storyboard_and_generation_request_are_staging_only(self):
        service, _, _, board = self.build_creative_chain()
        request = service.request_generation(self.cid, board["storyboard_id"], "doodle_keyframes", 2)
        self.assertEqual(request["status"], "queued_for_creative_lab")
        self.assertTrue(request["queue_only"])
        self.assertFalse(request["provider_call_executed"])
        self.assertFalse(request["publication_authority"])

    def test_generation_quota_is_enforced(self):
        service, _, _, board = self.build_creative_chain()
        service.request_generation(self.cid, board["storyboard_id"], "doodle_keyframes", 3)
        service.request_generation(self.cid, board["storyboard_id"], "storyboard_frames", 3)
        with self.assertRaises(QuestionIntelligenceError):
            service.request_generation(self.cid, board["storyboard_id"], "scene_illustration", 1)

    def test_bundle_reads_validated_staging_asset_metadata(self):
        service, _, _, _ = self.build_creative_chain()
        aid = "asset-20260915T090000Z-deadbeef"
        folder = self.asset_root / self.cid
        files = folder / "files"
        files.mkdir(parents=True)
        data = b"phase4e-acceptance-image-fixture"
        (files / "fixture.png").write_bytes(data)
        metadata = {
            "schema_version": 1, "artifact_type": "creative_staging_asset", "asset_id": aid,
            "candidate_id": self.cid, "generation_request_id": "gen-20260915T090000Z-cafebabe",
            "review_package_fingerprint": self.releases.latest(self.cid)["package_fingerprint"],
            "file_name": "fixture.png", "mime_type": "image/png",
            "sha256": hashlib.sha256(data).hexdigest(), "status": "candidate",
            "created_at": "2026-09-15T09:00:00Z", "review_required": True,
        }
        (folder / f"{aid}.json").write_text(json.dumps(metadata), encoding="utf-8")
        bundle = service.bundle(self.cid)
        self.assertEqual(len(bundle["staging_assets"]), 1)
        self.assertTrue(bundle["staging_assets"][0]["content_available"])
        self.assertNotIn("data", bundle["staging_assets"][0])

    def test_clearance_becomes_stale_when_answer_changes(self):
        self.clear()
        self.service().read_review_package(self.cid)
        self.research.create_answer(
            self.cid, "research", "Updated answer.", "Updated full answer.", [self.source["source_id"]]
        )
        with self.assertRaises(QuestionIntelligenceError):
            self.service().read_review_package(self.cid)

    def test_creative_role_remains_read_only_for_research_and_review_authority(self):
        with self.assertRaises(QuestionIntelligenceError):
            self.research.save_classification(self.cid, "creative", "shared", "baking")
        with self.assertRaises(QuestionIntelligenceError):
            self.review.submit(self.cid, "creative", {"candidate_id": self.cid, "readiness": {}})


if __name__ == "__main__":
    unittest.main()
