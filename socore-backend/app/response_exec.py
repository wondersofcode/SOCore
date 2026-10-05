"""
Response-action execution for approved alerts.

What SOCore can really do on its own host is deliberately narrow: ban an
external IP in a fail2ban jail (`fail2ban-client set <jail> banip <ip>`). It
never touches cloud firewalls. Every other proposed action (isolate a host,
quarantine mail, reset credentials, ...) has no executor here, so it is
reported as "Simulated" — it is never reported as "Executed".

Safety rules enforced before anything runs:
  * only a syntactically valid, globally routable IP can be banned
    (RFC1918, loopback, link-local, CGNAT, multicast, reserved ... are refused)
  * operator-protected addresses are never banned: SOCORE_PROTECTED_IPS
    (comma-separated IPs/CIDRs — put the analysts' own public IPs and the VM's
    here), PUBLIC_HOST, and the IP of the analyst who is approving
  * commands run without a shell, with a timeout, and the ban is verified by
    reading the jail's banned list back

Env:
  SOCORE_FAIL2BAN_JAIL   jail to ban in (default "sshd")
  SOCORE_FAIL2BAN_SUDO   "true" (default) to prefix `sudo -n` when not root
  SOCORE_PROTECTED_IPS   extra never-block IPs/CIDRs
"""
from __future__ import annotations

import ipaddress
import logging
import os
import re
import shutil
import subprocess
from typing import Optional

logger = logging.getLogger("socore.response")

KIND_BLOCK_IP = "block_ip"
KIND_SIMULATED = "simulated"

CMD_TIMEOUT_S = 10

# The correlation engine's wording for the one action fail2ban can perform.
_BLOCK_IP_ACTIONS = ("Block source IP at the perimeter firewall",)


class TargetRefused(Exception):
    """The target must never be blocked (invalid / private / protected)."""


def classify(action_text: str) -> str:
    """Which executor handles this proposed action."""
    text = (action_text or "").strip()
    if any(text.lower() == a.lower() for a in _BLOCK_IP_ACTIONS):
        return KIND_BLOCK_IP
    return KIND_SIMULATED


def _protected_networks() -> list[ipaddress._BaseNetwork]:
    raw = [p.strip() for p in os.environ.get("SOCORE_PROTECTED_IPS", "").split(",") if p.strip()]
    public_host = os.environ.get("PUBLIC_HOST", "").strip()
    if public_host:
        raw.append(public_host)
    nets = []
    for item in raw:
        try:
            nets.append(ipaddress.ip_network(item, strict=False))
        except ValueError:
            logger.warning("Ignoring non-IP entry in protected list: %r", item)
    return nets


def validate_block_target(target: str, extra_protected: Optional[list[str]] = None) -> str:
    """Returns the normalized IP, or raises TargetRefused with a reason that is
    safe to show to the analyst."""
    try:
        ip = ipaddress.ip_address((target or "").strip())
    except ValueError:
        raise TargetRefused(f"'{target}' is not a valid IP address") from None
    if not ip.is_global or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
        raise TargetRefused(
            f"{ip} is a private, loopback, link-local or otherwise non-public address and is never blocked"
        )
    nets = _protected_networks()
    for extra in extra_protected or []:
        try:
            nets.append(ipaddress.ip_network(extra.strip(), strict=False))
        except ValueError:
            continue
    for net in nets:
        if ip.version == net.version and ip in net:
            raise TargetRefused(f"{ip} is on the protected list and is never blocked")
    return str(ip)


def _jail() -> str:
    jail = os.environ.get("SOCORE_FAIL2BAN_JAIL", "sshd").strip() or "sshd"
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", jail):
        raise RuntimeError("SOCORE_FAIL2BAN_JAIL contains invalid characters")
    return jail


def _prefix() -> list[str]:
    if os.environ.get("SOCORE_FAIL2BAN_SUDO", "true").strip().lower() in ("0", "false", "no"):
        return []
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        return []
    return ["sudo", "-n"]


