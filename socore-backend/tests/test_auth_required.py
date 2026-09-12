"""
Security regression test: the "SOC read" endpoints listed below must require
an authenticated caller (auth.get_current_user), exactly like every sibling
endpoint already does. Before this fix, these 8 GET routes had no `Depends`
at all and returned real production alerts/cases/decisions/events to anyone
with no token.

No real database or JWT is used here: the auth dependency raises 401 before
the route body ever runs, so the unauthenticated cases need no DB. The
authenticated cases override the dependency with a fake CurrentUser and
monkeypatch the store so the route body still runs the way it does when a
valid analyst session provides a genuinely authenticated user.
"""
from fastapi.testclient import TestClient

from app import auth
from app.main import app
from app.models import (
    Alert,
    AlertStatus,
    ApprovalStatus,
    Case,
    CaseStatus,
    Event,
    Severity,
)
from app.store import store

client = TestClient(app)

UNAUTHENTICATED_ENDPOINTS = [
    ("GET", "/api/alerts"),
    ("GET", "/api/alerts/ALT-20260101-001"),
    ("GET", "/api/pending"),
    ("GET", "/api/cases"),
    ("GET", "/api/decisions"),
    ("GET", "/api/events"),
    ("GET", "/api/events/EVT-20260101-001"),
    ("GET", "/api/events/count"),
]


def test_all_soc_read_endpoints_reject_unauthenticated_requests():
    for method, path in UNAUTHENTICATED_ENDPOINTS:
        resp = client.request(method, path)
        assert resp.status_code == 401, f"{method} {path} returned {resp.status_code}, expected 401"
        assert "alert" not in resp.text.lower() or "not found" in resp.text.lower() or resp.json().get("detail")


def test_health_remains_public(monkeypatch):
    # /api/health is intentionally unauthenticated — must not regress.
    # (store.all()/pending() are stubbed here only because this sandbox has
    # no DATABASE_URL — unrelated to the auth behavior under test.)
    monkeypatch.setattr(store, "all", lambda: [])
    monkeypatch.setattr(store, "pending", lambda: [])
    resp = client.get("/api/health")
    assert resp.status_code == 200


def _fake_user() -> auth.CurrentUser:
    return auth.CurrentUser(user_id="u1", email="analyst@example.com", role="l1_analyst", display_name="Test Analyst")


def _sample_alert() -> Alert:
    return Alert(
        id="ALT-20260101-001",
        timestamp="2026-01-01 00:00:00",
        severity=Severity.high,
        sourceIP="10.0.0.1",
        attackType="Brute Force",
        mitreId="T1110",
        mitreName="Brute Force",
        status=AlertStatus.new,
    )


def _sample_case() -> Case:
    return Case(
        id="CASE-20260101-001",
        title="Test case",
        severity=Severity.high,
        status=CaseStatus.open,
        createdAt="2026-01-01 00:00:00",
        updatedAt="2026-01-01 00:00:00",
    )


def _sample_event() -> Event:
    return Event(id="EVT-20260101-001", timestamp="2026-01-01 00:00:00", sourceIP="10.0.0.1")


def test_authenticated_requests_still_return_expected_data(monkeypatch):
    app.dependency_overrides[auth.get_current_user] = _fake_user
    try:
        alert = _sample_alert()
        case = _sample_case()
        event = _sample_event()

        monkeypatch.setattr(store, "all", lambda: [alert])
        monkeypatch.setattr(store, "get", lambda alert_id: alert if alert_id == alert.id else None)
        monkeypatch.setattr(store, "pending", lambda: [alert])
        monkeypatch.setattr(store, "all_cases", lambda: [case])
        monkeypatch.setattr(store, "decisions", lambda: [])
        monkeypatch.setattr(store, "all_events", lambda limit=50, offset=0: [event])
        monkeypatch.setattr(store, "get_event", lambda event_id: event if event_id == event.id else None)
        monkeypatch.setattr(store, "count_events", lambda: 1)

        resp = client.get("/api/alerts")
        assert resp.status_code == 200
        assert resp.json()[0]["id"] == alert.id

        resp = client.get(f"/api/alerts/{alert.id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == alert.id

        resp = client.get("/api/pending")
        assert resp.status_code == 200
        assert resp.json()[0]["id"] == alert.id

        resp = client.get("/api/cases")
        assert resp.status_code == 200
        assert resp.json()[0]["id"] == case.id

        resp = client.get("/api/decisions")
        assert resp.status_code == 200
        assert resp.json() == []

        resp = client.get("/api/events")
        assert resp.status_code == 200
        assert resp.json()[0]["id"] == event.id

        resp = client.get(f"/api/events/{event.id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == event.id

        resp = client.get("/api/events/count")
        assert resp.status_code == 200
        assert resp.json() == {"count": 1}
    finally:
        app.dependency_overrides.pop(auth.get_current_user, None)


def test_unknown_alert_still_404s_once_authenticated(monkeypatch):
    app.dependency_overrides[auth.get_current_user] = _fake_user
    try:
        monkeypatch.setattr(store, "get", lambda alert_id: None)
        resp = client.get("/api/alerts/does-not-exist")
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(auth.get_current_user, None)
