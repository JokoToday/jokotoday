#!/usr/bin/env python3
"""Phase 4F candidate-stage host relationships and embed presentation workspace."""
from __future__ import annotations

import fcntl
import json
import os
import re
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from joko_question_intelligence import QuestionIntelligenceError, clean_text

MAX_FILE_BYTES = 256 * 1024
MAX_RATIONALE_CHARS = 6000
MAX_LABEL_CHARS = 160
MAX_CTA_LABEL_CHARS = 120
CID_RE = re.compile(r"^cur-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
HOSTREL_RE = re.compile(r"^hostrel-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
EMBED_RE = re.compile(r"^embed-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
HOST_ID_RE = re.compile(r"^[a-z0-9][a-z0-9._:-]{0,127}$")
FINGERPRINT_RE = re.compile(r"^[0-9a-f]{64}$")
RELATIONSHIP_KINDS = {"featured_on", "context_for", "explains", "related_to", "originated_at"}
HOST_DOMAINS = {"site", "page", "product", "place"}
ALLOWED_SITE_IDS = {"joko-today"}
KNOWN_PAGE_IDS = {"homepage", "curiosity-notebook", "how-it-works", "products", "about"}
EMBED_ROLES = {"editorial", "creative"}
LANGUAGES = {"auto", "en", "th", "zh"}
THEMES = {"paper", "mineral", "neutral"}
FEATURE_KEYS = {
    "show_asker", "show_guide", "show_animation", "show_text_answer",
    "show_sources", "show_related", "show_wonder_signal", "show_host_cta",
}

PRESETS: dict[str, dict[str, Any]] = {
    "notebook-card": {
        "label": "Notebook card",
        "react_variant": "compact",
        "features": {
            "show_asker": False, "show_guide": True, "show_animation": False,
            "show_text_answer": True, "show_sources": False, "show_related": True,
            "show_wonder_signal": True, "show_host_cta": False,
        },
    },
    "homepage-feature": {
        "label": "Homepage feature",
        "react_variant": "homepage-explainer",
        "features": {
            "show_asker": False, "show_guide": True, "show_animation": True,
            "show_text_answer": True, "show_sources": False, "show_related": False,
            "show_wonder_signal": True, "show_host_cta": True,
        },
    },
    "product-context": {
        "label": "Product context",
        "react_variant": "compact",
        "features": {
            "show_asker": False, "show_guide": True, "show_animation": False,
            "show_text_answer": True, "show_sources": False, "show_related": True,
            "show_wonder_signal": True, "show_host_cta": False,
        },
    },
    "inline-answer": {
        "label": "Inline answer",
        "react_variant": "compact",
        "features": {
            "show_asker": False, "show_guide": False, "show_animation": False,
            "show_text_answer": True, "show_sources": False, "show_related": False,
            "show_wonder_signal": False, "show_host_cta": False,
        },
    },
    "how-it-works": {
        "label": "How it works",
        "react_variant": "homepage-explainer",
        "features": {
            "show_asker": False, "show_guide": True, "show_animation": True,
            "show_text_answer": True, "show_sources": False, "show_related": False,
            "show_wonder_signal": False, "show_host_cta": True,
        },
    },
}


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
    if role not in EMBED_ROLES:
        raise QuestionIntelligenceError("profile role is not allowed for Phase 4F")
    return role


def _fingerprint(value: str) -> str:
    value = (value or "").strip().casefold()
    if not FINGERPRINT_RE.fullmatch(value):
        raise QuestionIntelligenceError("review package fingerprint is invalid")
    return value


def _safe_root(root: str | Path) -> Path:
    path = Path(root).expanduser()
    if not path.is_absolute() or path.is_symlink() or not path.is_dir():
        raise QuestionIntelligenceError("host/embed root must be an absolute ordinary directory")
    return path.resolve(strict=True)


def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
    data = (json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")
    if len(data) > MAX_FILE_BYTES:
        raise QuestionIntelligenceError("Phase 4F artifact exceeds size limit")
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
        raise QuestionIntelligenceError("Phase 4F artifact is invalid")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise QuestionIntelligenceError("Phase 4F artifact is malformed") from exc
    if not isinstance(value, dict):
        raise QuestionIntelligenceError("Phase 4F artifact must be a JSON object")
    return value


def _relative_path(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    if not value.startswith("/") or value.startswith("//") or "://" in value or "\\" in value:
        raise QuestionIntelligenceError("host/CTA path must be a site-relative path")
    if any(ord(ch) < 32 for ch in value):
        raise QuestionIntelligenceError("host/CTA path contains control characters")
    return value[:500]


def _host_id(value: str) -> str:
    value = (value or "").strip().casefold()
    if not HOST_ID_RE.fullmatch(value):
        raise QuestionIntelligenceError("host_id must be a stable lowercase identifier")
    return value


def _parse_overrides(value: str) -> dict[str, bool]:
    value = (value or "").strip()
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise QuestionIntelligenceError("feature_overrides_json must be valid JSON") from exc
    if not isinstance(parsed, dict):
        raise QuestionIntelligenceError("feature_overrides_json must be a JSON object")
    unknown = set(parsed) - FEATURE_KEYS
    if unknown:
        raise QuestionIntelligenceError("unknown embed feature override: " + ", ".join(sorted(unknown)))
    if not all(isinstance(item, bool) for item in parsed.values()):
        raise QuestionIntelligenceError("embed feature overrides must be booleans")
    return dict(parsed)


class HostEmbedWorkspace:
    """Candidate-only presentation relationships. Never mutates canonical Curiosities or production pages."""

    def __init__(self, root: str | Path):
        self.root = _safe_root(root)
        self.lock_path = self.root / ".phase4f.lock"

    @contextmanager
    def _lock(self) -> Iterator[None]:
        fd = os.open(self.lock_path, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            yield
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)

    def _candidate_dir(self, candidate_id: str, create: bool = False) -> Path:
        cid = _cid(candidate_id)
        path = self.root / cid
        if path.is_symlink():
            raise QuestionIntelligenceError("symlinked host/embed workspace is not allowed")
        if create and not path.exists():
            path.mkdir(mode=0o700)
        try:
            resolved = path.resolve(strict=True)
            resolved.relative_to(self.root)
        except (FileNotFoundError, ValueError) as exc:
            raise QuestionIntelligenceError("candidate host/embed workspace does not exist") from exc
        if not resolved.is_dir():
            raise QuestionIntelligenceError("candidate host/embed workspace is invalid")
        return resolved

    def _folder(self, candidate_id: str, name: str, create: bool = False) -> Path:
        base = self._candidate_dir(candidate_id, create=create)
        folder = base / name
        if folder.exists() and (folder.is_symlink() or not folder.is_dir()):
            raise QuestionIntelligenceError("host/embed artifact directory is invalid")
        if create:
            folder.mkdir(mode=0o700, exist_ok=True)
        return folder

    def _rows(self, candidate_id: str, folder_name: str, pattern: str,
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
            except QuestionIntelligenceError:
                continue
            artifact_id = str(data.get(id_field) or "")
            if data.get("candidate_id") == candidate_id and artifact_id == path.stem and regex.fullmatch(artifact_id):
                rows.append(data)
        rows.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
        return rows

    def _relationship(self, candidate_id: str, relationship_id: str) -> dict[str, Any]:
        if not HOSTREL_RE.fullmatch((relationship_id or "").strip()):
            raise QuestionIntelligenceError("host_relationship_id is invalid")
        path = self._folder(candidate_id, "relationships") / f"{relationship_id}.json"
        data = _read_json(path)
        if data.get("candidate_id") != candidate_id or data.get("host_relationship_id") != relationship_id:
            raise QuestionIntelligenceError("host relationship metadata mismatch")
        return data

    def _embed(self, candidate_id: str, embed_id: str) -> dict[str, Any]:
        if not EMBED_RE.fullmatch((embed_id or "").strip()):
            raise QuestionIntelligenceError("embed_candidate_id is invalid")
        path = self._folder(candidate_id, "embeds") / f"{embed_id}.json"
        data = _read_json(path)
        if data.get("candidate_id") != candidate_id or data.get("embed_candidate_id") != embed_id:
            raise QuestionIntelligenceError("embed candidate metadata mismatch")
        return data

    def create_host_relationship(self, candidate_id: str, profile_role: str,
                                 package_fingerprint: str, review_submission_id: str,
                                 source_scope: str, host_site_id: str, host_domain: str,
                                 host_id: str, relationship_kind: str,
                                 host_label: str = "", host_path: str = "",
                                 rationale: str = "") -> dict[str, Any]:
        role, cid = _role(profile_role), _cid(candidate_id)
        if role != "editorial":
            raise QuestionIntelligenceError("only editorial can create host relationship candidates")
        fingerprint = _fingerprint(package_fingerprint)
        host_site_id = _host_id(host_site_id)
        if host_site_id not in ALLOWED_SITE_IDS:
            raise QuestionIntelligenceError("Phase 4F pilot only accepts registered JOKO host sites")
        host_domain = (host_domain or "").strip().casefold()
        if host_domain not in HOST_DOMAINS:
            raise QuestionIntelligenceError("host_domain must be site, page, product, or place")
        host_id = _host_id(host_id)
        if host_domain == "site" and host_id != host_site_id:
            raise QuestionIntelligenceError("site relationship host_id must equal host_site_id")
        if host_domain == "page" and host_id not in KNOWN_PAGE_IDS:
            raise QuestionIntelligenceError("page host_id is not in the Phase 4F JOKO page registry")
        relationship_kind = (relationship_kind or "").strip().casefold()
        if relationship_kind not in RELATIONSHIP_KINDS:
            raise QuestionIntelligenceError("relationship_kind is not supported")
        source_scope = (source_scope or "").strip().casefold()
        if source_scope not in {"shared", "joko"}:
            raise QuestionIntelligenceError("source_scope must be shared or joko")
        host_label = clean_text(host_label, "host_label", MAX_LABEL_CHARS, required=False)
        host_path = _relative_path(host_path)
        rationale = clean_text(rationale, "host relationship rationale", MAX_RATIONALE_CHARS, required=False)
        host = {
            "site_id": host_site_id, "domain": host_domain, "id": host_id,
            "label": host_label or None, "path": host_path or None,
            "existence_verified": host_domain in {"site", "page"},
        }
        with self._lock():
            existing = self._rows(cid, "relationships", "hostrel-*.json", "host_relationship_id", HOSTREL_RE)
            for row in existing:
                if (
                    row.get("review_package_fingerprint") == fingerprint
                    and row.get("host") == host
                    and row.get("relationship_kind") == relationship_kind
                ):
                    raise QuestionIntelligenceError("duplicate current host relationship candidate")
            relationship_id = _new_id("hostrel")
            payload = {
                "schema_version": 1,
                "artifact_type": "host_relationship_candidate",
                "host_relationship_id": relationship_id,
                "candidate_id": cid,
                "source_scope": source_scope,
                "host": host,
                "relationship_kind": relationship_kind,
                "rationale": rationale,
                "review_submission_id": (review_submission_id or "").strip(),
                "review_package_fingerprint": fingerprint,
                "created_by_profile": role,
                "created_at": _now(),
                "status": "candidate",
                "canonical_episode_mutation": False,
                "publication_authority": False,
                "trust": "host-local presentation relationship candidate only; shared Curiosity portability is unchanged",
            }
            _atomic_json(self._folder(cid, "relationships", create=True) / f"{relationship_id}.json", payload)
            return payload

    def list_host_relationships(self, candidate_id: str, profile_role: str,
                                current_fingerprint: str) -> dict[str, Any]:
        _role(profile_role)
        cid = _cid(candidate_id)
        fingerprint = _fingerprint(current_fingerprint)
        rows = self._rows(cid, "relationships", "hostrel-*.json", "host_relationship_id", HOSTREL_RE)
        return {
            "candidate_id": cid,
            "relationships": [{**row, "stale": row.get("review_package_fingerprint") != fingerprint} for row in rows],
            "count": len(rows),
            "canonical_episode_mutation": False,
            "publication_authority": False,
        }

    def preset_list(self, profile_role: str) -> dict[str, Any]:
        _role(profile_role)
        return {
            "presets": [
                {"preset_id": key, **value}
                for key, value in PRESETS.items()
            ],
            "languages": sorted(LANGUAGES),
            "themes": sorted(THEMES),
            "renderer": "native-react-contract",
            "publication_authority": False,
        }

    def create_embed(self, candidate_id: str, profile_role: str, current_fingerprint: str,
                     review_submission_id: str, host_relationship_id: str,
                     preset_id: str, feature_overrides_json: str = "",
                     language: str = "auto", theme: str = "paper",
                     cta_label: str = "", cta_path: str = "") -> dict[str, Any]:
        role, cid = _role(profile_role), _cid(candidate_id)
        fingerprint = _fingerprint(current_fingerprint)
        relationship = self._relationship(cid, host_relationship_id)
        if relationship.get("review_package_fingerprint") != fingerprint:
            raise QuestionIntelligenceError("host relationship is stale against the current review package")
        preset_id = (preset_id or "").strip().casefold()
        preset = PRESETS.get(preset_id)
        if not preset:
            raise QuestionIntelligenceError("embed preset is not approved")
        language = (language or "auto").strip().casefold()
        theme = (theme or "paper").strip().casefold()
        if language not in LANGUAGES:
            raise QuestionIntelligenceError("embed language is not supported")
        if theme not in THEMES:
            raise QuestionIntelligenceError("embed theme is not supported")
        features = dict(preset["features"])
        features.update(_parse_overrides(feature_overrides_json))
        cta_label = clean_text(cta_label, "cta_label", MAX_CTA_LABEL_CHARS, required=False)
        cta_path = _relative_path(cta_path)
        if not features["show_host_cta"] and (cta_label or cta_path):
            raise QuestionIntelligenceError("CTA content requires show_host_cta=true")
        if features["show_host_cta"] and bool(cta_label) != bool(cta_path):
            raise QuestionIntelligenceError("host CTA requires both cta_label and cta_path, or neither")
        config = {
            "preset_id": preset_id,
            "react_variant": preset["react_variant"],
            "features": features,
            "language": language,
            "theme": theme,
            "host_cta": {"label": cta_label, "path": cta_path} if cta_label else None,
        }
        with self._lock():
            existing = self._rows(cid, "embeds", "embed-*.json", "embed_candidate_id", EMBED_RE)
            for row in existing:
                if (
                    row.get("review_package_fingerprint") == fingerprint
                    and row.get("host_relationship_id") == host_relationship_id
                    and row.get("config") == config
                ):
                    raise QuestionIntelligenceError("duplicate current embed candidate")
            embed_id = _new_id("embed")
            payload = {
                "schema_version": 1,
                "artifact_type": "curiosity_embed_candidate",
                "embed_candidate_id": embed_id,
                "candidate_id": cid,
                "host_relationship_id": host_relationship_id,
                "host": relationship.get("host"),
                "relationship_kind": relationship.get("relationship_kind"),
                "config": config,
                "review_submission_id": (review_submission_id or "").strip(),
                "review_package_fingerprint": fingerprint,
                "created_by_profile": role,
                "created_at": _now(),
                "status": "candidate",
                "renderer_contract_only": True,
                "html_or_script_generated": False,
                "canonical_episode_mutation": False,
                "publication_authority": False,
                "trust": "presentation candidate only; not an activated embed or publication action",
            }
            _atomic_json(self._folder(cid, "embeds", create=True) / f"{embed_id}.json", payload)
            return payload

    def list_embeds(self, candidate_id: str, profile_role: str,
                    current_fingerprint: str) -> dict[str, Any]:
        _role(profile_role)
        cid = _cid(candidate_id)
        fingerprint = _fingerprint(current_fingerprint)
        rows = self._rows(cid, "embeds", "embed-*.json", "embed_candidate_id", EMBED_RE)
        return {
            "candidate_id": cid,
            "embeds": [{**row, "stale": row.get("review_package_fingerprint") != fingerprint} for row in rows],
            "count": len(rows),
            "publication_authority": False,
        }

    def preview(self, candidate_id: str, profile_role: str,
                current_fingerprint: str, embed_candidate_id: str) -> dict[str, Any]:
        _role(profile_role)
        cid = _cid(candidate_id)
        fingerprint = _fingerprint(current_fingerprint)
        embed = self._embed(cid, embed_candidate_id)
        relationship = self._relationship(cid, str(embed.get("host_relationship_id") or ""))
        stale = (
            embed.get("review_package_fingerprint") != fingerprint
            or relationship.get("review_package_fingerprint") != fingerprint
        )
        config = embed.get("config") or {}
        return {
            "candidate_id": cid,
            "embed_candidate_id": embed_candidate_id,
            "stale": stale,
            "renderable_for_review": not stale,
            "renderer_contract": {
                "renderer": "CuriosityEmbed",
                "implementation": "native-react",
                "variant": config.get("react_variant"),
                "locale": config.get("language"),
                "theme": config.get("theme"),
                "features": config.get("features"),
                "host_cta": config.get("host_cta"),
                "host": embed.get("host"),
            },
            "html": None,
            "script": None,
            "iframe": None,
            "external_embed_code": False,
            "canonical_episode_mutation": False,
            "publication_authority": False,
            "trust": "deterministic preview contract only; a host application must render and publish separately",
        }
