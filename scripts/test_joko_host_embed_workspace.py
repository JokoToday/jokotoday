from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import joko_agent_mcp as base
from joko_agent_mcp_phase4d import Phase4DService
from joko_agent_mcp_phase4e import Phase4EService
from joko_agent_mcp_phase4f import Phase4FService, phase4f_capability_names
from joko_creative_answer_workspace import CreativeAnswerWorkspace, CreativeAssetStore, CreativeReleaseStore, create_clearance_receipt
from joko_editorial_review import EditorialReviewWorkspace, package_fingerprint
from joko_host_embed_workspace import HostEmbedWorkspace
from joko_question_intelligence import QuestionIntelligenceError
from joko_research_workspace import ResearchWorkspace
from joko_source_grounded_spark import SourcePackWorkspace


class Phase4FHostEmbedTests(unittest.TestCase):
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
        self.host_embed_root = root / "host-embeds"
        for path in (
            self.canonical_root / "shared", self.candidate_root, self.research_root,
            self.review_root, self.release_root, self.creative_root, self.asset_root,
            self.host_embed_root,
        ):
            path.mkdir(parents=True, exist_ok=True)
        (self.canonical_root / "shared" / "lamination.md").write_text(
            "# Why do croissants have layers?\n", encoding="utf-8"
        )
        self.canonical = base.CuriosityStore(self.canonical_root)
        self.candidates = base.CandidateStore(self.candidate_root)
        self.research = ResearchWorkspace(self.research_root)
        self.review = EditorialReviewWorkspace(self.review_root, self.candidates, self.canonical)
        self.workspace = HostEmbedWorkspace(self.host_embed_root)
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
            self.cid, "research", "https://example.org/lamination", "Lamination",
            source_type="reputable_secondary",
        )
        self.research.create_answer(
            self.cid, "research", "Steam helps separate the layers.",
            "Butter layers and steam help laminated dough separate during baking.",
            [self.source["source_id"]],
        )
        self.editorial4d = Phase4DService(
            self.canonical, self.candidates, self.research, self.review, "editorial"
        )
        self.submission = self.editorial4d.submit_for_review(self.cid, "Ready")

    def tearDown(self):
        self.tmp.cleanup()

    def editorial(self) -> Phase4FService:
        return Phase4FService(
            self.canonical, self.candidates, self.research, self.review,
            self.workspace, "editorial"
        )

    def creative(self) -> Phase4FService:
        return Phase4FService(
            self.canonical, self.candidates, self.research, self.review,
            self.workspace, "creative", self.releases
        )

    def clear(self):
        package = self.editorial4d._review_package(self.cid)
        return create_clearance_receipt(
            self.release_root, self.cid, self.submission,
            "human-admin:test", "Cleared for creative presentation"
        ), package

    def create_relationship(self):
        return self.editorial().create_host_relationship(
            self.cid, "joko-today", "page", "homepage", "featured_on",
            "JOKO homepage", "/", "Featured curiosity context",
        )

    def test_capability_matrix(self):
        self.assertEqual(len(phase4f_capability_names("editorial")), 6)
        self.assertEqual(len(phase4f_capability_names("creative")), 5)
        self.assertEqual(phase4f_capability_names("research"), ())
        self.assertEqual(phase4f_capability_names("operator"), ())

    def test_shared_curiosity_can_target_joko_host_without_mutating_canonical(self):
        relationship = self.create_relationship()
        self.assertEqual(relationship["source_scope"], "shared")
        self.assertEqual(relationship["host"]["site_id"], "joko-today")
        self.assertFalse(relationship["canonical_episode_mutation"])
        self.assertFalse(relationship["publication_authority"])

    def test_only_editorial_can_create_host_relationship(self):
        self.clear()
        with self.assertRaises(QuestionIntelligenceError):
            self.workspace.create_host_relationship(
                self.cid, "creative", package_fingerprint(self.editorial4d._review_package(self.cid)),
                self.submission["review_submission_id"], "shared", "joko-today", "page",
                "homepage", "featured_on",
            )

    def test_host_registry_rejects_unknown_pages_and_external_sites(self):
        service = self.editorial()
        with self.assertRaises(QuestionIntelligenceError):
            service.create_host_relationship(self.cid, "other-site", "site", "other-site", "featured_on")
        with self.assertRaises(QuestionIntelligenceError):
            service.create_host_relationship(self.cid, "joko-today", "page", "secret-admin", "featured_on")

    def test_embed_candidate_is_renderer_contract_only(self):
        relationship = self.create_relationship()
        embed = self.editorial().create_embed(
            self.cid, relationship["host_relationship_id"], "homepage-feature",
            json.dumps({"show_sources": True}), "en", "paper",
            "Open the Notebook", "/notebook",
        )
        self.assertTrue(embed["renderer_contract_only"])
        self.assertFalse(embed["html_or_script_generated"])
        self.assertFalse(embed["publication_authority"])
        preview = self.editorial().preview(self.cid, embed["embed_candidate_id"])
        self.assertEqual(preview["renderer_contract"]["renderer"], "CuriosityEmbed")
        self.assertIsNone(preview["html"])
        self.assertIsNone(preview["script"])
        self.assertIsNone(preview["iframe"])
        self.assertEqual(preview["activation_status"], "not_activated")

    def test_cta_must_be_relative_and_feature_enabled(self):
        relationship = self.create_relationship()
        service = self.editorial()
        with self.assertRaises(QuestionIntelligenceError):
            service.create_embed(
                self.cid, relationship["host_relationship_id"], "notebook-card",
                "", "en", "paper", "Buy", "https://example.com/buy"
            )
        with self.assertRaises(QuestionIntelligenceError):
            service.create_embed(
                self.cid, relationship["host_relationship_id"], "notebook-card",
                "", "en", "paper", "Open", "/products"
            )

    def test_backslashes_are_rejected_in_host_and_cta_paths(self):
        service = self.editorial()
        with self.assertRaises(QuestionIntelligenceError):
            service.create_host_relationship(
                self.cid, "joko-today", "page", "homepage", "featured_on",
                "JOKO homepage", "/\\evil.example/path",
            )
        relationship = self.create_relationship()
        with self.assertRaises(QuestionIntelligenceError):
            service.create_embed(
                self.cid, relationship["host_relationship_id"], "homepage-feature",
                "", "en", "paper", "Open", "/\\evil.example/path",
            )

    def test_nondefault_duplicate_limit_is_preserved_across_phase4e_and_phase4f(self):
        for index in range(3):
            (self.canonical_root / "shared" / f"similar-{index}.md").write_text(
                f"# Why does laminated dough puff into layers number {index}?\n", encoding="utf-8"
            )
        self.submission = self.editorial4d.submit_for_review(
            self.cid, "Non-default duplicate limit", duplicate_limit=1
        )
        self.assertEqual(self.submission["duplicate_limit"], 1)
        context = self.editorial()._context(self.cid)
        self.assertFalse(context["review_status"]["stale"])
        self.assertEqual(context["package"]["duplicate_limit"], 1)
        self.assertLessEqual(len(context["package"]["duplicate_check"]["possible_matches"]), 1)

        create_clearance_receipt(
            self.release_root, self.cid, self.submission,
            "human-admin:test", "Cleared after non-default duplicate limit",
        )
        phase4e = Phase4EService(
            self.canonical, self.candidates, self.research, self.review,
            self.releases, CreativeAnswerWorkspace(self.creative_root, CreativeAssetStore(self.asset_root)),
            "creative",
        )
        released_package, released_submission, _ = phase4e._released(self.cid)
        self.assertEqual(released_submission["duplicate_limit"], 1)
        self.assertEqual(released_package["duplicate_limit"], 1)
        self.assertEqual(package_fingerprint(released_package), self.submission["package_fingerprint"])

    def test_creative_requires_current_human_clearance(self):
        relationship = self.create_relationship()
        with self.assertRaises(QuestionIntelligenceError):
            self.creative().create_embed(
                self.cid, relationship["host_relationship_id"], "notebook-card"
            )
        self.clear()
        embed = self.creative().create_embed(
            self.cid, relationship["host_relationship_id"], "notebook-card"
        )
        self.assertEqual(embed["created_by_profile"], "creative")

    def test_relationship_and_embed_become_stale_after_resubmission(self):
        relationship = self.create_relationship()
        embed = self.editorial().create_embed(
            self.cid, relationship["host_relationship_id"], "notebook-card"
        )
        self.research.create_answer(
            self.cid, "research", "Updated concise answer.", "Updated full answer.",
            [self.source["source_id"]],
        )
        self.editorial4d.submit_for_review(self.cid, "Updated review package")
        rels = self.editorial().list_host_relationships(self.cid)
        embeds = self.editorial().list_embeds(self.cid)
        self.assertTrue(rels["relationships"][0]["stale"])
        self.assertTrue(embeds["embeds"][0]["stale"])
        preview = self.editorial().preview(self.cid, embed["embed_candidate_id"])
        self.assertTrue(preview["stale"])
        self.assertFalse(preview["renderable_for_review"])

    def test_duplicate_current_relationship_and_embed_are_rejected(self):
        relationship = self.create_relationship()
        with self.assertRaises(QuestionIntelligenceError):
            self.create_relationship()
        service = self.editorial()
        service.create_embed(self.cid, relationship["host_relationship_id"], "notebook-card")
        with self.assertRaises(QuestionIntelligenceError):
            service.create_embed(self.cid, relationship["host_relationship_id"], "notebook-card")

    def test_phase4e_review_package_matches_phase4d_with_source_grounding(self):
        packs = SourcePackWorkspace(self.research_root)
        pack = packs.create(
            "editorial",
            [{
                "kind": "article", "title": "Lamination note", "publisher": "Example",
                "url": "https://example.org/source-pack", "excerpt": "Steam expands between dough layers.",
            }],
            topic="lamination",
        )
        packs.record_candidate_grounding(
            pack["source_pack_id"], self.cid,
            {
                "lens": "surprise", "trigger_type": "causal_mechanism",
                "source_refs": ["source-01"], "rationale": "Mechanism worth asking about",
                "why_interesting": "The visible layers emerge from an invisible phase change",
            },
            "editorial",
        )
        # Source grounding changes the current Phase 4D package. Re-submit so the
        # human review handoff matches the new fingerprint, then create clearance.
        self.submission = self.editorial4d.submit_for_review(self.cid, "Grounding added")
        create_clearance_receipt(
            self.release_root, self.cid, self.submission, "human-admin:test", "Creative clearance"
        )
        assets = CreativeAssetStore(self.asset_root)
        creative_workspace = CreativeAnswerWorkspace(self.creative_root, assets)
        phase4e = Phase4EService(
            self.canonical, self.candidates, self.research, self.review,
            self.releases, creative_workspace, "creative",
        )
        released_package, _, _ = phase4e._released(self.cid)
        phase4d_package = self.editorial4d._review_package(self.cid)
        self.assertIsNotNone(phase4d_package["source_grounding"])
        self.assertEqual(package_fingerprint(released_package), package_fingerprint(phase4d_package))


if __name__ == "__main__":
    unittest.main()
