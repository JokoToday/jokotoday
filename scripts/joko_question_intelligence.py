#!/usr/bin/env python3
"""Pure Phase 4C helpers: possible duplicates and SPARK question discovery."""
from __future__ import annotations

import re
from typing import Any, Iterable

MAX_QUESTION_CHARS = 2000
MAX_TOPIC_CHARS = 160
MAX_SPARK_CONTEXT_CHARS = 8000
MAX_SPARK_BATCH = 12
SPARK_MODES = {
    "never_asked", "childlike", "counterintuitive", "expert_blind_spot",
    "local_observation", "product_adjacent", "seasonal",
}


class QuestionIntelligenceError(ValueError):
    pass


def clean_text(value: str, name: str, maximum: int, required: bool = True) -> str:
    cleaned = (value or "").replace("\x00", "").strip()
    if required and not cleaned:
        raise QuestionIntelligenceError(f"{name} is required")
    if len(cleaned) > maximum:
        raise QuestionIntelligenceError(f"{name} exceeds {maximum} characters")
    return cleaned


def question_tokens(text: str) -> set[str]:
    stop = {
        "a", "an", "and", "are", "as", "at", "be", "but", "by", "do", "does",
        "for", "from", "how", "i", "in", "is", "it", "of", "on", "or", "the",
        "to", "we", "what", "when", "where", "which", "why", "with", "you",
    }
    words = re.findall(r"[\w'-]+", (text or "").casefold(), flags=re.UNICODE)
    return {word for word in words if len(word) > 1 and word not in stop}


def possible_duplicate_score(left: str, right: str) -> float:
    """Lexical retrieval signal only; never a semantic-equivalence verdict."""
    a, b = question_tokens(left), question_tokens(right)
    if not a or not b:
        return 0.0
    overlap = len(a & b)
    jaccard = overlap / len(a | b)
    containment = overlap / min(len(a), len(b))
    return round((0.65 * jaccard) + (0.35 * containment), 4)


def rank_possible_duplicates(
    question: str,
    items: Iterable[dict[str, Any]],
    limit: int = 5,
    minimum_score: float = 0.18,
) -> list[dict[str, Any]]:
    question = clean_text(question, "question", MAX_QUESTION_CHARS)
    limit = max(1, min(int(limit), 20))
    ranked: list[dict[str, Any]] = []
    for item in items:
        other = str(item.get("question", "")).strip()
        if not other:
            continue
        score = possible_duplicate_score(question, other)
        if score >= minimum_score:
            ranked.append({
                "id": item.get("id"), "kind": item.get("kind", "unknown"),
                "scope": item.get("scope"), "question": other, "score": score,
            })
    ranked.sort(key=lambda entry: (-float(entry["score"]), str(entry.get("id") or "")))
    return ranked[:limit]


def build_spark_brief(mode: str, topic: str = "", context: str = "", count: int = 8) -> dict[str, Any]:
    """SPARK generates questions only; it is never factual authority."""
    mode = (mode or "").strip().casefold()
    if mode not in SPARK_MODES:
        raise QuestionIntelligenceError("unknown SPARK mode")
    topic = clean_text(topic, "topic", MAX_TOPIC_CHARS, required=False)
    context = clean_text(context, "context", MAX_SPARK_CONTEXT_CHARS, required=False)
    count = max(1, min(int(count), MAX_SPARK_BATCH))
    prompts = {
        "never_asked": "Find questions people rarely think to ask but would enjoy understanding.",
        "childlike": "Ask simple questions with childlike curiosity that adults often overlook.",
        "counterintuitive": "Look for surprising reversals, contradictions, and counter-intuitive effects.",
        "expert_blind_spot": "Find beginner questions that experts may forget need explaining.",
        "local_observation": "Turn real local observations into questions without inventing local facts.",
        "product_adjacent": "Ask useful questions around a product or practice without sales copy.",
        "seasonal": "Find questions naturally prompted by a season or recurring calendar context.",
    }
    return {
        "role": "SPARK", "mode": mode, "count": count,
        "topic": topic or None, "context": context or None,
        "instruction": prompts[mode],
        "rules": [
            "Return questions only; do not answer them.",
            "Prefer unusual, specific, understandable questions over generic brainstorm items.",
            "Do not present guesses as facts.",
            "Do not include private customer identity or account information.",
            "Every output is only a Curiosity candidate; it has no publication authority.",
        ],
    }


def validate_spark_questions(questions: list[str], mode: str) -> list[dict[str, Any]]:
    brief = build_spark_brief(mode, count=len(questions) or 1)
    if not questions or len(questions) > MAX_SPARK_BATCH:
        raise QuestionIntelligenceError(f"SPARK batches must contain 1-{MAX_SPARK_BATCH} questions")
    seen: set[str] = set()
    output: list[dict[str, Any]] = []
    for raw in questions:
        question = clean_text(raw, "SPARK question", MAX_QUESTION_CHARS)
        if "\n" in question or "\r" in question:
            raise QuestionIntelligenceError("SPARK questions must be single-line text")
        if not question.rstrip().endswith(("?", "？")):
            raise QuestionIntelligenceError("SPARK output must be an explicit question ending in '?' or '？'")
        key = re.sub(r"\s+", " ", question.casefold()).strip().rstrip("?？").strip()
        if key in seen:
            raise QuestionIntelligenceError("SPARK batch contains duplicate questions")
        seen.add(key)
        output.append({
            "question": question,
            "origin_type": "spark_discovery",
            "spark_mode": brief["mode"],
            "trust": "question candidate only; SPARK is not factual authority",
        })
    return output
