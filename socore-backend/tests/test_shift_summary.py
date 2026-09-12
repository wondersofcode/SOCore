"""
Regression tests for the 24h (and 8h/12h) report window — the actual
production bug: real alerts existed on the Alerts page, but
windowed_alerts()/windowed_cases() silently dropped them because they used
timestamp shapes the old naive-only parser couldn't read.
"""
from datetime import datetime, timedelta, timezone

from app.models import Alert, AlertStatus, Case, CaseStatus, DecisionRecord, Severity
from app.shift_summary import (
    _mock_summary,
    _severity_breakdown_phrase,
    get_summary,
    windowed_alerts,
    windowed_cases,
    windowed_decision_count,
)

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


def _decision(alert_id: str) -> DecisionRecord:
    return DecisionRecord(alertId=alert_id, status="Approved", by="tester", at="12:00:00", reason="test")


def test_windowed_decision_count_matches_report_export_convention():
    # DecisionRecord.at is a bare time with no date, so a decision counts as
    # "in the window" iff the alert it was made on is — same convention
    # report_export.py's Decisions sheet already uses.
    windowed_ids = {"A1", "A2"}
    decisions = [_decision("A1"), _decision("A2"), _decision("A3")]
    assert windowed_decision_count(decisions, windowed_ids) == 2


def test_windowed_decision_count_zero_when_no_alerts_in_window():
    assert windowed_decision_count([_decision("A1")], set()) == 0


def test_get_summary_alert_and_decision_counts_track_the_selected_window():
    # Regression for the Reports.tsx KPI bug: "Alerts this shift" and
    # "Decisions logged" must come from the SAME window as the AI Shift
    # Summary — this is the backend contract that fix relies on. A1/A2 sit
    # inside 8h, A3 only inside 24h; only A1's alert has a decision.
    alerts = [
        _alert("A1", _hours_ago(1)),
        _alert("A2", _hours_ago(5)),
        _alert("A3", _hours_ago(20)),
    ]
    decisions = [_decision("A1"), _decision("A3")]

    summary_8h, _cached, count_8h, decisions_8h = get_summary(alerts, [], decisions, 8)
    summary_24h, _cached, count_24h, decisions_24h = get_summary(alerts, [], decisions, 24)

    assert count_8h == 2  # A1, A2
    assert decisions_8h == 1  # only A1's decision falls in this window
    assert count_24h == 3  # A1, A2, A3
    assert decisions_24h == 2  # both A1's and A3's decisions now qualify
    assert isinstance(summary_8h, str) and summary_8h
    assert isinstance(summary_24h, str) and summary_24h


def test_severity_breakdown_phrase_high_and_medium_uses_correct_terminology():
    # The exact production wording bug: 26 High-severity alerts must never
    # be described as "critical (high severity)" — High and Critical are
    # distinct SOCore tiers.
    phrase = _severity_breakdown_phrase({"High": 26, "Medium": 7})
    assert phrase == "26 classified as high severity and 7 as medium severity"
    assert "critical" not in phrase.lower()


def test_severity_breakdown_phrase_only_uses_critical_label_for_critical_tier():
    phrase = _severity_breakdown_phrase({"Critical": 2, "High": 26, "Medium": 7})
    assert phrase == "2 classified as critical severity, 26 as high severity and 7 as medium severity"


def test_severity_breakdown_phrase_single_tier():
    assert _severity_breakdown_phrase({"High": 5}) == "5 classified as high severity"


def test_severity_breakdown_phrase_empty_when_no_alerts():
    assert _severity_breakdown_phrase({}) == ""


def test_mock_summary_high_26_medium_7_never_says_critical():
    # End-to-end regression for the reported production bug: a report with
    # High=26/Medium=7 (0 Critical) must render "high severity"/"medium
    # severity" wording, never "critical (high severity)".
    facts = {
        "windowHours": 24,
        "alertCount": 33,
        "severityCounts": {"High": 26, "Medium": 7},
        "topSourceCountry": None,
        "topAttackTypes": [],
        "casesOpened": 0,
        "decisionCount": 0,
        "avgRiskScore": 62.5,
    }
    summary = _mock_summary(facts)
    assert "26 classified as high severity and 7 as medium severity" in summary
    assert "critical" not in summary.lower()
    assert "critical (high severity)" not in summary.lower()


def test_get_summary_mock_fallback_uses_correct_severity_terminology():
    # Same scenario, but driven through get_summary()/windowed_alerts() with
    # real Alert objects — proves the fix holds through the whole pipeline,
    # not just the string-formatting helper in isolation.
    alerts = (
        [_alert(f"H{i}", _hours_ago(1), severity=Severity.high) for i in range(26)]
        + [_alert(f"M{i}", _hours_ago(1), severity=Severity.medium) for i in range(7)]
    )
    # force_refresh=True: other tests in this module also call get_summary(24),
    # which would otherwise return their cached summary text instead of one
    # computed from this test's own fixture (get_summary's 5-minute cache is
    # module-global and keyed only by hours).
    summary, _cached, count, _decisions = get_summary(alerts, [], [], 24, force_refresh=True)
    assert count == 33
    assert "26 classified as high severity and 7 as medium severity" in summary
    assert "critical" not in summary.lower()
