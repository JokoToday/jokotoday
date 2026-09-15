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
        return {
            "metadata": {"candidate_id": candidate_id, "requested_scope": row["scope"]},
            "content": f"# Candidate\n\n## Proposed question\n\n{row['question']}\n\n## Provenance notes\n\nNone\n",
        }

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
        self.assertEqual(len(phase4c_capability_names("editorial")), 9)
        self.assertEqual(len(phase4c_capability_names("research")), 12)
        self.assertEqual(phase4c_capability_names("creative"), ())
        self.assertEqual(phase4c_capability_names("operator"), ())

    def test_spark_creates_true_provenance_candidates(self):
        result = self.service("editorial").spark_create(
            ["Why do croissant crumbs scatter so far?"], "never_asked", "shared"
        )
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["candidates"][0]["origin_type"], "spark_discovery")

    def test_source_grounded_spark_preserves_pack_trigger_and_source_provenance(self):
        service = self.service("editorial")
        pack = service.source_pack_create([
            {
                "kind": "paper",
                "title": "Lamination mechanics",
                "url": "https://example.org/lamination",
                "excerpt": "Butter that is too cold can fracture while warm butter may smear.",
            },
            {
                "kind": "interview",
                "title": "Baker interview",
                "excerpt": "The baker watches whether dough and butter bend together.",
            },
        ], topic="croissant lamination")
        brief = service.source_brief(pack["source_pack_id"], "challenge_assumptions", 4)
        self.assertEqual(brief["mode"], "source_grounded")
        result = service.source_spark_create(pack["source_pack_id"], [{
            "question": "Can butter actually be too cold for croissants?",
            "trigger_type": "boundary",
            "source_refs": ["source-01", "source-02"],
            "rationale": "Both sources point to a workable range rather than one simple cold rule.",
            "why_interesting": "It challenges an oversimplified instruction.",
        }], "challenge_assumptions", "shared")
        self.assertEqual(result["count"], 1)
        cid = result["candidates"][0]["candidate_id"]
        self.assertEqual(self.candidates.rows[cid]["origin"], "spark_discovery")
        grounding = service.source_grounding(cid)
        self.assertEqual(grounding["source_pack_id"], pack["source_pack_id"])
        self.assertEqual(grounding["trigger_type"], "boundary")
        self.assertEqual(grounding["source_refs"], ["source-01", "source-02"])

    def test_source_grounded_spark_rejects_unknown_source_reference(self):
        service = self.service("research")
        pack = service.source_pack_create([{
            "kind": "article",
            "title": "Bread",
            "excerpt": "Warm bread releases more volatile aroma compounds into the air.",
        }])
        with self.assertRaises(QuestionIntelligenceError):
            service.source_spark_create(pack["source_pack_id"], [{
                "question": "Why does warm bread smell stronger?",
                "trigger_type": "causal_mechanism",
                "source_refs": ["source-99"],
                "rationale": "A mechanism is described.",
                "why_interesting": "A familiar experience has a hidden cause.",
            }], "explain", "shared")

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

    def test_duplicate_check_scans_beyond_200_candidate_files(self):
        with tempfile.TemporaryDirectory() as root:
            rooted = FakeCandidates()
            rooted.root = Path(root)
            # Make >200 candidate files. The final one is an exact duplicate of CID.
            for i in range(205):
                cid = f"cur-20260915T030000Z-{i:08x}"
                question = f"Unrelated candidate question {i}?"
                if i == 204:
                    question = "What makes croissant layers flaky?"
                rooted.rows[cid] = {"scope": "shared", "question": question, "origin": "editorial_prompt"}
                (rooted.root / f"{cid}.md").touch()
            service = Phase4CService(FakeCanonical(), rooted, self.workspace, "research")
            result = service.duplicate_check(CID, "shared")
            ids = {row["id"] for row in result["possible_matches"]}
            self.assertIn("cur-20260915T030000Z-000000cc", ids)

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
