#!/usr/bin/env python3
"""Phase 4C candidate-stage research workspace. Never canonical storage."""
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from joko_question_intelligence import QuestionIntelligenceError, clean_text

MAX_FILE_BYTES = 256 * 1024
MAX_ANSWER_CHARS = 30000
WRITE_ROLES = {"research"}
READ_ROLES = {"research", "editorial"}
SCOPES = {"shared", "joko"}
SENSITIVITIES = {"normal", "elevated", "high"}
HIGH_TOPICS = {"allergens", "food_safety", "health", "medical", "legal", "financial", "dangerous"}
SOURCE_TYPES = {"primary", "official", "academic", "expert", "reputable_secondary", "other"}
STRONG_SOURCE_TYPES = {"primary", "official", "academic"}
CID_RE = re.compile(r"^cur-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
SID_RE = re.compile(r"^src-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
AID_RE = re.compile(r"^ans-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _new_id(prefix: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{prefix}-{stamp}-{uuid.uuid4().hex[:8]}"


def _role(role: str, allowed: set[str]) -> str:
    role = (role or "").strip().casefold()
    if role not in allowed:
        raise QuestionIntelligenceError("profile role is not allowed for this Phase 4C operation")
    return role


def _cid(value: str) -> str:
    value = (value or "").strip()
    if not CID_RE.fullmatch(value):
        raise QuestionIntelligenceError("candidate_id is invalid")
    return value


def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
    data = (json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode()
    if len(data) > MAX_FILE_BYTES:
        raise QuestionIntelligenceError("research artifact exceeds size limit")
    tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(tmp, flags, 0o600)
    try:
        os.write(fd, data)
        os.fsync(fd)
    finally:
        os.close(fd)
    os.replace(tmp, path)


class ResearchWorkspace:
    def __init__(self, root: str | Path):
        root = Path(root).expanduser()
        if not root.is_absolute() or root.is_symlink() or not root.is_dir():
            raise QuestionIntelligenceError("research workspace root must be an absolute ordinary directory")
        self.root = root.resolve(strict=True)

    def _dir(self, candidate_id: str, create: bool = False) -> Path:
        path = self.root / _cid(candidate_id)
        if path.is_symlink():
            raise QuestionIntelligenceError("symlinked candidate workspace is not allowed")
        if create and not path.exists():
            path.mkdir(mode=0o700)
        try:
            resolved = path.resolve(strict=True)
            resolved.relative_to(self.root)
        except (FileNotFoundError, ValueError) as exc:
            raise QuestionIntelligenceError("candidate research workspace does not exist") from exc
        if not resolved.is_dir():
            raise QuestionIntelligenceError("candidate research workspace is invalid")
        return resolved

    @staticmethod
    def _read(path: Path) -> dict[str, Any]:
        if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
            raise QuestionIntelligenceError("research artifact is invalid")
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise QuestionIntelligenceError("research artifact is malformed") from exc
        if not isinstance(data, dict):
            raise QuestionIntelligenceError("research artifact is malformed")
        return data

    def save_classification(self, candidate_id: str, profile_role: str, proposed_scope: str,
                            topic: str, sensitivity: str = "normal", rationale: str = "", host: str = "") -> dict[str, Any]:
        role, cid = _role(profile_role, WRITE_ROLES), _cid(candidate_id)
        scope, sensitivity = (proposed_scope or "").strip().casefold(), (sensitivity or "normal").strip().casefold()
        if scope not in SCOPES or sensitivity not in SENSITIVITIES:
            raise QuestionIntelligenceError("invalid scope or sensitivity")
        topic = clean_text(topic, "topic", 160)
        rationale = clean_text(rationale, "rationale", 8000, required=False)
        host = (host or "").strip().casefold()
        if (scope == "joko" and host != "joko-today") or (scope == "shared" and host):
            raise QuestionIntelligenceError("classification scope/host mismatch")
        if topic.casefold() in HIGH_TOPICS and sensitivity == "normal":
            sensitivity = "high"
        payload = {
            "schema_version": 1, "candidate_id": cid, "artifact_type": "classification_candidate",
            "proposed_scope": scope, "topic": topic, "sensitivity": sensitivity,
            "host": "joko-today" if scope == "joko" else None, "rationale": rationale,
            "created_by_profile": role, "created_at": _now(),
            "trust": "unreviewed classification candidate; human review required",
        }
        _atomic_json(self._dir(cid, create=True) / "classification.json", payload)
        return payload

    def read_classification(self, candidate_id: str, profile_role: str) -> dict[str, Any]:
        _role(profile_role, READ_ROLES)
        return self._read(self._dir(candidate_id) / "classification.json")

    def add_source(self, candidate_id: str, profile_role: str, url: str, title: str,
                   publisher: str = "", source_type: str = "reputable_secondary", notes: str = "") -> dict[str, Any]:
        role, cid = _role(profile_role, WRITE_ROLES), _cid(candidate_id)
        parsed = urlparse((url or "").strip())
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise QuestionIntelligenceError("source URL must be http(s)")
        source_type = (source_type or "").strip().casefold()
        if source_type not in SOURCE_TYPES:
            raise QuestionIntelligenceError("source_type is not approved")
        sid = _new_id("src")
        payload = {
            "schema_version": 1, "candidate_id": cid, "artifact_type": "source_candidate", "source_id": sid,
            "url": parsed.geturl(), "title": clean_text(title, "source title", 500),
            "publisher": clean_text(publisher, "publisher", 300, required=False) or None,
            "source_type": source_type, "notes": clean_text(notes, "source notes", 8000, required=False),
            "created_by_profile": role, "created_at": _now(),
            "trust": "source metadata only; source claims still require evaluation",
        }
        folder = self._dir(cid, create=True) / "sources"
        if folder.exists() and folder.is_symlink():
            raise QuestionIntelligenceError("symlinked source directory is not allowed")
        folder.mkdir(mode=0o700, exist_ok=True)
        _atomic_json(folder / f"{sid}.json", payload)
        return payload

    def get_sources(self, candidate_id: str, profile_role: str) -> list[dict[str, Any]]:
        _role(profile_role, READ_ROLES)
        cid, folder = _cid(candidate_id), self._dir(candidate_id) / "sources"
        if not folder.exists():
            return []
        if folder.is_symlink() or not folder.is_dir():
            raise QuestionIntelligenceError("source directory is invalid")
        output = []
        for path in sorted(folder.glob("src-*.json")):
            try:
                data = self._read(path)
                if data.get("candidate_id") == cid and data.get("source_id") == path.stem and SID_RE.fullmatch(path.stem):
                    output.append(data)
            except QuestionIntelligenceError:
                continue
        return output

    def create_answer(self, candidate_id: str, profile_role: str, concise_answer: str,
                      full_answer: str, source_ids: list[str]) -> dict[str, Any]:
        role, cid = _role(profile_role, WRITE_ROLES), _cid(candidate_id)
        known = {item["source_id"] for item in self.get_sources(cid, role)}
        cited = []
        for sid in source_ids:
            sid = (sid or "").strip()
            if not SID_RE.fullmatch(sid) or sid not in known:
                raise QuestionIntelligenceError("answer references an unknown source candidate")
            if sid not in cited:
                cited.append(sid)
        aid = _new_id("ans")
        payload = {
            "schema_version": 1, "candidate_id": cid, "artifact_type": "answer_candidate", "answer_id": aid,
            "concise_answer": clean_text(concise_answer, "concise_answer", MAX_ANSWER_CHARS),
            "full_answer": clean_text(full_answer, "full_answer", MAX_ANSWER_CHARS),
            "source_ids": cited, "created_by_profile": role, "created_at": _now(),
            "trust": "unreviewed answer candidate; not canonical and not publishable",
        }
        folder = self._dir(cid, create=True) / "answers"
        folder.mkdir(mode=0o700, exist_ok=True)
        _atomic_json(folder / f"{aid}.json", payload)
        return payload

    def get_answers(self, candidate_id: str, profile_role: str) -> list[dict[str, Any]]:
        _role(profile_role, READ_ROLES)
        cid, folder = _cid(candidate_id), self._dir(candidate_id) / "answers"
        if not folder.exists():
            return []
        output = []
        for path in sorted(folder.glob("ans-*.json")):
            try:
                data = self._read(path)
                if data.get("candidate_id") == cid and data.get("answer_id") == path.stem and AID_RE.fullmatch(path.stem):
                    output.append(data)
            except QuestionIntelligenceError:
                continue
        return sorted(output, key=lambda x: str(x.get("created_at", "")), reverse=True)

    def readiness(self, candidate_id: str, profile_role: str) -> dict[str, Any]:
        _role(profile_role, READ_ROLES)
        cid = _cid(candidate_id)
        try:
            classification = self.read_classification(cid, profile_role)
        except QuestionIntelligenceError:
            classification = None
        sources, answers = self.get_sources(cid, profile_role), self.get_answers(cid, profile_role)
        checks = [
            {"check": "classification_present", "pass": classification is not None},
            {"check": "at_least_one_source", "pass": len(sources) >= 1, "count": len(sources)},
            {"check": "answer_present", "pass": len(answers) >= 1, "count": len(answers)},
        ]
        cited = set(answers[0].get("source_ids") or []) if answers else set()
        known = {source["source_id"] for source in sources}
        checks.append({"check": "answer_cites_known_sources", "pass": bool(cited) and cited.issubset(known), "count": len(cited)})
        if classification and classification.get("sensitivity") == "high":
            strong = sum(1 for source in sources if source.get("source_type") in STRONG_SOURCE_TYPES)
            checks += [
                {"check": "high_sensitivity_two_sources", "pass": len(sources) >= 2, "count": len(sources)},
                {"check": "high_sensitivity_strong_source", "pass": strong >= 1, "count": strong},
            ]
        return {
            "candidate_id": cid, "checks": checks,
            "eligible_for_editorial_review": all(bool(item["pass"]) for item in checks),
            "requires_human_review": True, "review_gate": "editorial",
            "trust": "mechanical readiness result only; never approval or publication authority",
        }
