"""
Seed alerts so the dashboard has content before any live Wazuh event arrives.
Each is generated through the same correlation + AI path a real event takes,
so seeded and live alerts are indistinguishable in shape.
"""
from __future__ import annotations

from . import ai_explainer
from .correlation import correlate
from .models import Alert, WazuhEvent

# (source_ip, attack_type, mitre_id, mitre_name, rule_level, country, asn, vt, abuse)
_SEED = [
    ("192.168.56.20", "Brute Force", "T1110", "Brute Force", 12, "RU", "AS15169", 85, 92),
    ("10.0.0.47", "Lateral Movement", "T1021", "Remote Services", 9, "INTERNAL", "CORP-NET", 12, 0),
    ("203.0.113.42", "Phishing", "T1566", "Phishing", 10, "CN", "AS4134 CHINANET", 97, 88),
    ("172.16.0.88", "Port Scan", "T1046", "Network Service Discovery", 6, "INTERNAL", "CORP-DMZ", 5, 3),
    ("198.51.100.7", "C2 Beacon", "T1071", "App Layer Protocol", 13, "IR", "AS197207", 76, 81),
    ("10.0.0.22", "Persistence", "T1547", "Boot/Logon Autostart", 4, "INTERNAL", "CORP-NET", 0, 0),
    ("185.220.101.44", "C2 Beacon", "T1071", "App Layer Protocol", 13, "DE", "AS205100", 94, 96),
    ("104.244.72.115", "Malware Execution", "T1204", "User Execution", 12, "US", "AS53667", 99, 91),
    ("162.247.74.201", "Ransomware Precursor", "T1486", "Data Encrypted for Impact", 13, "CA", "AS4224", 96, 89),
    ("45.155.205.233", "Brute Force", "T1110", "Brute Force", 10, "NL", "AS204428", 71, 78),
]


def seed_alerts() -> list[Alert]:
    from datetime import datetime, timedelta
    out: list[Alert] = []
    base = datetime.utcnow()
    for i, (ip, attack, mid, mname, lvl, country, asn, vt, abuse) in enumerate(_SEED):
        ts = (base - timedelta(minutes=i * 7)).strftime("%Y-%m-%d %H:%M:%S")
        ev = WazuhEvent(
            source_ip=ip, attack_type=attack, mitre_id=mid, mitre_name=mname,
            rule_level=lvl, country=country, asn=asn, vt_score=vt, abuse_score=abuse,
            timestamp=ts,
        )
        alert = correlate(ev, f"ALT-{base:%Y%m%d}-{900 + i:03d}")
        alert.aiExplanation = ai_explainer.explain(alert)
        out.append(alert)
    return out
