from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from joko_agent_mcp import (
    CandidateStore,
    CuriosityError,
    CuriosityStore,
    capability_names_for_role,
)


class CuriosityStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "shared").mkdir(parents=True)
        (self.root / "hosts" / "joko-today").mkdir(parents=True)
        (self.root / "private").mkdir()

        (self.root / "shared" / "croissants.md").write_text(
            "# Why are croissants flaky?\n\nButter lamination creates layers.\nSecond line.\n",
            encoding="utf-8",
        )
        (self.root / "hosts" / "joko-today" / "pickup.md").write_text(
            "# How does ordering at JOKO work?\n\nChoose, pre-order, pick up, enjoy.\n",
            encoding="utf-8",
        )
        (self.root / "private" / "customer.md").write_text(
            "# Private customer data\n\nNever expose this.\n",
            encoding="utf-8",
        )
        (self.root / "ignore.txt").write_text("not a Curiosity", encoding="utf-8")
        self.store = CuriosityStore(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_list_only_approved_namespaces(self):
        result = self.store.list_episodes()
        paths = [item["path"] for item in result["episodes"]]
        self.assertEqual(paths, ["hosts/joko-today/pickup.md", "shared/croissants.md"])
        self.assertNotIn("private/customer.md", paths)

    def test_scope_filtering(self):
        shared = self.store.list_episodes(scope="shared")
        joko = self.store.list_episodes(scope="joko")
        self.assertEqual([item["scope"] for item in shared["episodes"]], ["shared"])
        self.assertEqual([item["scope"] for item in joko["episodes"]], ["joko"])
        self.assertEqual(shared["episodes"][0]["path"], "shared/croissants.md")
        self.assertEqual(joko["episodes"][0]["path"], "hosts/joko-today/pickup.md")

    def test_search_requires_all_terms_and_reports_scope(self):
        result = self.store.search("butter layers", scope="shared")
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["results"][0]["path"], "shared/croissants.md")
        self.assertEqual(result["results"][0]["scope"], "shared")

    def test_read_is_line_bounded_and_reports_scope(self):
        result = self.store.read("shared/croissants.md", start_line=2, max_lines=2)
        self.assertEqual(result["scope"], "shared")
        self.assertEqual(result["start_line"], 2)
        self.assertEqual(result["end_line"], 3)
        self.assertIn("Butter lamination", result["content"])
        self.assertTrue(result["truncated"])

    def test_rejects_parent_traversal(self):
        with self.assertRaises(CuriosityError):
            self.store.read("../secret.md")

    def test_rejects_non_markdown(self):
        with self.assertRaises(CuriosityError):
            self.store.read("ignore.txt")

    def test_rejects_unapproved_namespace(self):
        with self.assertRaises(CuriosityError):
            self.store.read("private/customer.md")

    def test_rejects_invalid_scope(self):
        with self.assertRaises(CuriosityError):
            self.store.list_episodes(scope="private")

    def test_rejects_symlink(self):
        outside_dir = Path(tempfile.mkdtemp())
        try:
            outside = outside_dir / "outside.md"
            outside.write_text("secret", encoding="utf-8")
            link = self.root / "shared" / "linked.md"
            try:
                link.symlink_to(outside)
            except (OSError, NotImplementedError):
                self.skipTest("symlinks unavailable")
            with self.assertRaises(CuriosityError):
                self.store.read("shared/linked.md")
        finally:
            if outside_dir.exists():
                for child in outside_dir.iterdir():
                    child.unlink()
                outside_dir.rmdir()

    def test_root_must_be_absolute(self):
        with self.assertRaises(CuriosityError):
            CuriosityStore("relative/path")

    def test_from_env_requires_root(self):
        old = os.environ.pop("JOKO_CURIOSITY_ROOT", None)
        try:
            with self.assertRaises(CuriosityError):
                CuriosityStore.from_env()
        finally:
            if old is not None:
                os.environ["JOKO_CURIOSITY_ROOT"] = old


class CandidateStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.store = CandidateStore(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_capability_matrix_is_least_privilege(self):
        self.assertEqual(len(capability_names_for_role("editorial")), 6)
        self.assertEqual(len(capability_names_for_role("research")), 6)
        self.assertEqual(len(capability_names_for_role("creative")), 3)
        self.assertEqual(len(capability_names_for_role("operator")), 3)
        self.assertNotIn("curiosity_create_candidate", capability_names_for_role("creative"))
        self.assertNotIn("curiosity_create_candidate", capability_names_for_role("operator"))

    def test_create_shared_candidate(self):
        result = self.store.create(
            profile_role="editorial",
            question="Why does laminated dough puff?",
            requested_scope="shared",
            origin_type="editorial_prompt",
            provenance_notes="Editorial seed question.",
        )
        self.assertEqual(result["requested_scope"], "shared")
        self.assertIsNone(result["host"])
        self.assertEqual(result["created_by_profile"], "editorial")
        target = self.root / result["path"]
        self.assertTrue(target.is_file())
        self.assertEqual(target.stat().st_mode & 0o777, 0o600)

    def test_create_joko_candidate_requires_explicit_host(self):
        with self.assertRaises(CuriosityError):
            self.store.create(
                profile_role="research",
                question="Why does JOKO use pickup cutoffs?",
                requested_scope="joko",
                origin_type="research_discovery",
            )
        result = self.store.create(
            profile_role="research",
            question="Why does JOKO use pickup cutoffs?",
            requested_scope="joko",
            origin_type="research_discovery",
            host="joko-today",
        )
        self.assertEqual(result["host"], "joko-today")

    def test_shared_candidate_rejects_host_scope_leak(self):
        with self.assertRaises(CuriosityError):
            self.store.create(
                profile_role="editorial",
                question="Why is butter cold for lamination?",
                requested_scope="shared",
                origin_type="editorial_prompt",
                host="joko-today",
            )

    def test_create_rejects_unapproved_profile(self):
        with self.assertRaises(CuriosityError):
            self.store.create(
                profile_role="creative",
                question="Can I make a candidate?",
                requested_scope="shared",
                origin_type="editorial_prompt",
            )
        with self.assertRaises(CuriosityError):
            self.store.create(
                profile_role="operator",
                question="Can I make a candidate?",
                requested_scope="shared",
                origin_type="editorial_prompt",
            )

    def test_create_rejects_invalid_origin_type(self):
        with self.assertRaises(CuriosityError):
            self.store.create(
                profile_role="editorial",
                question="A question",
                requested_scope="shared",
                origin_type="made_up_by_agent",
            )

    def test_candidate_list_and_read_are_explicitly_unreviewed(self):
        shared = self.store.create(
            profile_role="editorial",
            question="Shared question",
            requested_scope="shared",
            origin_type="user_question",
            provenance_notes="Submitted without private identity.",
        )
        self.store.create(
            profile_role="research",
            question="JOKO question",
            requested_scope="joko",
            origin_type="host_observation",
            host="joko-today",
        )
        listing = self.store.list_candidates(scope="shared")
        self.assertEqual(listing["count"], 1)
        self.assertIn("unreviewed", listing["trust"])
        read = self.store.read(shared["candidate_id"])
        self.assertEqual(read["metadata"]["requested_scope"], "shared")
        self.assertIn("Shared question", read["content"])
        self.assertIn("unreviewed", read["trust"])

    def test_candidate_read_rejects_path_input(self):
        with self.assertRaises(CuriosityError):
            self.store.read("../shared/anything.md")

    def test_malformed_candidate_file_is_not_listed(self):
        (self.root / "cur-20260101T000000Z-deadbeef.md").write_text(
            "# forged without metadata marker\n", encoding="utf-8"
        )
        result = self.store.list_candidates()
        self.assertEqual(result["count"], 0)

    def test_candidate_root_must_be_absolute(self):
        with self.assertRaises(CuriosityError):
            CandidateStore("relative/candidates")

    def test_candidate_from_env_requires_root(self):
        old = os.environ.pop("JOKO_CURIOSITY_CANDIDATE_ROOT", None)
        try:
            with self.assertRaises(CuriosityError):
                CandidateStore.from_env()
        finally:
            if old is not None:
                os.environ["JOKO_CURIOSITY_CANDIDATE_ROOT"] = old


if __name__ == "__main__":
    unittest.main()
