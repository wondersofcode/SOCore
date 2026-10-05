"""
Unit tests for response_exec: what may be blocked, and how fail2ban results
are interpreted. No real fail2ban is ever invoked — `_run` is stubbed.
"""
import pytest

from app import response_exec as rx


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for var in ("SOCORE_PROTECTED_IPS", "PUBLIC_HOST", "SOCORE_FAIL2BAN_JAIL", "SOCORE_FAIL2BAN_SUDO"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("SOCORE_FAIL2BAN_SUDO", "false")


@pytest.mark.parametrize("ip", [
    "10.0.0.5", "10.255.255.255", "172.16.0.1", "172.31.255.254", "192.168.1.1",
    "127.0.0.1", "127.1.2.3", "169.254.10.10", "0.0.0.0", "100.64.0.1",
    "224.0.0.1", "::1", "fe80::1", "fc00::1",
])
def test_non_public_addresses_are_never_blocked(ip):
    with pytest.raises(rx.TargetRefused):
        rx.validate_block_target(ip)


@pytest.mark.parametrize("bad", ["", "not-an-ip", "1.2.3", "1.2.3.4; rm -rf /", "999.1.1.1", "1.2.3.4 -j"])
def test_invalid_targets_are_refused(bad):
    with pytest.raises(rx.TargetRefused):
        rx.validate_block_target(bad)


def test_public_ip_is_accepted_and_normalized():
    assert rx.validate_block_target(" 45.33.32.156 ") == "45.33.32.156"
    assert rx.validate_block_target("8.8.8.8") == "8.8.8.8"


def test_protected_env_list_and_public_host_and_approver_ip_are_never_blocked(monkeypatch):
    monkeypatch.setenv("SOCORE_PROTECTED_IPS", "185.220.101.10, 185.199.108.0/24, garbage")
    monkeypatch.setenv("PUBLIC_HOST", "91.189.91.38")
    for ip in ("185.220.101.10", "185.199.108.99", "91.189.91.38"):
        with pytest.raises(rx.TargetRefused):
            rx.validate_block_target(ip)
    with pytest.raises(rx.TargetRefused):
        rx.validate_block_target("8.8.4.4", extra_protected=["8.8.4.4"])
    assert rx.validate_block_target("185.220.101.11") == "185.220.101.11"


def test_classify_only_the_perimeter_block_is_real():
    assert rx.classify("Block source IP at the perimeter firewall") == rx.KIND_BLOCK_IP
    for text in (
        "Isolate the endpoint and kill the parent process",
        "Block source IP and apply the WAF rule",
        "Force password reset and revoke active tokens",
        "", "block source ip at the perimeter firewall; reboot",
    ):
        assert rx.classify(text) == rx.KIND_SIMULATED


def test_simulated_actions_never_report_executed(monkeypatch):
    monkeypatch.setattr(rx, "_run", lambda args: pytest.fail("must not run any command"))
    res = rx.execute("Isolate the endpoint and kill the parent process", "8.8.8.8")
    assert res["status"] == "Simulated"
    assert res["mode"] == "simulated"


def _fake_run(banned: list[str], set_exit=0, status_exit=0, stderr=""):
    calls = []

    def run(args):
        calls.append(args)
        if args[:3] == ["fail2ban-client", "set", "sshd"]:
            if set_exit == 0:
                (banned.append if args[3] == "banip" else banned.remove)(args[4])
            return {"command": " ".join(args), "exit_code": set_exit, "stdout": "1", "stderr": stderr}
        if args[:2] == ["fail2ban-client", "status"]:
            return {"command": " ".join(args), "exit_code": status_exit,
                    "stdout": "Status for the jail: sshd\n`- Banned IP list:\t" + " ".join(banned), "stderr": ""}
        raise AssertionError(args)

    run.calls = calls
    return run


def test_ban_success_is_verified_against_the_jail_list(monkeypatch):
    banned: list[str] = []
    monkeypatch.setattr(rx.shutil, "which", lambda name: "/usr/bin/fail2ban-client")
    monkeypatch.setattr(rx, "_run", _fake_run(banned))
    res = rx.execute("Block source IP at the perimeter firewall", "45.33.32.156")
    assert res["status"] == "Executed"
    assert res["ok"] is True and res["verified"] is True
    assert res["exit_code"] == 0
    assert res["banned_ips"] == ["45.33.32.156"]
    assert res["jail"] == "sshd"
    assert banned == ["45.33.32.156"]


def test_ban_command_failure_is_reported_as_failed(monkeypatch):
    monkeypatch.setattr(rx.shutil, "which", lambda name: "/usr/bin/fail2ban-client")
    monkeypatch.setattr(rx, "_run", _fake_run([], set_exit=255, stderr="NOK: jail does not exist"))
    res = rx.execute("Block source IP at the perimeter firewall", "45.33.32.156")
    assert res["status"] == "ExecutionFailed"
    assert "jail does not exist" in res["error"]
    assert res["exit_code"] == 255


def test_exit_zero_but_ip_missing_from_jail_is_not_executed(monkeypatch):
    # fail2ban said OK but the IP is not in the list afterwards -> never claim success.
    def run(args):
        if args[:2] == ["fail2ban-client", "set"]:
            return {"command": "x", "exit_code": 0, "stdout": "0", "stderr": ""}
        return {"command": "x", "exit_code": 0, "stdout": "`- Banned IP list:\t", "stderr": ""}
    monkeypatch.setattr(rx.shutil, "which", lambda name: "/usr/bin/fail2ban-client")
    monkeypatch.setattr(rx, "_run", run)
    res = rx.execute("Block source IP at the perimeter firewall", "45.33.32.156")
    assert res["status"] == "ExecutionFailed"
    assert "not in the sshd banned list" in res["error"]


def test_unreadable_jail_status_is_not_success(monkeypatch):
    monkeypatch.setattr(rx.shutil, "which", lambda name: "/usr/bin/fail2ban-client")
    monkeypatch.setattr(rx, "_run", _fake_run([], status_exit=1))
    res = rx.execute("Block source IP at the perimeter firewall", "45.33.32.156")
    assert res["status"] == "ExecutionFailed"


def test_missing_fail2ban_binary_is_a_clear_failure(monkeypatch):
    monkeypatch.setattr(rx.shutil, "which", lambda name: None)
    res = rx.execute("Block source IP at the perimeter firewall", "45.33.32.156")
    assert res["status"] == "ExecutionFailed"
    assert "not installed" in res["error"]


def test_execute_rechecks_the_target_guard(monkeypatch):
    monkeypatch.setattr(rx, "_run", lambda args: pytest.fail("must not run any command"))
    res = rx.execute("Block source IP at the perimeter firewall", "192.168.1.10")
    assert res["status"] == "ExecutionFailed"
    assert "never blocked" in res["error"]


def test_unban_is_verified(monkeypatch):
    banned = ["45.33.32.156"]
    monkeypatch.setattr(rx.shutil, "which", lambda name: "/usr/bin/fail2ban-client")
    monkeypatch.setattr(rx, "_run", _fake_run(banned))
    res = rx.unban_ip("45.33.32.156")
    assert res["ok"] is True and res["verified"] is True
    assert banned == []


def test_commands_are_argv_lists_without_shell(monkeypatch):
    seen = {}

    def fake_subprocess_run(cmd, **kwargs):
        seen["cmd"], seen["kwargs"] = cmd, kwargs

        class P:
            returncode, stdout, stderr = 0, "", ""
        return P()

    monkeypatch.setattr(rx.subprocess, "run", fake_subprocess_run)
    rx._run(["fail2ban-client", "set", "sshd", "banip", "45.33.32.156"])
    assert isinstance(seen["cmd"], list)
    assert seen["kwargs"]["shell"] is False and seen["kwargs"]["timeout"] == rx.CMD_TIMEOUT_S


def test_proposed_action_executor_is_derived_not_trusted():
    from app.models import ProposedAction
    real = ProposedAction(action="Block source IP at the perimeter firewall", target="8.8.8.8", playbook="p", executor="simulated")
    fake = ProposedAction(action="Isolate the endpoint and kill the parent process", target="8.8.8.8", playbook="p", executor="fail2ban")
    assert real.executor == "fail2ban" and fake.executor == "simulated"
