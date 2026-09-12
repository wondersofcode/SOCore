"""
Regression tests for the shared timestamp parser (app/timeutils.py).

This is the exact bug from production: the AI Shift Summary and its Excel
export reported 0 alerts for a 24h window that visibly had real alerts on
the Alerts page, because the old parser only accepted naive
"YYYY-MM-DD HH:MM:SS" strings and silently dropped every other shape
(including Wazuh's real "+0000"-offset ISO timestamps).
"""
from datetime import datetime, timedelta, timezone

from app.timeutils import parse_timestamp, within_last_hours


def test_naive_utc_no_marker():
    dt = parse_timestamp("2026-09-11 10:14:40")
    assert dt == datetime(2026, 9, 11, 10, 14, 40, tzinfo=timezone.utc)


def test_naive_iso_t_separator():
    dt = parse_timestamp("2026-09-11T10:14:40")
    assert dt == datetime(2026, 9, 11, 10, 14, 40, tzinfo=timezone.utc)


def test_iso_with_colon_offset():
    dt = parse_timestamp("2026-09-11T10:14:40.123456+00:00")
    assert dt == datetime(2026, 9, 11, 10, 14, 40, 123456, tzinfo=timezone.utc)


def test_wazuh_native_offset_no_colon():
    # The exact shape reported broken in production.
    dt = parse_timestamp("2026-09-11T17:52:09.021+0000")
    assert dt == datetime(2026, 9, 11, 17, 52, 9, 21000, tzinfo=timezone.utc)


def test_z_suffix():
    dt = parse_timestamp("2026-09-11T17:52:09Z")
    assert dt == datetime(2026, 9, 11, 17, 52, 9, tzinfo=timezone.utc)


def test_timezone_aware_non_utc_normalizes_to_utc():
    dt = parse_timestamp("2026-09-11T14:52:09+05:00")
    assert dt == datetime(2026, 9, 11, 9, 52, 9, tzinfo=timezone.utc)
    assert dt.tzinfo == timezone.utc


def test_negative_offset_no_colon():
    dt = parse_timestamp("2026-09-11T05:00:00-0500")
    assert dt == datetime(2026, 9, 11, 10, 0, 0, tzinfo=timezone.utc)


def test_empty_and_none_return_none():
    assert parse_timestamp("") is None
    assert parse_timestamp(None) is None


def test_garbage_returns_none():
    assert parse_timestamp("not-a-timestamp") is None


def test_within_last_hours_inside_window():
    now = datetime(2026, 9, 12, 12, 0, 0, tzinfo=timezone.utc)
    ts = (now - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S")
    assert within_last_hours(ts, 24, now=now) is True


def test_within_last_hours_outside_window():
    now = datetime(2026, 9, 12, 12, 0, 0, tzinfo=timezone.utc)
    ts = (now - timedelta(hours=30)).strftime("%Y-%m-%d %H:%M:%S")
    assert within_last_hours(ts, 24, now=now) is False


def test_within_last_hours_wazuh_offset_inside_window():
    now = datetime(2026, 9, 12, 12, 0, 0, tzinfo=timezone.utc)
    inside = now - timedelta(hours=1)
    ts = inside.strftime("%Y-%m-%dT%H:%M:%S.000+0000")
    assert within_last_hours(ts, 24, now=now) is True


def test_within_last_hours_just_outside_boundary():
    now = datetime(2026, 9, 12, 12, 0, 0, tzinfo=timezone.utc)
    ts = (now - timedelta(hours=24, minutes=1)).strftime("%Y-%m-%d %H:%M:%S")
    assert within_last_hours(ts, 24, now=now) is False
