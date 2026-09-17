#!/usr/bin/env python3
"""Phase 4G candidate-stage orchestration run registry.

This is a control-plane ledger only. It never executes domain actions, approves
content, promotes canonical Curiosities, or publishes host surfaces.
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
import re
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from joko_question_intelligence import QuestionIntelligenceError, clean_text

MAX_FILE_BYTES = 64 * 1024
MAX_OBJECTIVE_CHARS = 2000
CID_RE = re.compile(r"^cur-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
RUN_RE = re.compile(r"^orch-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
ROLES = {"editorial", "research", "creative", "operator"}
TEMPLATES: dict[str, dict[str, Any]] = {
    "research-review": {
        "label": "Research to editorial review",
        "goal": "Bring one Curiosity candidate to a current human editorial-review handoff.",
        "requires_creative": False,
        "requires_host_embed": False,
    },
    "creative-answer": {
        "label": "Creative answer staging",
        "goal": "Bring one reviewed Curiosity to a human-cleared, queued creative staging bundle.",
        "requires_creative": True,
        "requires_host_embed": False,
    },
    "host-embed": {
        "label": "Host relationship and embed staging",
        "goal": "Bring one reviewed Curiosity to a host relationship and native embed preview candidate.",
        "requires_creative": False,
        "requires_host_embed": True,
    },
    "full-curiosity": {
        "label": "Full controlled Curiosity staging",
        "goal": "Coordinate research, review, creative staging, and host embed staging, stopping before release.",
        "requires_creative": True,
        "requires_host_embed": True,
    },
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def _new_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"orch-{stamp}-{uuid.uuid4().hex[:8]}"


def _role(value: str) -> str:
    role = (value or "").strip().casefold()
    if role not in ROLES:
        raise QuestionIntelligenceError("profile role is not approved for Phase 4G")
    return role


def _cid(value: str) -> str:
    value = (value or "").strip()
    if not CID_RE.fullmatch(value):
        raise QuestionIntelligenceError("candidate_id is invalid")
    return value


def _run_id(value: str) -> str:
    value = (value or "").strip()
    if not RUN_RE.fullmatch(value):
        raise QuestionIntelligenceError("orchestration_run_id is invalid")
    return value


def _question_hash(question: str) -> str:
    return hashlib.sha256(question.strip().encode("utf-8")).hexdigest()


def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
    data = (json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")
    if len(data) > MAX_FILE_BYTES:
        raise QuestionIntelligenceError("orchestration artifact exceeds size limit")
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
        raise QuestionIntelligenceError("orchestration artifact is invalid")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise QuestionIntelligenceError("orchestration artifact is malformed") from exc
    if not isinstance(value, dict):
        raise QuestionIntelligenceError("orchestration artifact must be a JSON object")
    return value


class OrchestrationWorkspace:
    """Immutable run intents plus read-only status projection owned by Phase 4G."""

    def __init__(self, root: str | Path):
        path = Path(root).expanduser()
        if not path.is_absolute() or path.is_symlink() or not path.is_dir():
            raise QuestionIntelligenceError("orchestration root must be an absolute ordinary directory")
        self.root = path.resolve(strict=True)
        self.runs = self.root / "runs"
        self._runs_dir()
        self.lock_path = self.root / ".phase4g.lock"

    def _runs_dir(self) -> Path:
        path = self.root / "runs"
        if not path.exists() or path.is_symlink() or not path.is_dir():
            raise QuestionIntelligenceError("orchestration runs path must be a pre-created ordinary directory")
        try:
            resolved = path.resolve(strict=True)
            resolved.relative_to(self.root)
        except (FileNotFoundError, ValueError) as exc:
            raise QuestionIntelligenceError("orchestration runs path escapes its root") from exc
        return resolved

    @contextmanager
    def _lock(self) -> Iterator[None]:
        if self.lock_path.is_symlink():
            raise QuestionIntelligenceError("orchestration lock must not be a symlink")
        fd = os.open(self.lock_path, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            yield
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)

    def template_list(self, profile_role: str) -> dict[str, Any]:
        _role(profile_role)
        return {
            "templates": [{"template_id": key, **value} for key, value in TEMPLATES.items()],
            "execution_model": "explicit-role-handoffs",
            "auto_execution": False,
            "cross_role_execution": False,
            "publication_authority": False,
        }

    def create(self, candidate_id: str, profile_role: str, template_id: str,
               question: str, objective: str = "") -> dict[str, Any]:
        role, cid = _role(profile_role), _cid(candidate_id)
        if role != "operator":
            raise QuestionIntelligenceError("only operator can create orchestration runs")
        template_id = (template_id or "").strip().casefold()
        if template_id not in TEMPLATES:
            raise QuestionIntelligenceError("orchestration template is not supported")
        objective = clean_text(objective, "orchestration objective", MAX_OBJECTIVE_CHARS, required=False)
        qhash = _question_hash(question)
        with self._lock():
            for row in self._rows():
                if (
                    row.get("candidate_id") == cid
                    and row.get("template_id") == template_id
                    and row.get("candidate_question_sha256") == qhash
                ):
                    raise QuestionIntelligenceError("duplicate orchestration run for current candidate question/template")
            run_id = _new_id()
            payload = {
                "schema_version": 1,
                "artifact_type": "controlled_orchestration_run",
                "orchestration_run_id": run_id,
                "candidate_id": cid,
                "candidate_question_sha256": qhash,
                "template_id": template_id,
                "objective": objective,
                "created_by_profile": role,
                "created_at": _now(),
                "status_source": "derived-from-domain-artifacts",
                "auto_execution": False,
                "cross_role_execution": False,
                "human_gates_bypassable": False,
                "canonicalization_authority": False,
                "publication_authority": False,
                "trust": "control-plane run intent only; every domain write still requires its owning profile/tool",
            }
            _atomic_json(self._runs_dir() / f"{run_id}.json", payload)
            return payload

    def _rows(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for path in sorted(self._runs_dir().glob("orch-*.json")):
            try:
                row = _read_json(path)
            except QuestionIntelligenceError:
                continue
            run_id = str(row.get("orchestration_run_id") or "")
            if run_id == path.stem and RUN_RE.fullmatch(run_id):
                rows.append(row)
        rows.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
        return rows

    def list_runs(self, profile_role: str, candidate_id: str = "") -> dict[str, Any]:
        _role(profile_role)
        cid = _cid(candidate_id) if (candidate_id or "").strip() else ""
        rows = self._rows()
        if cid:
            rows = [row for row in rows if row.get("candidate_id") == cid]
        return {
            "runs": rows,
            "count": len(rows),
            "auto_execution": False,
            "publication_authority": False,
        }

    def read(self, orchestration_run_id: str, profile_role: str) -> dict[str, Any]:
        _role(profile_role)
        run_id = _run_id(orchestration_run_id)
        path = self._runs_dir() / f"{run_id}.json"
        row = _read_json(path)
        if row.get("orchestration_run_id") != run_id:
            raise QuestionIntelligenceError("orchestration run metadata mismatch")
        return row


def question_sha256(question: str) -> str:
    return _question_hash(question)
