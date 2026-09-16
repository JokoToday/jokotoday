#!/usr/bin/env python3
"""Phase 4D candidate-stage editorial review and Curiosity Graph workspace."""
from __future__ import annotations

import hashlib
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from joko_question_intelligence import QuestionIntelligenceError, clean_text

MAX_FILE_BYTES = 256 * 1024
MAX_REVIEW_NOTES_CHARS = 12000
MAX_RELATION_RATIONALE_CHARS = 8000
READ_ROLES = {"editorial", "research", "creative"}
RELATION_WRITE_ROLES = {"editorial", "research"}
SUBMIT_ROLES = {"editorial"}
RELATION_TYPES = {"related", "follow_up"}
TARGET_KINDS = {"candidate", "canonical"}
CID_RE = re.compile(r"^cur-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
REL_RE = re.compile(r"^rel-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
REV_RE = re.compile(r"^rev-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def _new_id(prefix: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{prefix}-{stamp}-{uuid.uuid4().hex[:8]}"


def _role(role: str, allowed: set[str]) -> str:
    normalized = (role or "").strip().casefold()
    if normalized not in allowed:
        raise QuestionIntelligenceError("profile role is not allowed for this Phase 4D operation")
    return normalized


def _cid(value: str) -> str:
    value = (value or "").strip()
    if not CID_RE.fullmatch(value):
        raise QuestionIntelligenceError("candidate_id is invalid")
    return value


def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
    data = (json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")
    if len(data) > MAX_FILE_BYTES:
        raise QuestionIntelligenceError("Phase 4D artifact exceeds size limit")
    tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(tmp, flags, 0o600)
    try:
        os.write(fd, data)
        os.fsync(fd)
    finally:
        os.close(fd)
    os.replace(tmp, path)


def _read_json(path: Path) -> dict[str, Any]:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
        raise QuestionIntelligenceError("Phase 4D artifact is invalid")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise QuestionIntelligenceError("Phase 4D artifact is malformed") from exc
    if not isinstance(data, dict):
        raise QuestionIntelligenceError("Phase 4D artifact is malformed")
    return data


def package_fingerprint(package: dict[str, Any]) -> str:
    """Fingerprint only review-relevant immutable/current artifacts, never display text."""
    snapshot = {
        "candidate_id": package.get("candidate_id"),
        "candidate_metadata": package.get("candidate_metadata"),
        "question": package.get("question"),
        "source_grounding": package.get("source_grounding"),
        "classification": package.get("classification"),
        "latest_answer": package.get("latest_answer"),
        "cited_sources": package.get("cited_sources"),
        "source_count": package.get("source_count"),
        "answer_count": package.get("answer_count"),
        "duplicate_check": package.get("duplicate_check"),
        "relationship_candidates": package.get("relationship_candidates"),
    }
    encoded = json.dumps(snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


class EditorialReviewWorkspace:
    """Unreviewed graph proposals and immutable submissions for human editorial review."""

    def __init__(self, root: str | Path, candidate_store: Any, canonical_store: Any):
        root = Path(root).expanduser()
        if not root.is_absolute() or root.is_symlink() or not root.is_dir():
            raise QuestionIntelligenceError("review workspace root must be an absolute ordinary directory")
        self.root = root.resolve(strict=True)
        self.candidates = candidate_store
        self.canonical = canonical_store

    def _candidate_dir(self, candidate_id: str, create: bool = False) -> Path:
        cid = _cid(candidate_id)
        path = self.root / cid
        if path.is_symlink():
            raise QuestionIntelligenceError("symlinked review workspace is not allowed")
        if create and not path.exists():
            path.mkdir(mode=0o700)
        try:
            resolved = path.resolve(strict=True)
            resolved.relative_to(self.root)
        except (FileNotFoundError, ValueError) as exc:
            raise QuestionIntelligenceError("candidate review workspace does not exist") from exc
        if not resolved.is_dir():
            raise QuestionIntelligenceError("candidate review workspace is invalid")
        return resolved

    def _candidate_metadata(self, candidate_id: str) -> dict[str, Any]:
        payload = self.candidates.read(_cid(candidate_id))
        metadata = payload.get("metadata") or {}
        if metadata.get("candidate_id") != candidate_id:
            raise QuestionIntelligenceError("candidate metadata mismatch")
        return metadata

    def _target_scope(self, target_kind: str, target_ref: str) -> str:
        if target_kind == "candidate":
            metadata = self._candidate_metadata(target_ref)
            return str(metadata.get("requested_scope", ""))
        payload = self.canonical.read(target_ref, start_line=1, max_lines=1)
        return str(payload.get("scope", ""))

    def create_relation(self, candidate_id: str, profile_role: str, relation_type: str,
                        target_kind: str, target_ref: str, rationale: str = "") -> dict[str, Any]:
        role, cid = _role(profile_role, RELATION_WRITE_ROLES), _cid(candidate_id)
        source_meta = self._candidate_metadata(cid)
        relation_type = (relation_type or "").strip().casefold()
        target_kind = (target_kind or "").strip().casefold()
        target_ref = clean_text(target_ref, "target_ref", 500)
        rationale = clean_text(rationale, "relationship rationale", MAX_RELATION_RATIONALE_CHARS, required=False)
        if relation_type not in RELATION_TYPES:
            raise QuestionIntelligenceError("relation_type must be related or follow_up")
        if target_kind not in TARGET_KINDS:
            raise QuestionIntelligenceError("target_kind must be candidate or canonical")
        if target_kind == "candidate":
            _cid(target_ref)
            if target_ref == cid:
                raise QuestionIntelligenceError("a candidate cannot relate to itself")
        target_scope = self._target_scope(target_kind, target_ref)
        source_scope = str(source_meta.get("requested_scope", ""))
        if source_scope == "shared" and target_scope != "shared":
            raise QuestionIntelligenceError("Shared Curiosity candidates cannot depend on JOKO-local graph targets")
        if source_scope not in {"shared", "joko"} or target_scope not in {"shared", "joko"}:
            raise QuestionIntelligenceError("relationship scope is invalid")

        existing = self.list_relations(cid, role)["relationships"]
        for item in existing:
            if (item.get("relation_type"), item.get("target_kind"), item.get("target_ref")) == (
                relation_type, target_kind, target_ref
            ):
                raise QuestionIntelligenceError("relationship candidate already exists")

        relation_id = _new_id("rel")
        payload = {
            "schema_version": 1,
            "artifact_type": "curiosity_relationship_candidate",
            "relation_id": relation_id,
            "candidate_id": cid,
            "source_scope": source_scope,
            "relation_type": relation_type,
            "target_kind": target_kind,
            "target_ref": target_ref,
            "target_scope": target_scope,
            "rationale": rationale,
            "created_by_profile": role,
            "created_at": _now(),
            "trust": "unreviewed Curiosity Graph proposal; never canonical or publication authority",
        }
        folder = self._candidate_dir(cid, create=True) / "relationships"
        if folder.exists() and folder.is_symlink():
            raise QuestionIntelligenceError("symlinked relationship directory is not allowed")
        folder.mkdir(mode=0o700, exist_ok=True)
        _atomic_json(folder / f"{relation_id}.json", payload)
        return payload

    def list_relations(self, candidate_id: str, profile_role: str) -> dict[str, Any]:
        _role(profile_role, READ_ROLES)
        cid = _cid(candidate_id)
        # Candidate existence is authoritative even before a review workspace exists.
        self._candidate_metadata(cid)
        base = self.root / cid
        if not base.exists():
            return {"candidate_id": cid, "count": 0, "relationships": []}
        folder = self._candidate_dir(cid) / "relationships"
        if not folder.exists():
            return {"candidate_id": cid, "count": 0, "relationships": []}
        if folder.is_symlink() or not folder.is_dir():
            raise QuestionIntelligenceError("relationship directory is invalid")
        output: list[dict[str, Any]] = []
        for path in sorted(folder.glob("rel-*.json")):
            try:
                data = _read_json(path)
                if data.get("candidate_id") != cid or data.get("relation_id") != path.stem:
                    continue
                if not REL_RE.fullmatch(path.stem) or data.get("relation_type") not in RELATION_TYPES:
                    continue
                output.append(data)
            except QuestionIntelligenceError:
                continue
        output.sort(key=lambda x: str(x.get("created_at", "")))
        return {
            "candidate_id": cid,
            "count": len(output),
            "relationships": output,
            "trust": "unreviewed graph proposals only; human editorial review required",
        }

    def _submissions(self, candidate_id: str, profile_role: str) -> list[dict[str, Any]]:
        _role(profile_role, READ_ROLES)
        cid = _cid(candidate_id)
        self._candidate_metadata(cid)
        base = self.root / cid
        if not base.exists():
            return []
        folder = self._candidate_dir(cid) / "submissions"
        if not folder.exists():
            return []
        if folder.is_symlink() or not folder.is_dir():
            raise QuestionIntelligenceError("review submissions directory is invalid")
        output = []
        for path in sorted(folder.glob("rev-*.json")):
            try:
                data = _read_json(path)
                if data.get("candidate_id") == cid and data.get("review_submission_id") == path.stem and REV_RE.fullmatch(path.stem):
                    output.append(data)
            except QuestionIntelligenceError:
                continue
        return sorted(output, key=lambda x: str(x.get("submitted_at", "")), reverse=True)

    def latest_submission(self, candidate_id: str, profile_role: str) -> dict[str, Any] | None:
        submissions = self._submissions(candidate_id, profile_role)
        return submissions[0] if submissions else None

    def submit(self, candidate_id: str, profile_role: str, package: dict[str, Any], review_notes: str = "") -> dict[str, Any]:
        role, cid = _role(profile_role, SUBMIT_ROLES), _cid(candidate_id)
        if package.get("candidate_id") != cid:
            raise QuestionIntelligenceError("review package candidate mismatch")
        readiness = package.get("readiness") or {}
        if readiness.get("eligible_for_editorial_review") is not True:
            raise QuestionIntelligenceError("candidate is not mechanically eligible for editorial review")
        if readiness.get("requires_human_review") is not True:
            raise QuestionIntelligenceError("human editorial review gate must remain enabled")
        fingerprint = package_fingerprint(package)
        try:
            duplicate_limit = int(package.get("duplicate_limit", 5))
        except (TypeError, ValueError) as exc:
            raise QuestionIntelligenceError("review package duplicate_limit is invalid") from exc
        if not 1 <= duplicate_limit <= 20:
            raise QuestionIntelligenceError("review package duplicate_limit is invalid")
        notes = clean_text(review_notes, "review_notes", MAX_REVIEW_NOTES_CHARS, required=False)
        existing = self._submissions(cid, role)
        if (
            existing
            and existing[0].get("package_fingerprint") == fingerprint
            and str(existing[0].get("review_notes") or "") == notes
        ):
            return {**existing[0], "already_submitted": True}
        latest_answer = package.get("latest_answer") or {}
        classification = package.get("classification") or {}
        relations = package.get("relationship_candidates") or []
        submission_id = _new_id("rev")
        payload = {
            "schema_version": 1,
            "artifact_type": "editorial_review_submission",
            "review_submission_id": submission_id,
            "candidate_id": cid,
            "status": "awaiting_human_review",
            "package_fingerprint": fingerprint,
            "duplicate_limit": duplicate_limit,
            "snapshot": {
                "proposed_scope": classification.get("proposed_scope"),
                "topic": classification.get("topic"),
                "sensitivity": classification.get("sensitivity"),
                "answer_id": latest_answer.get("answer_id"),
                "source_ids": list(latest_answer.get("source_ids") or []),
                "relation_ids": [item.get("relation_id") for item in relations],
            },
            "review_notes": notes,
            "submitted_by_profile": role,
            "submitted_at": _now(),
            "human_review_required": True,
            "approval_authority": False,
            "publication_authority": False,
            "trust": "handoff to human editorial review only; not approval and not canonical content",
        }
        folder = self._candidate_dir(cid, create=True) / "submissions"
        if folder.exists() and folder.is_symlink():
            raise QuestionIntelligenceError("symlinked review submissions directory is not allowed")
        folder.mkdir(mode=0o700, exist_ok=True)
        _atomic_json(folder / f"{submission_id}.json", payload)
        return payload

    def status(self, candidate_id: str, profile_role: str, package: dict[str, Any]) -> dict[str, Any]:
        role, cid = _role(profile_role, READ_ROLES), _cid(candidate_id)
        submissions = self._submissions(cid, role)
        if not submissions:
            return {
                "candidate_id": cid,
                "status": "not_submitted",
                "submission_count": 0,
                "stale": False,
                "human_review_required": True,
                "approval_authority": False,
                "publication_authority": False,
            }
        latest = submissions[0]
        current_fingerprint = package_fingerprint(package)
        stale = latest.get("package_fingerprint") != current_fingerprint
        return {
            "candidate_id": cid,
            "status": "awaiting_human_review",
            "submission_count": len(submissions),
            "latest_submission": latest,
            "stale": stale,
            "needs_resubmission": stale,
            "current_package_fingerprint": current_fingerprint,
            "human_review_required": True,
            "approval_authority": False,
            "publication_authority": False,
            "trust": "status only; Hermes cannot approve, promote, or publish in Phase 4D",
        }
