from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from joko_agent_mcp import CuriosityStore
from joko_agent_mcp_phase4c import Phase4CService, phase4c_capability_names
from joko_question_intelligence import QuestionIntelligenceError
from joko_research_workspace import ResearchWorkspace

CID = "cur-20260915T010000Z-deadbeef"
OTHER = "cur-20260915T010001Z-cafebabe"


class FakeCanonical:
    @staticmethod
    def _title(text, fallback):
        for line in text.splitlines():
            if line.startswith("# "):
                return line[2:].strip()
        return fallback

    def _iter_markdown(self, scope="all"):
        rows = [
            ("shared/flaky.md", "shared", "Why are croissants flaky?"),
            ("hosts/joko-today/pickup.md", "joko", "Why does JOKO use pickup cutoffs?"),
        ]
        for rel, item_scope, title in rows:
            if scope != "all" and item_scope != scope:
                continue
            tmp = Path(tempfile.gettempdir()) / ("joko-test-" + rel.replace("/", "-"))
            tmp.write_text(f"# {title}\n", encoding="utf-8")
            yield tmp, rel, item_scope


class FakeCandidates:
    def __init__(self):
        self.rows = {
            CID: {"scope": "shared", "question": "What makes croissant layers flaky?", "origin": "user_question"},
            OTHER: {"scope": "shared", "question": "Why is laminated pastry flaky?", "origin": "editorial_prompt"},
        }

    def read(self, candidate_id):
        row = self.rows[candidate_id]
        return {"content": f"# Candidate\n\n## Proposed question\n\n{row['question']}\n\n## Provenance notes\n\nNone\n"}

    def list_candidates(self, scope="all", limit=200):
        rows = []
        for cid, row in self.rows.items():
            if scope != "all" and row["scope"] != scope:
                continue
            rows.append({"candidate_id": cid, "requested_scope": row["scope"]})
        return {"candidates": rows[:limit]}

    def create(self, profile_role, question, requested_scope, origin_type, provenance_notes="", host=""):
        cid = f"cur-20260915T020000Z-{len(self.rows):08x}"
        self.rows[cid] = {"scope": requested_scope, "question": question, "origin": origin_type}
        return {"candidate_id": cid, "origin_type": origin_type, "requested_scope": requested_scope}


class Phase4CMcpTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.candidates = FakeCandidates()
        self.workspace = ResearchWorkspace(Path(self.tmp.name))

    def tearDown(self):
        self.tmp.cleanup()

    def service(self, role="research"):
        return Phase4CService(FakeCanonical(), self.candidates, self.workspace, role)

    def test_capability_matrix(self):
        self.assertEqual(len(phase4c_capability_names("editorial")), 5)
        self.assertEqual(len(phase4c_capability_names("research")), 8)
        self.assertEqual(phase4c_capability_names("creative"), ())
        self.assertEqual(phase4c_capability_names("operator"), ())

    def test_spark_creates_true_provenance_candidates(self):
        result = self.service("editorial").spark_create(
            ["Why do croissant crumbs scatter so far?"], "never_asked", "shared"
        )
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["candidates"][0]["origin_type"], "spark_discovery")

    def test_duplicate_check_is_advisory(self):
        result = self.service().duplicate_check(CID, "shared")
        self.assertTrue(result["possible_matches"])
        self.assertIn("never auto-merge", result["authority"])

    def test_duplicate_check_scans_beyond_200_canonical_episodes(self):
        with tempfile.TemporaryDirectory() as root:
            shared = Path(root) / "shared"
            shared.mkdir()
            for i in range(200):
                (shared / f"a-{i:03d}.md").write_text(f"# Unrelated question {i}?\n", encoding="utf-8")
            (shared / "z-duplicate.md").write_text("# What makes croissant layers flaky?\n", encoding="utf-8")
            service = Phase4CService(CuriosityStore(root), self.candidates, self.workspace, "research")
            result = service.duplicate_check(CID, "shared")
            ids = {row["id"] for row in result["possible_matches"]}
            self.assertIn("shared/z-duplicate.md", ids)

    def test_research_workflow_reaches_editorial_gate(self):
        service = self.service()
        service.classify(CID, "shared", "baking")
        src = service.add_source(CID, "https://example.org/lamination", "Lamination")
        service.create_answer(CID, "Butter layers separate.", "Steam separates laminated layers.", [src["source_id"]])
        result = service.readiness(CID)
        self.assertTrue(result["eligible_for_editorial_review"])
        self.assertTrue(result["requires_human_review"])

    def test_editorial_cannot_write_research(self):
        with self.assertRaises(QuestionIntelligenceError):
            self.service("editorial").classify(CID, "shared", "baking")

    def test_nonexistent_candidate_cannot_receive_research_artifacts(self):
        with self.assertRaises(Exception):
            self.service().classify("cur-20260915T010099Z-aaaaaaaa", "shared", "baking")


if __name__ == "__main__":
    unittest.main()
