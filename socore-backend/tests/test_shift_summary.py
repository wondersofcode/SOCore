"""
Regression tests for the 24h (and 8h/12h) report window — the actual
production bug: real alerts existed on the Alerts page, but
windowed_alerts()/windowed_cases() silently dropped them because they used
timestamp shapes the old naive-only parser couldn't read.
"""
from datetime import datetime, timedelta, timezone

from app.models import Alert, AlertStatus, Case, CaseStatus, Severity
from app.shift_summary import windowed_alerts, windowed_cases

# windowed_alerts()/windowed_cases() cut off relative to the real wall clock
# (datetime.now(timezone.utc)), not an injectable clock — so every fixture
# timestamp here is built relative to the real "now" at test run time, not a
# fixed constant, or boundary-sensitive assertions would be flaky.
NOW = datetime.now(timezone.utc)


def _alert(id_: str, timestamp: str, **overrides) -> Alert:
    return Alert(
        id=id_,
        timestamp=timestamp,
        severity=overrides.pop("severity", Severity.medium),
        sourceIP="10.0.0.1",
        attackType="Brute Force",
        mitreId="T1110",
        mitreName="Brute Force",
        status=overrides.pop("status", AlertStatus.new),
        **overrides,
    )


def _case(id_: str, created_at: str) -> Case:
    return Case(
        id=id_,
        title="Test case",
        severity=Severity.medium,
        status=CaseStatus.open,
        createdAt=created_at,
        updatedAt=created_at,
    )


def _hours_ago(hours: float, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    return (NOW - timedelta(hours=hours)).strftime(fmt)


def test_naive_utc_alert_inside_window_counts():
    alerts = [_alert("A1", _hours_ago(2))]
    assert len(windowed_alerts(alerts, 24)) == 1


def test_wazuh_offset_alert_inside_window_counts():
    ts = (NOW - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S.000+0000")
    alerts = [_alert("A1", ts)]
    assert len(windowed_alerts(alerts, 24)) == 1


def test_z_suffix_alert_inside_window_counts():
    ts = (NOW - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
    alerts = [_alert("A1", ts)]
    assert len(windowed_alerts(alerts, 24)) == 1


def test_iso_colon_offset_alert_inside_window_counts():
    ts = (NOW - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    alerts = [_alert("A1", ts)]
    assert len(windowed_alerts(alerts, 24)) == 1


def test_timezone_aware_non_utc_alert_inside_window_counts():
    # 3 hours before NOW (UTC), expressed in a +05:00 local offset instead of UTC.
    local = (NOW - timedelta(hours=3)).astimezone(timezone(timedelta(hours=5)))
    ts = local.strftime("%Y-%m-%dT%H:%M:%S+05:00")
    alerts = [_alert("A1", ts)]
    assert len(windowed_alerts(alerts, 24)) == 1


def test_alert_outside_window_excluded():
    alerts = [_alert("A1", _hours_ago(30))]
    assert len(windowed_alerts(alerts, 24)) == 0


def test_mixed_shapes_only_in_window_ones_counted():
    alerts = [
        _alert("A1", _hours_ago(1)),                                                   # naive, in
        _alert("A2", (NOW - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%S.500+0000")),  # wazuh, in
        _alert("A3", (NOW - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ")),        # Z, in
        _alert("A4", _hours_ago(48)),                                                  # naive, out
        _alert("A5", "garbage"),                                                       # unparseable, out
    ]
    result = windowed_alerts(alerts, 24)
    assert {a.id for a in result} == {"A1", "A2", "A3"}


def test_windows_8_12_24_are_distinct():
    alerts = [
        _alert("A1", _hours_ago(6)),
        _alert("A2", _hours_ago(10)),
        _alert("A3", _hours_ago(20)),
    ]
    assert len(windowed_alerts(alerts, 8)) == 1
    assert len(windowed_alerts(alerts, 12)) == 2
    assert len(windowed_alerts(alerts, 24)) == 3


def test_windowed_cases_full_timestamp_counts():
    cases = [_case("CASE-1", _hours_ago(2))]
    assert len(windowed_cases(cases, 24)) == 1


def test_windowed_cases_bare_time_of_day_excluded_not_crashed():
    # Guards the second bug found alongside the parser: cases whose
    # createdAt is a bare 'HH:MM:SS' (no date) must not crash the window
    # filter — they're simply excluded as unparseable.
    cases = [_case("CASE-1", "14:23:07")]
    assert windowed_cases(cases, 24) == []


def test_windowed_cases_outside_window_excluded():
    cases = [_case("CASE-1", _hours_ago(48))]
    assert windowed_cases(cases, 24) == []
