#!/usr/bin/env python3
"""Phase 4E candidate-stage Creative Answer workspace and staging-asset reader."""
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
MAX_ASSET_METADATA_BYTES = 64 * 1024
MAX_ASSET_BYTES = 25 * 1024 * 1024
MAX_ACCESSIBILITY_CHARS = 12000
MAX_RATIONALE_CHARS = 8000
MAX_BEATS = 10
MAX_PANELS = 12
CREATIVE_ROLES = {"creative"}
STYLE_PROFILES = {"living-notebook-v1", "jokomi-master-v1", "curious-community-v1"}
VOICE_MODES = {"silent", "first_person_inner", "neutral_narrator"}
CLAIM_TYPES = {"visual_only", "factual_explanation"}
GENERATION_MODES = {"storyboard_frames", "doodle_keyframes", "scene_illustration"}
ASPECT_RATIOS = {"9:16", "16:9", "1:1", "4:5"}
CID_RE = re.compile(r"^cur-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
CLEAR_RE = re.compile(r"^clr-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
GUIDE_RE = re.compile(r"^guide-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
SCRIPT_RE = re.compile(r"^script-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
BOARD_RE = re.compile(r"^board-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
GEN_RE = re.compile(r"^gen-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
ASSET_RE = re.compile(r"^asset-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
REV_RE = re.compile(r"^rev-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def _new_id(prefix: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{prefix}-{stamp}-{uuid.uuid4().hex[:8]}"


def _cid(value: str) -> str:
    value = (value or "").strip()
    if not CID_RE.fullmatch(value):
        raise QuestionIntelligenceError("candidate_id is invalid")
    return value


def _role(value: str) -> str:
    role = (value or "").strip().casefold()
    if role not in CREATIVE_ROLES:
        raise QuestionIntelligenceError("profile role is not allowed for this Phase 4E operation")
    return role


def _safe_root(root: str | Path, label: str) -> Path:
    path = Path(root).expanduser()
    if not path.is_absolute() or path.is_symlink() or not path.is_dir():
        raise QuestionIntelligenceError(f"{label} root must be an absolute ordinary directory")
    return path.resolve(strict=True)


def _atomic_json(path: Path, payload: dict[str, Any], mode: int = 0o600) -> None:
    data = (json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")
    if len(data) > MAX_FILE_BYTES:
        raise QuestionIntelligenceError("Phase 4E artifact exceeds size limit")
    tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(tmp, flags, mode)
    try:
        os.write(fd, data)
        os.fsync(fd)
    finally:
        os.close(fd)
    os.replace(tmp, path)


def _read_json(path: Path, limit: int = MAX_FILE_BYTES) -> dict[str, Any]:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > limit:
        raise QuestionIntelligenceError("Phase 4E artifact is invalid")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise QuestionIntelligenceError("Phase 4E artifact is malformed") from exc
    if not isinstance(data, dict):
        raise QuestionIntelligenceError("Phase 4E artifact is malformed")
    return data


def _parse_json_array(value: str, name: str) -> list[Any]:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise QuestionIntelligenceError(f"{name} must be valid JSON") from exc
    if not isinstance(parsed, list):
        raise QuestionIntelligenceError(f"{name} must be a JSON array")
    return parsed


def create_clearance_receipt(release_root: str | Path, candidate_id: str,
                             review_submission: dict[str, Any], cleared_by: str,
                             note: str = "") -> dict[str, Any]:
    """Human/admin-side helper. This is intentionally never exposed as an MCP tool."""
    root = _safe_root(release_root, "creative release")
    cid = _cid(candidate_id)
    if review_submission.get("candidate_id") != cid:
        raise QuestionIntelligenceError("review submission candidate mismatch")
    if review_submission.get("status") != "awaiting_human_review":
        raise QuestionIntelligenceError("creative clearance requires an awaiting_human_review submission")
    submission_id = str(review_submission.get("review_submission_id") or "")
    fingerprint = str(review_submission.get("package_fingerprint") or "")
    if not REV_RE.fullmatch(submission_id) or not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
        raise QuestionIntelligenceError("review submission is missing a valid fingerprint")
    if review_submission.get("human_review_required") is not True:
        raise QuestionIntelligenceError("review submission must retain the human review gate")
    if review_submission.get("approval_authority") is not False or review_submission.get("publication_authority") is not False:
        raise QuestionIntelligenceError("review submission authority boundary is invalid")
    cleared_by = clean_text(cleared_by, "cleared_by", 200)
    note = clean_text(note, "clearance note", MAX_RATIONALE_CHARS, required=False)
    clearance_id = _new_id("clr")
    payload = {
        "schema_version": 1,
        "artifact_type": "human_creative_clearance",
        "clearance_id": clearance_id,
        "candidate_id": cid,
        "review_submission_id": submission_id,
        "package_fingerprint": fingerprint,
        "cleared_by": cleared_by,
        "clearance_note": note,
        "cleared_at": _now(),
        "creative_derivation_authority": True,
        "canonicalization_authority": False,
        "publication_authority": False,
        "trust": "human clearance for staging creative derivation only; not factual approval or publication authority",
    }
    folder = root / cid
    if folder.exists() and (folder.is_symlink() or not folder.is_dir()):
        raise QuestionIntelligenceError("creative clearance candidate directory is invalid")
    folder.mkdir(mode=0o750, exist_ok=True)
    if folder.is_symlink() or not folder.is_dir():
        raise QuestionIntelligenceError("creative clearance candidate directory is invalid")
    _atomic_json(folder / f"{clearance_id}.json", payload, mode=0o440)
    return payload


class CreativeReleaseStore:
    def __init__(self, root: str | Path):
        self.root = _safe_root(root, "creative release")

    def latest(self, candidate_id: str) -> dict[str, Any] | None:
        cid = _cid(candidate_id)
        folder = self.root / cid
        if not folder.exists():
            return None
        if folder.is_symlink() or not folder.is_dir():
            raise QuestionIntelligenceError("creative release candidate directory is invalid")
        rows: list[dict[str, Any]] = []
        for path in sorted(folder.glob("clr-*.json")):
            try:
                data = _read_json(path)
                if (
                    data.get("candidate_id") == cid
                    and data.get("clearance_id") == path.stem
                    and CLEAR_RE.fullmatch(path.stem)
                    and data.get("creative_derivation_authority") is True
                    and data.get("canonicalization_authority") is False
                    and data.get("publication_authority") is False
                ):
                    rows.append(data)
            except QuestionIntelligenceError:
                continue
        rows.sort(key=lambda row: str(row.get("cleared_at", "")), reverse=True)
        return rows[0] if rows else None

    def require_current(self, candidate_id: str, review_submission: dict[str, Any],
                        current_package_fingerprint: str) -> dict[str, Any]:
        receipt = self.latest(candidate_id)
        if receipt is None:
            raise QuestionIntelligenceError("candidate has no human creative clearance")
        if receipt.get("review_submission_id") != review_submission.get("review_submission_id"):
            raise QuestionIntelligenceError("creative clearance does not match the latest review submission")
        if receipt.get("package_fingerprint") != current_package_fingerprint:
            raise QuestionIntelligenceError("creative clearance is stale against the current review package")
        if review_submission.get("package_fingerprint") != current_package_fingerprint:
            raise QuestionIntelligenceError("latest editorial review submission is stale")
        return receipt


class CreativeAssetStore:
    """Read-only metadata surface for generated Creative Lab staging assets."""
    def __init__(self, root: str | Path):
        self.root = _safe_root(root, "creative asset")

    def list_assets(self, candidate_id: str, current_fingerprint: str | None = None) -> list[dict[str, Any]]:
        cid = _cid(candidate_id)
        folder = self.root / cid
        if not folder.exists():
            return []
        if folder.is_symlink() or not folder.is_dir():
            raise QuestionIntelligenceError("creative asset candidate directory is invalid")
        output: list[dict[str, Any]] = []
        for path in sorted(folder.glob("asset-*.json")):
            try:
                data = _read_json(path, MAX_ASSET_METADATA_BYTES)
                aid = str(data.get("asset_id") or "")
                if data.get("candidate_id") != cid or aid != path.stem or not ASSET_RE.fullmatch(aid):
                    continue
                request_id = str(data.get("generation_request_id") or "")
                fingerprint = str(data.get("review_package_fingerprint") or "")
                if not GEN_RE.fullmatch(request_id) or not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
                    continue
                filename = Path(str(data.get("file_name") or "")).name
                if not filename or filename != data.get("file_name"):
                    continue
                media = folder / "files" / filename
                if media.is_symlink() or not media.is_file() or media.stat().st_size > MAX_ASSET_BYTES:
                    continue
                expected = str(data.get("sha256") or "")
                digest = hashlib.sha256(media.read_bytes()).hexdigest()
                if expected != digest:
                    continue
                output.append({
                    **data,
                    "file_size": media.stat().st_size,
                    "content_available": True,
                    "stale": bool(current_fingerprint and fingerprint != current_fingerprint),
                    "publication_authority": False,
                })
            except (QuestionIntelligenceError, OSError):
                continue
        output.sort(key=lambda row: str(row.get("created_at", "")))
        return output


class CreativeAnswerWorkspace:
    def __init__(self, root: str | Path, asset_store: CreativeAssetStore,
                 per_candidate_daily_units: int = 6, global_daily_units: int = 30):
        self.root = _safe_root(root, "creative answer")
        self.assets = asset_store
        self.per_candidate_daily_units = max(1, min(int(per_candidate_daily_units), 24))
        self.global_daily_units = max(self.per_candidate_daily_units, min(int(global_daily_units), 120))

    def _candidate_dir(self, candidate_id: str, create: bool = False) -> Path:
        cid = _cid(candidate_id)
        path = self.root / cid
        if path.is_symlink():
            raise QuestionIntelligenceError("symlinked creative workspace is not allowed")
        if create and not path.exists():
            path.mkdir(mode=0o700)
        try:
            resolved = path.resolve(strict=True)
            resolved.relative_to(self.root)
        except (FileNotFoundError, ValueError) as exc:
            raise QuestionIntelligenceError("candidate creative workspace does not exist") from exc
        if not resolved.is_dir():
            raise QuestionIntelligenceError("candidate creative workspace is invalid")
        return resolved

    def _folder(self, candidate_id: str, name: str, create: bool = False) -> Path:
        base = self._candidate_dir(candidate_id, create=create)
        folder = base / name
        if folder.exists() and (folder.is_symlink() or not folder.is_dir()):
            raise QuestionIntelligenceError("creative artifact directory is invalid")
        if create:
            folder.mkdir(mode=0o700, exist_ok=True)
        return folder

    def _list(self, candidate_id: str, folder_name: str, pattern: str,
              id_field: str, regex: re.Pattern[str]) -> list[dict[str, Any]]:
        base = self.root / _cid(candidate_id)
        if not base.exists():
            return []
        folder = self._folder(candidate_id, folder_name)
        if not folder.exists():
            return []
        rows: list[dict[str, Any]] = []
        for path in sorted(folder.glob(pattern)):
            try:
                data = _read_json(path)
                artifact_id = str(data.get(id_field) or "")
                if data.get("candidate_id") == candidate_id and artifact_id == path.stem and regex.fullmatch(artifact_id):
                    rows.append(data)
            except QuestionIntelligenceError:
                continue
        rows.sort(key=lambda row: str(row.get("created_at", "")), reverse=True)
        return rows

    def propose_guide(self, candidate_id: str, profile_role: str, clearance: dict[str, Any],
                      guide_ref: str, guide_label: str, style_profile_id: str,
                      voice_mode: str, rationale: str = "") -> dict[str, Any]:
        role, cid = _role(profile_role), _cid(candidate_id)
        guide_ref = (guide_ref or "").strip().casefold()
        if not SLUG_RE.fullmatch(guide_ref):
            raise QuestionIntelligenceError("guide_ref must be a stable lowercase slug")
        guide_label = clean_text(guide_label, "guide_label", 160)
        style_profile_id = (style_profile_id or "").strip()
        if style_profile_id not in STYLE_PROFILES:
            raise QuestionIntelligenceError("style_profile_id is not an approved Creative Lab profile")
        voice_mode = (voice_mode or "").strip().casefold()
        if voice_mode not in VOICE_MODES:
            raise QuestionIntelligenceError("voice_mode is invalid")
        rationale = clean_text(rationale, "guide rationale", MAX_RATIONALE_CHARS, required=False)
        guide_id = _new_id("guide")
        payload = {
            "schema_version": 1, "artifact_type": "answer_guide_candidate", "guide_proposal_id": guide_id,
            "candidate_id": cid, "guide_ref": guide_ref, "guide_label": guide_label,
            "style_profile_id": style_profile_id, "voice_mode": voice_mode, "rationale": rationale,
            "review_package_fingerprint": clearance["package_fingerprint"],
            "created_by_profile": role, "created_at": _now(),
            "factual_authority": False, "publication_authority": False,
            "trust": "presentation-guide proposal only; factual authority remains with reviewed text and sources",
        }
        _atomic_json(self._folder(cid, "guides", create=True) / f"{guide_id}.json", payload)
        return payload

    def create_script(self, candidate_id: str, profile_role: str, clearance: dict[str, Any],
                      guide_proposal_id: str, duration_seconds: int, beats_json: str,
                      accessibility_text: str, allowed_source_ids: set[str]) -> dict[str, Any]:
        role, cid = _role(profile_role), _cid(candidate_id)
        guides = {row["guide_proposal_id"]: row for row in self._list(cid, "guides", "guide-*.json", "guide_proposal_id", GUIDE_RE)}
        if guide_proposal_id not in guides:
            raise QuestionIntelligenceError("guide_proposal_id does not belong to this candidate")
        if guides[guide_proposal_id].get("review_package_fingerprint") != clearance.get("package_fingerprint"):
            raise QuestionIntelligenceError("guide proposal is stale against the current creative clearance")
        duration_seconds = int(duration_seconds)
        if duration_seconds < 15 or duration_seconds > 30:
            raise QuestionIntelligenceError("doodle script duration must be between 15 and 30 seconds")
        beats = _parse_json_array(beats_json, "beats_json")
        if not beats or len(beats) > MAX_BEATS:
            raise QuestionIntelligenceError(f"doodle script must contain 1-{MAX_BEATS} beats")
        normalized: list[dict[str, Any]] = []
        total_seconds = 0.0
        cited: set[str] = set()
        for index, raw in enumerate(beats, start=1):
            if not isinstance(raw, dict):
                raise QuestionIntelligenceError("each doodle beat must be an object")
            seconds = float(raw.get("seconds", 0))
            if seconds <= 0 or seconds > 12:
                raise QuestionIntelligenceError("each doodle beat needs seconds between 0 and 12")
            claim_type = str(raw.get("claim_type") or "").strip().casefold()
            if claim_type not in CLAIM_TYPES:
                raise QuestionIntelligenceError("beat claim_type must be visual_only or factual_explanation")
            source_ids = raw.get("source_ids") or []
            if not isinstance(source_ids, list) or not all(isinstance(item, str) for item in source_ids):
                raise QuestionIntelligenceError("beat source_ids must be a JSON array of strings")
            unique_ids = list(dict.fromkeys(source_ids))
            if any(sid not in allowed_source_ids for sid in unique_ids):
                raise QuestionIntelligenceError("doodle beat references a source outside the released answer")
            if claim_type == "factual_explanation" and not unique_ids:
                raise QuestionIntelligenceError("factual_explanation beats must cite at least one released source")
            if claim_type == "visual_only" and unique_ids:
                raise QuestionIntelligenceError("visual_only beats must not claim factual source support")
            visual = clean_text(str(raw.get("visual") or ""), "beat visual", 1600)
            narration = clean_text(str(raw.get("narration") or ""), "beat narration", 1200, required=False)
            on_screen = clean_text(str(raw.get("on_screen_text") or ""), "beat on_screen_text", 500, required=False)
            normalized.append({
                "beat": index, "seconds": seconds, "claim_type": claim_type, "visual": visual,
                "narration": narration, "on_screen_text": on_screen, "source_ids": unique_ids,
            })
            total_seconds += seconds
            cited.update(unique_ids)
        if abs(total_seconds - duration_seconds) > 1.0:
            raise QuestionIntelligenceError("sum of beat seconds must match duration_seconds within one second")
        accessibility_text = clean_text(accessibility_text, "accessibility_text", MAX_ACCESSIBILITY_CHARS)
        script_id = _new_id("script")
        payload = {
            "schema_version": 1, "artifact_type": "doodle_script_candidate", "doodle_script_id": script_id,
            "candidate_id": cid, "guide_proposal_id": guide_proposal_id, "duration_seconds": duration_seconds,
            "beats": normalized, "source_ids": sorted(cited), "accessibility_text": accessibility_text,
            "review_package_fingerprint": clearance["package_fingerprint"],
            "created_by_profile": role, "created_at": _now(), "publication_authority": False,
            "trust": "creative script candidate only; factual beats are constrained to released answer sources",
        }
        _atomic_json(self._folder(cid, "scripts", create=True) / f"{script_id}.json", payload)
        return payload

    def create_storyboard(self, candidate_id: str, profile_role: str, clearance: dict[str, Any],
                          doodle_script_id: str, panels_json: str, style_profile_id: str,
                          aspect_ratio: str, accessibility_summary: str) -> dict[str, Any]:
        role, cid = _role(profile_role), _cid(candidate_id)
        scripts = {row["doodle_script_id"]: row for row in self._list(cid, "scripts", "script-*.json", "doodle_script_id", SCRIPT_RE)}
        script = scripts.get(doodle_script_id)
        if not script:
            raise QuestionIntelligenceError("doodle_script_id does not belong to this candidate")
        if script.get("review_package_fingerprint") != clearance.get("package_fingerprint"):
            raise QuestionIntelligenceError("doodle script is stale against the current creative clearance")
        if style_profile_id not in STYLE_PROFILES:
            raise QuestionIntelligenceError("style_profile_id is not an approved Creative Lab profile")
        if aspect_ratio not in ASPECT_RATIOS:
            raise QuestionIntelligenceError("aspect_ratio is not supported")
        panels = _parse_json_array(panels_json, "panels_json")
        if not panels or len(panels) > MAX_PANELS:
            raise QuestionIntelligenceError(f"storyboard must contain 1-{MAX_PANELS} panels")
        normalized: list[dict[str, Any]] = []
        valid_beats = {int(item["beat"]) for item in script.get("beats") or []}
        for index, raw in enumerate(panels, start=1):
            if not isinstance(raw, dict):
                raise QuestionIntelligenceError("each storyboard panel must be an object")
            beat = int(raw.get("beat", 0))
            if beat not in valid_beats:
                raise QuestionIntelligenceError("storyboard panel references an unknown doodle beat")
            normalized.append({
                "panel": index, "beat": beat,
                "shot": clean_text(str(raw.get("shot") or ""), "panel shot", 800),
                "action": clean_text(str(raw.get("action") or ""), "panel action", 1200),
                "composition": clean_text(str(raw.get("composition") or ""), "panel composition", 1000, required=False),
                "transition": clean_text(str(raw.get("transition") or ""), "panel transition", 500, required=False),
                "accent": clean_text(str(raw.get("accent") or ""), "panel accent", 300, required=False),
            })
        accessibility_summary = clean_text(accessibility_summary, "accessibility_summary", MAX_ACCESSIBILITY_CHARS)
        board_id = _new_id("board")
        payload = {
            "schema_version": 1, "artifact_type": "storyboard_candidate", "storyboard_id": board_id,
            "candidate_id": cid, "doodle_script_id": doodle_script_id, "style_profile_id": style_profile_id,
            "aspect_ratio": aspect_ratio, "panels": normalized, "accessibility_summary": accessibility_summary,
            "review_package_fingerprint": clearance["package_fingerprint"],
            "created_by_profile": role, "created_at": _now(), "publication_authority": False,
            "trust": "storyboard candidate only; not a factual source or publishable asset",
        }
        _atomic_json(self._folder(cid, "storyboards", create=True) / f"{board_id}.json", payload)
        return payload

    def _generation_units_today(self, candidate_id: str) -> tuple[int, int]:
        today = datetime.now(timezone.utc).date().isoformat()
        candidate_units = 0
        global_units = 0
        for candidate_folder in self.root.glob("cur-*"):
            if candidate_folder.is_symlink() or not candidate_folder.is_dir():
                continue
            request_folder = candidate_folder / "generation_requests"
            if request_folder.is_symlink() or not request_folder.is_dir():
                continue
            for path in request_folder.glob("gen-*.json"):
                try:
                    data = _read_json(path)
                except QuestionIntelligenceError:
                    continue
                if str(data.get("created_at") or "")[:10] != today:
                    continue
                try:
                    units = int(data.get("candidate_count") or 0)
                except (TypeError, ValueError):
                    continue
                global_units += max(0, units)
                if data.get("candidate_id") == candidate_id:
                    candidate_units += max(0, units)
        return candidate_units, global_units

    def request_generation(self, candidate_id: str, profile_role: str, clearance: dict[str, Any],
                           storyboard_id: str, generation_mode: str, candidate_count: int = 1) -> dict[str, Any]:
        role, cid = _role(profile_role), _cid(candidate_id)
        boards = {row["storyboard_id"]: row for row in self._list(cid, "storyboards", "board-*.json", "storyboard_id", BOARD_RE)}
        board = boards.get(storyboard_id)
        if not board:
            raise QuestionIntelligenceError("storyboard_id does not belong to this candidate")
        if board.get("review_package_fingerprint") != clearance.get("package_fingerprint"):
            raise QuestionIntelligenceError("storyboard is stale against the current creative clearance")
        generation_mode = (generation_mode or "").strip().casefold()
        if generation_mode not in GENERATION_MODES:
            raise QuestionIntelligenceError("generation_mode is not supported")
        candidate_count = int(candidate_count)
        if candidate_count < 1 or candidate_count > 3:
            raise QuestionIntelligenceError("candidate_count must be between 1 and 3")
        candidate_units, global_units = self._generation_units_today(cid)
        if candidate_units + candidate_count > self.per_candidate_daily_units:
            raise QuestionIntelligenceError("per-candidate daily Creative Lab staging quota exceeded")
        if global_units + candidate_count > self.global_daily_units:
            raise QuestionIntelligenceError("global daily Creative Lab staging quota exceeded")
        request_id = _new_id("gen")
        payload = {
            "schema_version": 1, "artifact_type": "creative_lab_generation_request", "generation_request_id": request_id,
            "candidate_id": cid, "storyboard_id": storyboard_id, "generation_mode": generation_mode,
            "candidate_count": candidate_count, "route_hint": "joko/image-standard",
            "status": "queued_for_creative_lab", "queue_only": True,
            "provider_call_executed": False, "review_package_fingerprint": clearance["package_fingerprint"],
            "quota": {
                "per_candidate_daily_units": self.per_candidate_daily_units,
                "global_daily_units": self.global_daily_units,
                "candidate_units_after_request": candidate_units + candidate_count,
                "global_units_after_request": global_units + candidate_count,
            },
            "created_by_profile": role, "created_at": _now(), "publication_authority": False,
            "trust": "provider-neutral Creative Lab staging request only; no provider call is executed by Phase 4E",
        }
        _atomic_json(self._folder(cid, "generation_requests", create=True) / f"{request_id}.json", payload)
        return payload

    def bundle(self, candidate_id: str, profile_role: str, clearance: dict[str, Any]) -> dict[str, Any]:
        _role(profile_role)
        cid = _cid(candidate_id)
        fingerprint = clearance.get("package_fingerprint")
        guides = self._list(cid, "guides", "guide-*.json", "guide_proposal_id", GUIDE_RE)
        scripts = self._list(cid, "scripts", "script-*.json", "doodle_script_id", SCRIPT_RE)
        boards = self._list(cid, "storyboards", "board-*.json", "storyboard_id", BOARD_RE)
        requests = self._list(cid, "generation_requests", "gen-*.json", "generation_request_id", GEN_RE)
        def mark(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
            return [{**row, "stale": row.get("review_package_fingerprint") != fingerprint} for row in rows]
        return {
            "candidate_id": cid,
            "guide_candidates": mark(guides),
            "doodle_script_candidates": mark(scripts),
            "storyboard_candidates": mark(boards),
            "generation_requests": mark(requests),
            "staging_assets": self.assets.list_assets(cid, str(fingerprint or "")),
            "creative_clearance_id": clearance.get("clearance_id"),
            "publication_authority": False,
            "trust": "creative staging bundle only; human creative review is still required",
        }
