"""Utilities for evaluation cache identity and freshness checks."""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Dict, Optional


def _to_utc_datetime(raw: Any) -> Optional[datetime]:
    """Parse datetime-like values and normalize to UTC."""
    if not raw:
        return None

    if isinstance(raw, datetime):
        dt = raw
    elif isinstance(raw, str):
        candidate = raw.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(candidate)
        except ValueError:
            return None
    else:
        return None

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _artifact_signature(record: Dict[str, Any]) -> str:
    """Create a stable signature for a model/dataset artifact record."""
    return "|".join(
        [
            str(record.get("id") or ""),
            str(record.get("file_path") or ""),
            str(record.get("file_size") or ""),
            str(record.get("uploaded_at") or ""),
        ]
    )


def build_pair_cache_id(model: Dict[str, Any], dataset: Dict[str, Any]) -> str:
    """Build deterministic cache id for a model+dataset artifact pair."""
    payload = f"{_artifact_signature(model)}||{_artifact_signature(dataset)}"
    return sha256(payload.encode("utf-8")).hexdigest()


def is_cache_fresh(
    cached_evaluation: Dict[str, Any],
    model: Dict[str, Any],
    dataset: Dict[str, Any],
    expected_pair_cache_id: str,
) -> bool:
    """
    Validate that a cached evaluation still matches current artifacts.

    Preferred strategy uses stored pair_cache_id inside strict_result. If unavailable
    (legacy rows), fallback uses evaluated_at >= uploaded_at timestamps.
    """
    strict_result = cached_evaluation.get("strict_result")
    if isinstance(strict_result, dict):
        stored_pair_id = strict_result.get("pair_cache_id")
        if stored_pair_id:
            return stored_pair_id == expected_pair_cache_id

    evaluated_at = _to_utc_datetime(cached_evaluation.get("evaluated_at"))
    model_uploaded_at = _to_utc_datetime(model.get("uploaded_at"))
    dataset_uploaded_at = _to_utc_datetime(dataset.get("uploaded_at"))

    if not evaluated_at:
        return False
    if model_uploaded_at and evaluated_at < model_uploaded_at:
        return False
    if dataset_uploaded_at and evaluated_at < dataset_uploaded_at:
        return False

    return True
