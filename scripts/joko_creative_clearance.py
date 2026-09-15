#!/usr/bin/env python3
"""Root/admin helper to record human clearance for Phase 4E creative derivation."""
from __future__ import annotations

import argparse
import grp
import json
import os
from pathlib import Path

from joko_creative_answer_workspace import create_clearance_receipt
from joko_question_intelligence import QuestionIntelligenceError

DEFAULT_REVIEW_ROOT = Path("/home/jokotoday/workspace/candidates/curiosity-review")
DEFAULT_RELEASE_ROOT = Path("/srv/joko/creative/clearances")


def latest_submission(review_root: Path, candidate_id: str) -> dict:
    folder = review_root / candidate_id / "submissions"
    if folder.is_symlink() or not folder.is_dir():
        raise QuestionIntelligenceError("candidate has no review submissions")
    rows = []
    for path in folder.glob("rev-*.json"):
        if path.is_symlink() or not path.is_file() or path.stat().st_size > 256 * 1024:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(data, dict) and data.get("candidate_id") == candidate_id and data.get("review_submission_id") == path.stem:
            rows.append(data)
    rows.sort(key=lambda row: str(row.get("submitted_at", "")), reverse=True)
    if not rows:
        raise QuestionIntelligenceError("candidate has no valid review submissions")
    return rows[0]


def main() -> int:
    parser = argparse.ArgumentParser(description="Record human clearance for staging creative derivation only")
    parser.add_argument("candidate_id")
    parser.add_argument("--note", default="")
    parser.add_argument("--review-root", default=str(DEFAULT_REVIEW_ROOT))
    parser.add_argument("--release-root", default=str(DEFAULT_RELEASE_ROOT))
    args = parser.parse_args()
    if os.geteuid() != 0:
        print("creative-clearance: run as root", file=os.sys.stderr)
        return 1
    review_root = Path(args.review_root).expanduser().resolve(strict=True)
    release_root = Path(args.release_root).expanduser().resolve(strict=True)
    submission = latest_submission(review_root, args.candidate_id)
    human = os.environ.get("SUDO_USER") or os.environ.get("USER") or "human-admin"
    receipt = create_clearance_receipt(release_root, args.candidate_id, submission, f"human-admin:{human}", args.note)
    candidate_dir = release_root / args.candidate_id
    gid = grp.getgrnam("jokotoday").gr_gid
    os.chown(candidate_dir, 0, gid)
    os.chmod(candidate_dir, 0o750)
    receipt_path = candidate_dir / f"{receipt['clearance_id']}.json"
    os.chown(receipt_path, 0, gid)
    os.chmod(receipt_path, 0o440)
    print(json.dumps({
        "candidate_id": args.candidate_id,
        "clearance_id": receipt["clearance_id"],
        "review_submission_id": receipt["review_submission_id"],
        "creative_derivation_only": True,
        "canonicalization_authority": False,
        "publication_authority": False,
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