def _run(args: list[str]) -> dict:
    """Run one command; always returns a dict, never raises."""
    cmd = _prefix() + args
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=CMD_TIMEOUT_S, shell=False)
        return {
            "command": " ".join(cmd), "exit_code": proc.returncode,
            "stdout": proc.stdout.strip()[:2000], "stderr": proc.stderr.strip()[:2000],
        }
    except FileNotFoundError as exc:
        return {"command": " ".join(cmd), "exit_code": None, "stdout": "", "stderr": f"command not found: {exc.filename}"}
    except subprocess.TimeoutExpired:
        return {"command": " ".join(cmd), "exit_code": None, "stdout": "", "stderr": f"timed out after {CMD_TIMEOUT_S}s"}
    except OSError as exc:
        return {"command": " ".join(cmd), "exit_code": None, "stdout": "", "stderr": str(exc)}


def _banned_ips(jail: str) -> tuple[Optional[list[str]], dict]:
    """The jail's current banned IP list (None if it could not be read)."""
    res = _run(["fail2ban-client", "status", jail])
    if res["exit_code"] != 0:
        return None, res
    m = re.search(r"Banned IP list:\s*(.*)", res["stdout"])
    return ([x for x in m.group(1).split() if x] if m else []), res


def _fail2ban_available() -> Optional[str]:
    """None if usable, else why not."""
    if not shutil.which("fail2ban-client"):
        return "fail2ban-client is not installed on the SOCore host"
    return None


def _ban_change(ip: str, op: str) -> dict:
    """op is 'banip' or 'unbanip'. Result is a persisted-as-is execution record."""
    started = {"mode": "fail2ban", "operation": op, "target": ip}
    try:
        jail = _jail()
    except RuntimeError as exc:
        return {**started, "ok": False, "error": str(exc)}
    started["jail"] = jail
    missing = _fail2ban_available()
    if missing:
        return {**started, "ok": False, "error": missing}

    res = _run(["fail2ban-client", "set", jail, op, ip])
    out = {**started, **res}
    if res["exit_code"] != 0:
        out["ok"] = False
        out["error"] = res["stderr"] or res["stdout"] or f"fail2ban-client exited with {res['exit_code']}"
        return out

    banned, status_res = _banned_ips(jail)
    out["banned_ips"] = banned
    if banned is None:
        out["ok"] = False
        out["error"] = "fail2ban reported success but the jail's banned list could not be read back to verify it: " + (
            status_res["stderr"] or status_res["stdout"] or "unknown error"
        )
        return out
    present = ip in banned
    verified = present if op == "banip" else not present
    out["verified"] = verified
    out["ok"] = verified
    if not verified:
        out["error"] = f"fail2ban accepted the command but {ip} is {'not ' if op == 'banip' else 'still '}in the {jail} banned list"
    return out


def ban_ip(ip: str) -> dict:
    return _ban_change(ip, "banip")


def unban_ip(ip: str) -> dict:
    return _ban_change(ip, "unbanip")


def execute(action_text: str, target: str, extra_protected: Optional[list[str]] = None) -> dict:
    """
    Runs the approved action. Returns
      {"status": "Executed"|"Simulated"|"ExecutionFailed", "mode": ..., ...}
    Target validation for block_ip must already have passed (the API validates
    before it claims the alert); it is re-checked here as defence in depth.
    """
    kind = classify(action_text)
    if kind == KIND_SIMULATED:
        return {
            "status": "Simulated",
            "mode": "simulated",
            "detail": "SOCore has no executor for this action type; nothing was changed on any system.",
            "action": action_text,
            "target": target,
        }
    try:
        ip = validate_block_target(target, extra_protected)
    except TargetRefused as exc:
        return {"status": "ExecutionFailed", "mode": "fail2ban", "ok": False, "error": str(exc), "target": target}
    result = ban_ip(ip)
    result["status"] = "Executed" if result.get("ok") else "ExecutionFailed"
    return result
