from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from joko_agent_mcp import CuriosityStore
from joko_agent_mcp_phase4d import Phase4DService, phase4d_capability_names
from joko_editorial_review import EditorialReviewWorkspace
from joko_question_intelligence import QuestionIntelligenceError
from joko_research_workspace import ResearchWorkspace

CID = "cur-20260915T070000Z-deadbeef"
PARENT = "cur-20260915T070001Z-cafebabe"
LOCAL = "cur-20260915T070002Z-acde1234"


class FakeCandidates:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir()
        self.rows = {
            CID: {"scope": "shared", "question": "Why do croissants shatter into crumbs?"},
            PARENT: {"scope": "shared", "question": "Why are croissants flaky?"},
            LOCAL: {"scope": "joko", "question": "Why does JOKO use pickup cutoffs?"},
        }
        for cid in self.rows:
            (self.root / f"{cid}.md").touch()

    def read(self, candidate_id, start_line=1, max_lines=160):
        row = self.rows[candidate_id]
        host = "joko-today" if row["scope"] == "joko" else None
        return {
            "candidate_id": candidate_id,
            "metadata": {
                "schema_version": 1, "candidate_id": candidate_id, "status": "candidate",
                "requested_scope": row["scope"], "origin_type": "editorial_prompt",
                "host": host, "created_by_profile": "editorial",
                "created_at": "2026-09-15T07:00:00Z",
            },
            "content": f"# Candidate\n\n## Proposed question\n\n{row['question']}\n\n## Provenance notes\n\nNone\n",
        }


class Phase4DTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        canonical_root = root / "canonical"
        (canonical_root / "shared").mkdir(parents=True)
        (canonical_root / "hosts" / "joko-today").mkdir(parents=True)
        (canonical_root / "shared" / "layers.md").write_text("# Why are croissants flaky?\n", encoding="utf-8")
        (canonical_root / "hosts" / "joko-today" / "pickup.md").write_text(
            "# Why does JOKO use pickup cutoffs?\n", encoding="utf-8"
        )
        research_root = root / "research"; research_root.mkdir()
        review_root = root / "review"; review_root.mkdir()
        self.candidates = FakeCandidates(root / "candidates")
        self.canonical = CuriosityStore(canonical_root)
        self.research = ResearchWorkspace(research_root)
        self.review = EditorialReviewWorkspace(review_root, self.candidates, self.canonical)

    def tearDown(self):
        self.tmp.cleanup()

    def service(self, role="editorial"):
        return Phase4DService(self.canonical, self.candidates, self.research, self.review, role)

    def make_ready(self):
        self.research.save_classification(CID, "research", "shared", "bread science")
        src = self.research.add_source(
            CID, "research", "https://example.org/layers", "Lamination", source_type="reputable_secondary"
        )
        ans = self.research.create_answer(
            CID, "research", "Layers fracture.", "Dry laminated layers fracture into crisp crumbs.", [src["source_id"]]
        )
        return src, ans

    def test_capability_matrix_and_no_approval_surface(self):
        editorial = phase4d_capability_names("editorial")
        research = phase4d_capability_names("research")
        self.assertEqual(len(editorial), 5)
        self.assertEqual(len(research), 3)
        self.assertEqual(phase4d_capability_names("creative"), ())
        self.assertEqual(phase4d_capability_names("operator"), ())
        joined = " ".join(editorial + research)
        for forbidden in ("approve", "publish", "promote", "canonicalize"):
            self.assertNotIn(forbidden, joined)

    def test_relationship_scope_boundary_and_direction(self):
        ok = self.service().create_relationship(CID, "follow_up", "canonical", "shared/layers.md", "Follow-up")
        self.assertEqual(ok["source_scope"], "shared")
        self.assertEqual(ok["target_scope"], "shared")
        with self.assertRaises(QuestionIntelligenceError):
            self.service().create_relationship(CID, "related", "canonical", "hosts/joko-today/pickup.md")
        local = self.service("research").create_relationship(LOCAL, "related", "canonical", "shared/layers.md")
        self.assertEqual(local["source_scope"], "joko")
        self.assertEqual(local["target_scope"], "shared")

    def test_relationship_self_link_and_duplicate_rejected(self):
        with self.assertRaises(QuestionIntelligenceError):
            self.service().create_relationship(CID, "related", "candidate", CID)
        self.service().create_relationship(CID, "related", "candidate", PARENT)
        with self.assertRaises(QuestionIntelligenceError):
            self.service().create_relationship(CID, "related", "candidate", PARENT)

    def test_prepare_is_non_mutating_and_blocked_candidate_is_visible(self):
        package = self.service().prepare_review(CID)
        self.assertFalse(package["ready_to_submit"])
        self.assertTrue(package["human_review_required"])
        self.assertFalse(package["approval_authority"])
        status = self.service().review_status(CID)
        self.assertEqual(status["status"], "not_submitted")
        with self.assertRaises(QuestionIntelligenceError):
            self.service().submit_for_review(CID)

    def test_only_editorial_can_prepare_or_submit(self):
        self.make_ready()
        with self.assertRaises(QuestionIntelligenceError):
            self.service("research").prepare_review(CID)
        with self.assertRaises(QuestionIntelligenceError):
            self.service("research").submit_for_review(CID)

    def test_submit_is_human_handoff_not_approval_and_is_idempotent(self):
        self.make_ready()
        submission = self.service().submit_for_review(CID, "Please review the answer and sources.")
        self.assertEqual(submission["status"], "awaiting_human_review")
        self.assertTrue(submission["human_review_required"])
        self.assertFalse(submission["approval_authority"])
        self.assertFalse(submission["publication_authority"])
        repeat = self.service().submit_for_review(CID, "Please review the answer and sources.")
        self.assertTrue(repeat["already_submitted"])
        changed_notes = self.service().submit_for_review(CID, "Second human-review note.")
        self.assertNotIn("already_submitted", changed_notes)
        status = self.service().review_status(CID)
        self.assertFalse(status["stale"])
        self.assertEqual(status["submission_count"], 2)

    def test_submission_becomes_stale_when_answer_changes(self):
        src, _ = self.make_ready()
        self.service().submit_for_review(CID)
        self.research.create_answer(
            CID, "research", "Revised.", "A revised answer based on the same recorded source.", [src["source_id"]]
        )
        status = self.service().review_status(CID)
        self.assertTrue(status["stale"])
        self.assertTrue(status["needs_resubmission"])
        self.assertEqual(status["status"], "awaiting_human_review")

    def test_relationships_are_included_in_review_fingerprint(self):
        self.make_ready()
        self.service().submit_for_review(CID)
        self.service().create_relationship(CID, "follow_up", "candidate", PARENT)
        status = self.service().review_status(CID)
        self.assertTrue(status["stale"])


if __name__ == "__main__":
    unittest.main()
