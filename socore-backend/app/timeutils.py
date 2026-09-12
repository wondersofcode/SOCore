"""
One robust timestamp parser for every report/window calculation in the
backend (AI Shift Summary, its Excel export, hourly buckets, ...).

Timestamps reach this codebase in several shapes, because `Alert.timestamp`/
`Event.timestamp` are stored verbatim from whatever the source sent:
  - naive UTC, no marker at all:        "2026-09-11 10:14:40"
  - naive UTC, ISO separator:           "2026-09-11T10:14:40"
  - ISO 8601 with a colon'd offset:     "2026-09-11T10:14:40.123456+00:00"
  - Wazuh's own ISO offset (no colon):  "2026-09-11T17:52:09.021+0000"
  - ISO 8601 with a 'Z' suffix:         "2026-09-11T17:52:09Z"
  - any other timezone-aware offset:    "2026-09-11T14:52:09+05:00"

`datetime.fromisoformat` on Python 3.11+ already accepts most of these, but
older interpreters don't — so every shape is normalized by hand before being
handed to it, rather than relying on interpreter-specific leniency. The
result is always an aware UTC datetime: a timestamp with no zone marker is
*never* assumed to be in the analyst's local/display timezone, only ever UTC.
Display-side timezone conversion belongs entirely to the frontend
(see dateFormat.ts), never here.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

_TRAILING_OFFSET_NO_COLON = re.compile(r"([+-]\d{2})(\d{2})$")


def parse_timestamp(ts: str | None) -> datetime | None:
    """Parse any timestamp shape used across SOCore into an aware UTC
    datetime, or None if `ts` is empty/unparseable."""
    if not ts:
        return None
    s = ts.strip()
    if not s:
        return None

    # Naive "YYYY-MM-DD HH:MM:SS" -> ISO's 'T' separator.
    if "T" not in s and " " in s:
        s = s.replace(" ", "T", 1)

    # 'Z' suffix -> explicit +00:00 offset.
    if s.endswith("Z") or s.endswith("z"):
        s = s[:-1] + "+00:00"

    # Offset with no colon (Wazuh's native "+0000") -> insert one so this
    # parses identically on every Python version, not just 3.11+.
    s = _TRAILING_OFFSET_NO_COLON.sub(r"\1:\2", s)

    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def within_last_hours(ts: str | None, hours: int, *, now: datetime | None = None) -> bool:
    """True if `ts` parses and falls within the last `hours` hours of `now`
    (defaults to the current UTC instant)."""
    dt = parse_timestamp(ts)
    if dt is None:
        return False
    reference = now or datetime.now(timezone.utc)
    cutoff = reference.timestamp() - hours * 3600
    return dt.timestamp() >= cutoff
