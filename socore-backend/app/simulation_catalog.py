"""
Simulation catalog — the allowlist of controlled detection-validation tests
an analyst can run.

SOCore never executes any of these itself. There is no remote-exec surface
anywhere in this backend and it holds no credentials to the Windows or Linux
agents. Each entry documents a benign, manual action for the analyst to
perform themselves against infrastructure they already control; starting a
run only opens a detection window and tells the backend what real telemetry
(technique id, optionally a source hint) would count as evidence. Detection
success is decided later, in simulations.py, purely from whatever actually
lands in the `events`/`alerts` tables during that window — never from the
fact that this endpoint was called.

Two of these map to rules verified against this deployment's actual Wazuh
setup (see wazuh-integration/local_rules.xml and the default sshd ruleset).
The third is a general-purpose template for validating a technique this
catalog doesn't enumerate yet, without turning the platform into an
open-ended attack menu — it still runs nothing, it only records what the
analyst tests and correlates the result against real data.
"""
from __future__ import annotations

from typing import Optional, TypedDict


class SimulationDefinition(TypedDict):
    id: str
    name: str
    description: str
    technique_id: str
    platform: str
    objective: str
    instructions: list[str]
    detection_hint: str
    default_window_seconds: int
    custom: bool


CATALOG: list[SimulationDefinition] = [
    {
        "id": "SIM-SSH-BRUTEFORCE",
        "name": "SSH Brute Force Validation",
        "description": "Validates that repeated failed SSH authentication against the "
                        "monitored Linux host is detected and correlated into an alert.",
        "technique_id": "T1110.001",
        "platform": "Linux",
        "objective": "Confirm the SSH failed-login detection path (Wazuh rule 5716 / "
                      "local rule 100001) still reaches SOCore as a scored alert.",
        "instructions": [
            "From an authorized source you control, attempt several SSH logins "
            "against the monitored Linux agent with an intentionally wrong "
            "password (5-10 attempts is enough) — e.g. "
            "`ssh -o PreferredAuthentications=password testuser@<agent-ip>` "
            "and enter a wrong password each time.",
            "Do not attempt a real credential-stuffing run or use production "
            "credentials — the goal is to generate the failed-auth telemetry, "
            "not to actually breach the host.",
            "Click \"Mark as executed\" once you've completed the attempts, then "
            "wait for the detection window to evaluate the result.",
        ],
        "detection_hint": "Wazuh sshd failed-authentication rule (5716 / local 100001) -> Event -> "
                           "correlate() -> Alert with attackType=Brute Force, mitreId=T1110",
        "default_window_seconds": 300,
        "custom": False,
    },
    {
        "id": "SIM-WIN-ACCOUNT-MANIPULATION",
        "name": "Windows Account Change Validation",
        "description": "Validates that a Windows account/group change on the monitored "
                        "host is detected and correlated into an alert.",
        "technique_id": "T1098",
        "platform": "Windows",
        "objective": "Confirm the Windows account-manipulation detection path "
                      "(rule 60110, 'User account changed') still reaches SOCore.",
        "instructions": [
            "On the monitored Windows agent, make one benign account change you "
            "can immediately revert — e.g. add/remove a local test account from "
            "a non-privileged group, or reset a dedicated test account's password.",
            "Do not modify a real production account or any privileged group.",
            "Click \"Mark as executed\" once done, then wait for the detection "
            "window to evaluate the result.",
        ],
        "detection_hint": "Windows Security 4738/account-change -> Wazuh rule 60110 -> Event -> "
                           "correlate() -> Alert",
        "default_window_seconds": 300,
        "custom": False,
    },
    {
        "id": "SIM-CUSTOM",
        "name": "Custom Technique Validation",
        "description": "For a technique not yet in this catalog. Records what you're "
                        "testing and opens a detection window — SOCore still executes "
                        "nothing; you perform the test yourself against infrastructure "
                        "you control, using whatever Wazuh rule you already know covers it.",
        "technique_id": "",
        "platform": "Custom",
        "objective": "Analyst-defined — supply the ATT&CK technique and expected source "
                      "when starting the run.",
        "instructions": [
            "Perform your own controlled, non-destructive test against infrastructure "
            "you control, matching the technique you specify when starting this run.",
            "Click \"Mark as executed\" once done, then wait for the detection window "
            "to evaluate the result.",
        ],
        "detection_hint": "Whatever Wazuh rule you expect to fire for the technique you specify.",
        "default_window_seconds": 300,
        "custom": True,
    },
]

_BY_ID = {c["id"]: c for c in CATALOG}


def get(simulation_id: str) -> Optional[SimulationDefinition]:
    return _BY_ID.get(simulation_id)
