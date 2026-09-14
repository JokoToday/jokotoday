from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from joko_agent_mcp import KnowledgeError, KnowledgeStore


class KnowledgeStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "bakery").mkdir()
        (self.root / "bakery" / "croissants.md").write_text(
            "# Croissants\n\nButter lamination and proofing notes.\nSecond line.\n",
            encoding="utf-8",
        )
        (self.root / "brand.md").write_text(
            "# Brand\n\nJOKO TODAY uses a quiet editorial voice.\n",
            encoding="utf-8",
        )
        (self.root / "ignore.txt").write_text("not knowledge", encoding="utf-8")
        self.store = KnowledgeStore(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_list_only_markdown(self):
        result = self.store.list_documents()
        paths = [item["path"] for item in result["documents"]]
        self.assertEqual(paths, ["bakery/croissants.md", "brand.md"])

    def test_search_requires_all_terms(self):
        result = self.store.search("butter proofing")
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["results"][0]["path"], "bakery/croissants.md")

    def test_read_is_line_bounded(self):
        result = self.store.read("bakery/croissants.md", start_line=2, max_lines=2)
        self.assertEqual(result["start_line"], 2)
        self.assertEqual(result["end_line"], 3)
        self.assertIn("Butter lamination", result["content"])
        self.assertTrue(result["truncated"])

    def test_rejects_parent_traversal(self):
        with self.assertRaises(KnowledgeError):
            self.store.read("../secret.md")

    def test_rejects_non_markdown(self):
        with self.assertRaises(KnowledgeError):
            self.store.read("ignore.txt")

    def test_rejects_symlink(self):
        outside_dir = Path(tempfile.mkdtemp())
        try:
            outside = outside_dir / "outside.md"
            outside.write_text("secret", encoding="utf-8")
            link = self.root / "linked.md"
            try:
                link.symlink_to(outside)
            except (OSError, NotImplementedError):
                self.skipTest("symlinks unavailable")
            with self.assertRaises(KnowledgeError):
                self.store.read("linked.md")
        finally:
            if outside_dir.exists():
                for child in outside_dir.iterdir():
                    child.unlink()
                outside_dir.rmdir()

    def test_root_must_be_absolute(self):
        with self.assertRaises(KnowledgeError):
            KnowledgeStore("relative/path")

    def test_from_env_requires_root(self):
        old = os.environ.pop("JOKO_KNOWLEDGE_ROOT", None)
        try:
            with self.assertRaises(KnowledgeError):
                KnowledgeStore.from_env()
        finally:
            if old is not None:
                os.environ["JOKO_KNOWLEDGE_ROOT"] = old


if __name__ == "__main__":
    unittest.main()
