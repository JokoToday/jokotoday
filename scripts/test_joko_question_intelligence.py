from __future__ import annotations
import tempfile
import unittest
from pathlib import Path

from joko_question_intelligence import (
    QuestionIntelligenceError, build_spark_brief, possible_duplicate_score,
    rank_possible_duplicates, validate_spark_questions,
)
from joko_research_workspace import ResearchWorkspace

CID = "cur-20260915T000000Z-deadbeef"


class Phase4CTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.ws = ResearchWorkspace(Path(self.tmp.name))

    def tearDown(self):
        self.tmp.cleanup()

    def test_duplicate_signal_is_advisory(self):
        self.assertGreater(
            possible_duplicate_score("Why are croissants flaky?", "What makes croissant layers flaky?"),
            possible_duplicate_score("Why are croissants flaky?", "When should I water basil?"),
        )
        ranked = rank_possible_duplicates("Why are croissants flaky?", [
            {"id": "a", "kind": "reviewed", "question": "What makes croissant layers flaky?"},
            {"id": "b", "kind": "candidate", "question": "When should I water basil?"},
        ])
        self.assertEqual(ranked[0]["id"], "a")

    def test_spark_contract_is_questions_only(self):
        brief = build_spark_brief("never_asked", topic="bread", count=6)
        self.assertEqual(brief["role"], "SPARK")
        self.assertTrue(any(rule.startswith("Return questions only") for rule in brief["rules"]))
        output = validate_spark_questions([
            "Why does stale bread sometimes toast better?",
            "Why do bread bags have tiny holes?",
        ], mode="never_asked")
        self.assertEqual(output[0]["origin_type"], "spark_discovery")
        self.assertIn("not factual authority", output[0]["trust"])

    def test_spark_rejects_duplicates(self):
        with self.assertRaises(QuestionIntelligenceError):
            validate_spark_questions(["Why bread?", "Why bread ?"], mode="childlike")

    def test_scope_classification_and_high_risk_escalation(self):
        with self.assertRaises(QuestionIntelligenceError):
            self.ws.save_classification(CID, "research", "joko", "operations")
        result = self.ws.save_classification(CID, "research", "shared", "allergens")
        self.assertEqual(result["sensitivity"], "high")
        food_safety = self.ws.save_classification(CID, "research", "shared", "Food Safety", "normal")
        self.assertEqual(food_safety["sensitivity"], "high")
        nutrition = self.ws.save_classification(CID, "research", "shared", "nutrition claims", "elevated")
        self.assertEqual(nutrition["sensitivity"], "high")

    def test_only_research_can_write(self):
        with self.assertRaises(QuestionIntelligenceError):
            self.ws.save_classification(CID, "editorial", "shared", "bread")

    def test_source_must_be_http(self):
        self.ws.save_classification(CID, "research", "shared", "bread")
        with self.assertRaises(QuestionIntelligenceError):
            self.ws.add_source(CID, "research", "file:///etc/passwd", "bad")

    def test_answer_requires_known_sources(self):
        self.ws.save_classification(CID, "research", "shared", "bread")
        with self.assertRaises(QuestionIntelligenceError):
            self.ws.create_answer(CID, "research", "A", "B", ["src-20260915T000000Z-deadbeef"])

    def test_normal_readiness_passes_but_never_approves(self):
        self.ws.save_classification(CID, "research", "shared", "bread")
        src = self.ws.add_source(CID, "research", "https://example.org/bread", "Bread source")
        self.ws.create_answer(CID, "research", "Short", "Full", [src["source_id"]])
        result = self.ws.readiness(CID, "editorial")
        self.assertTrue(result["eligible_for_editorial_review"])
        self.assertTrue(result["requires_human_review"])

    def test_high_sensitivity_requires_two_and_strong_source(self):
        self.ws.save_classification(CID, "research", "shared", "food_safety", "high")
        src = self.ws.add_source(CID, "research", "https://example.org/article", "One source")
        self.ws.create_answer(CID, "research", "Short", "Full", [src["source_id"]])
        result = self.ws.readiness(CID, "editorial")
        self.assertFalse(result["eligible_for_editorial_review"])
        checks = {row["check"]: row["pass"] for row in result["checks"]}
        self.assertFalse(checks["high_sensitivity_two_sources"])
        self.assertFalse(checks["high_sensitivity_strong_source"])

    def test_relative_workspace_root_rejected(self):
        with self.assertRaises(QuestionIntelligenceError):
            ResearchWorkspace("relative/path")


if __name__ == "__main__":
    unittest.main()
