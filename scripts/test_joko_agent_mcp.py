from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from joko_agent_mcp import CuriosityError, CuriosityStore


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


if __name__ == "__main__":
    unittest.main()
