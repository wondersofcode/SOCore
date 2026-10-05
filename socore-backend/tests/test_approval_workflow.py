"""
End-to-end tests of the Approve & Run / Reject workflow against a REAL
Postgres (a throwaway local instance started by `pgserver` — never the
production database) with the real FastAPI app, real store SQL, real state
machine and audit trail. Only the outside world is stubbed: the fail2ban
executor (`response_exec._run`) and Slack.

Auth is the one thing overridden: `get_current_user` is replaced with a
fake CurrentUser per test (the JWT/Supabase verification itself is covered
by test_auth_required.py).
"""
import concurrent.futures
import tempfile
import threading

import pytest

pgserver = pytest.importorskip("pgserver")

from fastapi.testclient import TestClient  # noqa: E402

from app import actions, auth, db, response_exec  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Alert, AlertStatus, ApprovalStatus, ProposedAction, Severity  # noqa: E402
from app.store import store  # noqa: E402

BLOCK = "Block source IP at the perimeter firewall"
ISOLATE = "Isolate the endpoint and kill the parent process"
PUBLIC_IP = "45.33.32.156"


@pytest.fixture(scope="module")
def pg():
    tmp = tempfile.mkdtemp(prefix="socore-pg-")
    server = pgserver.get_server(tmp)
    old_url, old_pool = db.DATABASE_URL, db._pool
    db.DATABASE_URL, db._pool = server.get_uri(), None
    db.init_schema()
    db.init_schema()  # migrations must be idempotent
    yield server
    if db._pool is not None:
        db._pool.closeall()
    db.DATABASE_URL, db._pool = old_url, old_pool
    server.cleanup()


@pytest.fixture(autouse=True)
def clean(pg, monkeypatch):
    with db.get_cursor(commit=True) as cur:
        cur.execute("TRUNCATE alerts, decisions, audit_log, alert_notes RESTART IDENTITY")
    monkeypatch.setattr(actions, "send_slack_alert", lambda msg: {"status": "skipped"})
    for var in ("SOCORE_PROTECTED_IPS", "PUBLIC_HOST"):
        monkeypatch.delenv(var, raising=False)
    yield
    app.dependency_overrides.pop(auth.get_current_user, None)


client = TestClient(app)


def as_user(role="l2_analyst", name="Alice", uid="u-alice"):
    app.dependency_overrides[auth.get_current_user] = lambda: auth.CurrentUser(uid, f"{uid}@x.test", role, name)


def make_alert(alert_id="ALT-T-001", ip=PUBLIC_IP, action=BLOCK, approval=ApprovalStatus.pending) -> Alert:
    a = Alert(
        id=alert_id, timestamp="2026-01-01 00:00:00", severity=Severity.high, sourceIP=ip,
        attackType="Brute Force", mitreId="T1110", mitreName="Brute Force", status=AlertStatus.new,
        riskScore=88, approvalStatus=approval,
        proposedAction=ProposedAction(action=action, target=ip, playbook="PB-brute-force", dryRun=True),
    )
    store.add(a)
    return a


class FakeExecutor:
    """Stands in for fail2ban: records calls, can fail, can be slow."""
    def __init__(self, monkeypatch, ok=True, delay=0.0):
        self.calls, self.ok, self.delay = [], ok, delay
        self.lock = threading.Lock()
        monkeypatch.setattr(response_exec, "ban_ip", self._ban)
        monkeypatch.setattr(response_exec, "unban_ip", self._unban)

    def _ban(self, ip):
        import time
        time.sleep(self.delay)
        with self.lock:
            self.calls.append(("ban", ip))
        if self.ok:
            return {"mode": "fail2ban", "operation": "banip", "target": ip, "jail": "sshd", "exit_code": 0,
                    "banned_ips": [ip], "verified": True, "ok": True}
        return {"mode": "fail2ban", "operation": "banip", "target": ip, "jail": "sshd", "exit_code": 255,
                "ok": False, "error": "NOK: jail sshd does not exist"}

    def _unban(self, ip):
        with self.lock:
            self.calls.append(("unban", ip))
        return {"mode": "fail2ban", "operation": "unbanip", "target": ip, "exit_code": 0, "verified": True, "ok": True}


def audit_actions(alert_id="ALT-T-001"):
    return [e.action for e in reversed(store.audit_for_alert(alert_id))]


def approve(alert_id="ALT-T-001", reason="looks malicious"):
    return client.post(f"/api/approve/{alert_id}", json={"decision": "approve", "reason": reason})


def reject(alert_id="ALT-T-001", reason="false alarm, internal scanner"):
    return client.post(f"/api/approve/{alert_id}", json={"decision": "reject", "reason": reason})


# ── A. authorized approve: decision + execution + audit all persisted ──────
def test_authorized_approve_executes_persists_and_audits(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    make_alert()
    as_user("l2_analyst")
    r = approve()
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["approvalStatus"] == "Approved" and body["status"] == "Responding"
    assert body["executionStatus"] == "Executed"
    assert body["executionResult"]["verified"] is True and body["executionResult"]["jail"] == "sshd"
    assert body["decidedBy"] == "Alice" and body["decidedByRole"] == "l2_analyst"
    assert body["decisionReason"] == "looks malicious"
    assert ex.calls == [("ban", PUBLIC_IP)]

    # Persisted: a fresh read (as after browser refresh) shows the same.
    again = client.get("/api/alerts/ALT-T-001").json()
    assert again["executionStatus"] == "Executed" and again["approvalStatus"] == "Approved"
    # M. audit trail
    assert audit_actions() == ["approve", "execution"]
    trail = client.get("/api/alerts/ALT-T-001/audit").json()
    assert trail[0]["action"] == "execution" and trail[0]["result"]["ok"] is True
    assert trail[1]["actorId"] == "u-alice" and trail[1]["actorRole"] == "l2_analyst"
    assert trail[1]["previousState"] == "Pending" and trail[1]["newState"] == "Approved"
    # Reports/Decisions data
    decs = client.get("/api/decisions").json()
    assert decs[0]["status"] == "Approved" and decs[0]["by"] == "Alice" and decs[0]["reason"] == "looks malicious"
    # O/P. pending queue shrinks, alert status updated
    assert client.get("/api/pending").json() == []


# ── B. authorized reject ───────────────────────────────────────────────────
def test_authorized_reject_persists_and_never_executes(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    make_alert()
    as_user("admin", "Root", "u-root")
    r = reject()
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["approvalStatus"] == "Rejected" and body["status"] == "Resolved"
    assert body["executionStatus"] == "None" and body["decisionReason"] == "false alarm, internal scanner"
    assert ex.calls == []
    assert audit_actions() == ["reject"]
    assert client.get("/api/decisions").json()[0]["status"] == "Rejected"
    # a rejected alert can never be approved/retried/unblocked afterwards (G)
    assert approve().status_code == 409
    assert client.post("/api/alerts/ALT-T-001/retry-execution").status_code == 409
    assert ex.calls == []


def test_reject_requires_a_reason(monkeypatch):
    FakeExecutor(monkeypatch)
    make_alert()
    as_user()
    assert client.post("/api/approve/ALT-T-001", json={"decision": "reject", "reason": "   "}).status_code == 400
    assert client.get("/api/alerts/ALT-T-001").json()["approvalStatus"] == "Pending"


def test_unknown_decision_value_is_400(monkeypatch):
    FakeExecutor(monkeypatch)
    make_alert()
    as_user()
    assert client.post("/api/approve/ALT-T-001", json={"decision": "yolo", "reason": "x"}).status_code == 400


# ── C/D. unauthenticated / insufficient role ───────────────────────────────
def test_unauthenticated_requests_are_rejected_401(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    make_alert()
    assert approve().status_code == 401
    assert reject().status_code == 401
    assert client.post("/api/alerts/ALT-T-001/retry-execution").status_code == 401
    assert client.post("/api/alerts/ALT-T-001/unblock", json={}).status_code == 401
    assert client.get("/api/alerts/ALT-T-001/audit").status_code == 401
    assert ex.calls == []


def test_l1_analyst_cannot_approve_or_reject_and_attempt_is_audited(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    make_alert()
    as_user("l1_analyst", "Newbie", "u-l1")
    assert approve().status_code == 403
    assert reject().status_code == 403
    assert ex.calls == []
    assert client.get("/api/alerts/ALT-T-001").json()["approvalStatus"] == "Pending"
    assert audit_actions() == ["approve_denied", "reject_denied"]


def test_l1_denied_attempt_on_missing_alert_writes_no_audit_row(monkeypatch):
    FakeExecutor(monkeypatch)
    as_user("l1_analyst")
    assert approve("ALT-NOPE").status_code == 403
    with db.get_cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM audit_log")
        assert cur.fetchone()["n"] == 0


# ── E/F/G. not found / already decided ─────────────────────────────────────
def test_approve_nonexistent_alert_is_404(monkeypatch):
    FakeExecutor(monkeypatch)
    as_user()
    assert approve("ALT-DOES-NOT-EXIST").status_code == 404


def test_approve_already_approved_is_409_and_does_not_rerun(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    make_alert()
    as_user()
    assert approve().status_code == 200
    r = approve()
    assert r.status_code == 409 and "already approved" in r.json()["detail"]
    assert ex.calls == [("ban", PUBLIC_IP)]
    assert "approve_conflict" in audit_actions()


def test_approve_already_rejected_is_409(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    make_alert()
    as_user()
    assert reject().status_code == 200
    assert approve().status_code == 409
    assert ex.calls == []


def test_alert_without_a_pending_proposal_cannot_be_approved(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    make_alert(approval=ApprovalStatus.none)
    as_user()
    assert approve().status_code == 409
    assert ex.calls == []


# ── H. duplicate / concurrent approve ──────────────────────────────────────
def test_concurrent_approves_execute_exactly_once(monkeypatch):
    ex = FakeExecutor(monkeypatch, delay=0.3)
    make_alert()
    as_user()
    barrier = threading.Barrier(8)

    def go():
        barrier.wait()
        return approve().status_code

    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        codes = sorted(f.result() for f in [pool.submit(go) for _ in range(8)])
    assert codes == [200] + [409] * 7, codes
    assert ex.calls == [("ban", PUBLIC_IP)]
    with db.get_cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM decisions WHERE alert_id='ALT-T-001'")
        assert cur.fetchone()["n"] == 1


def test_concurrent_approve_and_reject_only_one_wins(monkeypatch):
    ex = FakeExecutor(monkeypatch, delay=0.2)
    make_alert()
    as_user()
    barrier = threading.Barrier(2)

    def go(fn):
        barrier.wait()
        return fn().status_code

    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        codes = sorted(f.result() for f in [pool.submit(go, approve), pool.submit(go, reject)])
    assert codes == [200, 409]
    final = client.get("/api/alerts/ALT-T-001").json()
    assert (final["approvalStatus"] == "Approved") == (len(ex.calls) == 1)  # never both rejected AND executed


# ── I/J. integration success / failure is reported truthfully ──────────────
def test_execution_failure_is_persisted_audited_and_returned_honestly(monkeypatch):
    ex = FakeExecutor(monkeypatch, ok=False)
    make_alert()
    as_user()
    r = approve()
    assert r.status_code == 200  # the decision itself was recorded
    body = r.json()
    assert body["approvalStatus"] == "Approved"
    assert body["executionStatus"] == "ExecutionFailed"
    assert "jail sshd does not exist" in body["executionResult"]["error"]
    assert audit_actions() == ["approve", "execution"]
    assert store.audit_for_alert("ALT-T-001")[0].newState == "ExecutionFailed"
    assert client.get("/api/alerts/ALT-T-001").json()["executionStatus"] == "ExecutionFailed"


def test_failed_execution_can_be_retried_once_and_then_succeeds(monkeypatch):
    ex = FakeExecutor(monkeypatch, ok=False)
    make_alert()
    as_user()
    assert approve().json()["executionStatus"] == "ExecutionFailed"
    ex.ok = True
    r = client.post("/api/alerts/ALT-T-001/retry-execution")
    assert r.status_code == 200 and r.json()["executionStatus"] == "Executed"
    assert client.post("/api/alerts/ALT-T-001/retry-execution").status_code == 409  # nothing left to retry
    assert audit_actions() == ["approve", "execution", "retry_requested", "execution_retry", "retry_conflict"]


def test_l1_cannot_retry(monkeypatch):
    FakeExecutor(monkeypatch, ok=False)
    make_alert()
    as_user()
    approve()
    as_user("l1_analyst", "Newbie", "u-l1")
    assert client.post("/api/alerts/ALT-T-001/retry-execution").status_code == 403


def test_executor_crash_is_recorded_as_failed_not_left_executing(monkeypatch):
    def boom(ip):
        raise RuntimeError("kaboom")
    monkeypatch.setattr(response_exec, "ban_ip", boom)
    make_alert()
    as_user()
    body = approve().json()
    assert body["executionStatus"] == "ExecutionFailed" and "kaboom" in body["executionResult"]["error"]


def test_unexecutable_action_types_are_labelled_simulated_never_executed(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    make_alert(action=ISOLATE)
    as_user()
    body = approve().json()
    assert body["approvalStatus"] == "Approved"
    assert body["executionStatus"] == "Simulated"
    assert body["executionResult"]["mode"] == "simulated"
    assert ex.calls == []


# ── protective guards ──────────────────────────────────────────────────────
@pytest.mark.parametrize("ip", ["10.1.2.3", "172.20.0.9", "192.168.0.10", "127.0.0.1", "169.254.1.1"])
def test_private_targets_are_refused_with_4xx_and_audited(monkeypatch, ip):
    ex = FakeExecutor(monkeypatch)
    make_alert(ip=ip)
    as_user()
    r = approve()
    assert r.status_code == 422 and "never blocked" in r.json()["detail"]
    assert ex.calls == []
    still = client.get("/api/alerts/ALT-T-001").json()
    assert still["approvalStatus"] == "Pending" and still["executionStatus"] == "None"
    assert audit_actions() == ["approve_refused_protected_target"]
    # ... and the analyst can still reject it
    assert reject().status_code == 200


def test_operator_protected_ip_is_refused(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    monkeypatch.setenv("SOCORE_PROTECTED_IPS", PUBLIC_IP)
    make_alert()
    as_user()
    assert approve().status_code == 422
    assert ex.calls == []


def test_approvers_own_ip_is_never_blocked(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    make_alert()
    as_user()
    r = client.post("/api/approve/ALT-T-001", json={"decision": "approve", "reason": "x"},
                    headers={"X-Forwarded-For": PUBLIC_IP})
    assert r.status_code == 422 and ex.calls == []


# ── unblock / revert ───────────────────────────────────────────────────────
def test_unblock_reverts_and_is_audited_once(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    make_alert()
    as_user()
    approve()
    r = client.post("/api/alerts/ALT-T-001/unblock", json={"reason": "was our partner"})
    assert r.status_code == 200 and r.json()["executionStatus"] == "Reverted"
    assert r.json()["executionResult"]["revert"]["ok"] is True
    assert ex.calls == [("ban", PUBLIC_IP), ("unban", PUBLIC_IP)]
    assert client.post("/api/alerts/ALT-T-001/unblock", json={}).status_code == 409
    assert audit_actions() == ["approve", "execution", "unblock_requested", "unblock", "unblock_conflict"]


def test_unblock_not_possible_for_simulated_or_pending(monkeypatch):
    FakeExecutor(monkeypatch)
    make_alert("ALT-T-001", action=ISOLATE)
    make_alert("ALT-T-002")
    as_user()
    approve("ALT-T-001")
    assert client.post("/api/alerts/ALT-T-001/unblock", json={}).status_code == 409
    assert client.post("/api/alerts/ALT-T-002/unblock", json={}).status_code == 409


# ── K. database failure ────────────────────────────────────────────────────
def test_database_failure_during_decision_runs_nothing(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    make_alert()
    as_user()

    def broken(*a, **k):
        raise RuntimeError("db down")
    monkeypatch.setattr(store, "claim_decision", broken)
    # TestClient re-raises unhandled server errors by default; a real client sees 500.
    with pytest.raises(RuntimeError):
        approve()
    assert ex.calls == []
    assert client.get("/api/alerts/ALT-T-001").json()["approvalStatus"] == "Pending"


def test_failure_saving_the_result_returns_500_with_guidance(monkeypatch):
    FakeExecutor(monkeypatch)
    make_alert()
    as_user()

    def broken(*a, **k):
        raise RuntimeError("db down")
    monkeypatch.setattr(store, "finish_execution", broken)
    r = approve()
    assert r.status_code == 500 and "could not be saved" in r.json()["detail"]


def test_decision_and_audit_are_one_transaction(monkeypatch):
    """If the audit insert fails the decision must roll back too."""
    FakeExecutor(monkeypatch)
    make_alert()
    as_user()
    from app import store as store_mod
    monkeypatch.setattr(store_mod, "_audit", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("audit down")))
    with pytest.raises(RuntimeError):
        approve()
    assert client.get("/api/alerts/ALT-T-001").json()["approvalStatus"] == "Pending"
    with db.get_cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM decisions")
        assert cur.fetchone()["n"] == 0


# ── L. analyst notes persistence ───────────────────────────────────────────
def test_analyst_notes_persist_per_alert_with_server_side_author():
    make_alert("ALT-T-001")
    make_alert("ALT-T-002")
    as_user("l1_analyst", "Newbie", "u-l1")  # notes are open to every analyst
    r = client.post("/api/alerts/ALT-T-001/notes", json={"text": "  checked auth.log  "})
    assert r.status_code == 200 and r.json()["author"] == "Newbie" and r.json()["text"] == "checked auth.log"
    assert client.post("/api/alerts/ALT-T-001/notes", json={"text": "  "}).status_code == 400
    assert client.post("/api/alerts/ALT-NOPE/notes", json={"text": "x"}).status_code == 404
    assert [n["text"] for n in client.get("/api/alerts/ALT-T-001/notes").json()] == ["checked auth.log"]
    assert client.get("/api/alerts/ALT-T-002/notes").json() == []


# ── audit immutability ─────────────────────────────────────────────────────
def test_audit_log_and_decisions_are_append_only(monkeypatch):
    FakeExecutor(monkeypatch)
    make_alert()
    as_user()
    approve()
    for sql in ("UPDATE audit_log SET reason='tampered'", "DELETE FROM audit_log",
                "UPDATE decisions SET reason='tampered'", "DELETE FROM decisions"):
        with pytest.raises(Exception, match="append-only"):
            with db.get_cursor(commit=True) as cur:
                cur.execute(sql)
    assert len(store.audit_for_alert("ALT-T-001")) == 2


# ── restart recovery ───────────────────────────────────────────────────────
def test_alert_stuck_executing_after_a_crash_becomes_retryable(monkeypatch):
    ex = FakeExecutor(monkeypatch)
    make_alert()
    as_user()
    approve()
    with db.get_cursor(commit=True) as cur:
        cur.execute("UPDATE alerts SET execution_status='Executing', decided_at='2020-01-01 00:00:00'")
    assert store.recover_stuck_executions() == 1
    got = client.get("/api/alerts/ALT-T-001").json()
    assert got["executionStatus"] == "ExecutionFailed" and "outcome unknown" in got["executionResult"]["error"]
    assert client.post("/api/alerts/ALT-T-001/retry-execution").json()["executionStatus"] == "Executed"
    assert ex.calls[-1] == ("ban", PUBLIC_IP)


# ── cases endpoints now authenticated ──────────────────────────────────────
def test_case_mutations_require_authentication():
    for method, path in (("GET", "/api/cases/CASE-1"), ("PATCH", "/api/cases/CASE-1"),
                         ("POST", "/api/cases/CASE-1/tasks/t1/toggle")):
        assert client.request(method, path, json={} if method == "PATCH" else None).status_code == 401
