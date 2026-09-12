"""
MITRE ATT&CK Enterprise reference data (tactics + top-level techniques).

This is public taxonomy data published by MITRE — it never changes based on
what SOCore has or hasn't seen, so it's safe to hold as a static reference
table. It answers "what techniques exist" only; every *status*, count, or
percentage layered on top of this (in mitre.py) is computed live from real
alerts/events/simulation_runs and is never stored here.

Scoped to top-level techniques (no sub-techniques) to keep the matrix dense
and readable — this mirrors how most ATT&CK Navigator layers are presented
at the overview level.
"""
from __future__ import annotations

from typing import TypedDict


class Technique(TypedDict):
    id: str
    name: str


class Tactic(TypedDict):
    id: str
    name: str
    techniques: list[Technique]


TACTICS: list[Tactic] = [
    {
        "id": "TA0043",
        "name": "Reconnaissance",
        "techniques": [
            {"id": "T1595", "name": "Active Scanning"},
            {"id": "T1592", "name": "Gather Victim Host Information"},
            {"id": "T1589", "name": "Gather Victim Identity Information"},
            {"id": "T1590", "name": "Gather Victim Network Information"},
            {"id": "T1591", "name": "Gather Victim Org Information"},
            {"id": "T1598", "name": "Phishing for Information"},
            {"id": "T1597", "name": "Search Closed Sources"},
            {"id": "T1596", "name": "Search Open Technical Databases"},
            {"id": "T1593", "name": "Search Open Websites/Domains"},
            {"id": "T1594", "name": "Search Victim-Owned Websites"},
        ],
    },
    {
        "id": "TA0042",
        "name": "Resource Development",
        "techniques": [
            {"id": "T1583", "name": "Acquire Infrastructure"},
            {"id": "T1586", "name": "Compromise Accounts"},
            {"id": "T1584", "name": "Compromise Infrastructure"},
            {"id": "T1587", "name": "Develop Capabilities"},
            {"id": "T1585", "name": "Establish Accounts"},
            {"id": "T1588", "name": "Obtain Capabilities"},
            {"id": "T1608", "name": "Stage Capabilities"},
        ],
    },
    {
        "id": "TA0001",
        "name": "Initial Access",
        "techniques": [
            {"id": "T1189", "name": "Drive-by Compromise"},
            {"id": "T1190", "name": "Exploit Public-Facing Application"},
            {"id": "T1133", "name": "External Remote Services"},
            {"id": "T1200", "name": "Hardware Additions"},
            {"id": "T1566", "name": "Phishing"},
            {"id": "T1091", "name": "Replication Through Removable Media"},
            {"id": "T1195", "name": "Supply Chain Compromise"},
            {"id": "T1199", "name": "Trusted Relationship"},
            {"id": "T1078", "name": "Valid Accounts"},
        ],
    },
    {
        "id": "TA0002",
        "name": "Execution",
        "techniques": [
            {"id": "T1059", "name": "Command and Scripting Interpreter"},
            {"id": "T1609", "name": "Container Administration Command"},
            {"id": "T1610", "name": "Deploy Container"},
            {"id": "T1203", "name": "Exploitation for Client Execution"},
            {"id": "T1204", "name": "User Execution"},
            {"id": "T1047", "name": "Windows Management Instrumentation"},
            {"id": "T1053", "name": "Scheduled Task/Job"},
            {"id": "T1129", "name": "Shared Modules"},
        ],
    },
    {
        "id": "TA0003",
        "name": "Persistence",
        "techniques": [
            {"id": "T1098", "name": "Account Manipulation"},
            {"id": "T1547", "name": "Boot or Logon Autostart Execution"},
            {"id": "T1037", "name": "Boot or Logon Initialization Scripts"},
            {"id": "T1543", "name": "Create or Modify System Process"},
            {"id": "T1136", "name": "Create Account"},
            {"id": "T1574", "name": "Hijack Execution Flow"},
            {"id": "T1556", "name": "Modify Authentication Process"},
            {"id": "T1053", "name": "Scheduled Task/Job"},
        ],
    },
    {
        "id": "TA0004",
        "name": "Privilege Escalation",
        "techniques": [
            {"id": "T1548", "name": "Abuse Elevation Control Mechanism"},
            {"id": "T1134", "name": "Access Token Manipulation"},
            {"id": "T1484", "name": "Domain Policy Modification"},
            {"id": "T1068", "name": "Exploitation for Privilege Escalation"},
            {"id": "T1055", "name": "Process Injection"},
            {"id": "T1053", "name": "Scheduled Task/Job"},
        ],
    },
    {
        "id": "TA0005",
        "name": "Defense Evasion",
        "techniques": [
            {"id": "T1548", "name": "Abuse Elevation Control Mechanism"},
            {"id": "T1140", "name": "Deobfuscate/Decode Files or Information"},
            {"id": "T1484", "name": "Domain Policy Modification"},
            {"id": "T1222", "name": "File and Directory Permissions Modification"},
            {"id": "T1564", "name": "Hide Artifacts"},
            {"id": "T1574", "name": "Hijack Execution Flow"},
            {"id": "T1562", "name": "Impair Defenses"},
            {"id": "T1070", "name": "Indicator Removal"},
            {"id": "T1036", "name": "Masquerading"},
            {"id": "T1027", "name": "Obfuscated Files or Information"},
            {"id": "T1055", "name": "Process Injection"},
            {"id": "T1218", "name": "System Binary Proxy Execution"},
        ],
    },
    {
        "id": "TA0006",
        "name": "Credential Access",
        "techniques": [
            {"id": "T1110", "name": "Brute Force"},
            {"id": "T1555", "name": "Credentials from Password Stores"},
            {"id": "T1187", "name": "Forced Authentication"},
            {"id": "T1556", "name": "Modify Authentication Process"},
            {"id": "T1003", "name": "OS Credential Dumping"},
            {"id": "T1558", "name": "Steal or Forge Kerberos Tickets"},
            {"id": "T1539", "name": "Steal Web Session Cookie"},
            {"id": "T1552", "name": "Unsecured Credentials"},
        ],
    },
    {
        "id": "TA0007",
        "name": "Discovery",
        "techniques": [
            {"id": "T1087", "name": "Account Discovery"},
            {"id": "T1083", "name": "File and Directory Discovery"},
            {"id": "T1046", "name": "Network Service Discovery"},
            {"id": "T1135", "name": "Network Share Discovery"},
            {"id": "T1057", "name": "Process Discovery"},
            {"id": "T1018", "name": "Remote System Discovery"},
            {"id": "T1082", "name": "System Information Discovery"},
            {"id": "T1016", "name": "System Network Configuration Discovery"},
            {"id": "T1033", "name": "System Owner/User Discovery"},
        ],
    },
    {
        "id": "TA0008",
        "name": "Lateral Movement",
        "techniques": [
            {"id": "T1210", "name": "Exploitation of Remote Services"},
            {"id": "T1570", "name": "Lateral Tool Transfer"},
            {"id": "T1021", "name": "Remote Services"},
            {"id": "T1091", "name": "Replication Through Removable Media"},
            {"id": "T1072", "name": "Software Deployment Tools"},
            {"id": "T1550", "name": "Use Alternate Authentication Material"},
        ],
    },
    {
        "id": "TA0009",
        "name": "Collection",
        "techniques": [
            {"id": "T1560", "name": "Archive Collected Data"},
            {"id": "T1119", "name": "Automated Collection"},
            {"id": "T1115", "name": "Clipboard Data"},
            {"id": "T1005", "name": "Data from Local System"},
            {"id": "T1039", "name": "Data from Network Shared Drive"},
            {"id": "T1074", "name": "Data Staged"},
            {"id": "T1056", "name": "Input Capture"},
            {"id": "T1113", "name": "Screen Capture"},
        ],
    },
    {
        "id": "TA0011",
        "name": "Command and Control",
        "techniques": [
            {"id": "T1071", "name": "Application Layer Protocol"},
            {"id": "T1132", "name": "Data Encoding"},
            {"id": "T1568", "name": "Dynamic Resolution"},
            {"id": "T1573", "name": "Encrypted Channel"},
            {"id": "T1105", "name": "Ingress Tool Transfer"},
            {"id": "T1095", "name": "Non-Application Layer Protocol"},
            {"id": "T1571", "name": "Non-Standard Port"},
            {"id": "T1572", "name": "Protocol Tunneling"},
            {"id": "T1090", "name": "Proxy"},
            {"id": "T1102", "name": "Web Service"},
        ],
    },
    {
        "id": "TA0010",
        "name": "Exfiltration",
        "techniques": [
            {"id": "T1020", "name": "Automated Exfiltration"},
            {"id": "T1030", "name": "Data Transfer Size Limits"},
            {"id": "T1048", "name": "Exfiltration Over Alternative Protocol"},
            {"id": "T1041", "name": "Exfiltration Over C2 Channel"},
            {"id": "T1567", "name": "Exfiltration Over Web Service"},
            {"id": "T1029", "name": "Scheduled Transfer"},
        ],
    },
    {
        "id": "TA0040",
        "name": "Impact",
        "techniques": [
            {"id": "T1531", "name": "Account Access Removal"},
            {"id": "T1485", "name": "Data Destruction"},
            {"id": "T1486", "name": "Data Encrypted for Impact"},
            {"id": "T1565", "name": "Data Manipulation"},
            {"id": "T1491", "name": "Defacement"},
            {"id": "T1499", "name": "Endpoint Denial of Service"},
            {"id": "T1490", "name": "Inhibit System Recovery"},
            {"id": "T1489", "name": "Service Stop"},
            {"id": "T1529", "name": "System Shutdown/Reboot"},
        ],
    },
]


# One-line, factual technique descriptions (paraphrased from the public
# MITRE ATT&CK definitions — reference text, not a detection claim). Shown in
# the technique detail drawer; falls back to a generic line if a technique
# is ever added to TACTICS without an entry here.
_DESCRIPTIONS: dict[str, str] = {
    "T1595": "Probes victim infrastructure (scanning, vulnerability scanning) to gather information for targeting.",
    "T1592": "Gathers information about victim hosts (hardware, software, configuration) to support targeting.",
    "T1589": "Gathers victim identity information such as names, emails, and credentials before an intrusion.",
    "T1590": "Gathers victim network information (topology, IP ranges, DNS) to plan an intrusion.",
    "T1591": "Gathers information about the victim organization (structure, roles, locations) for targeting.",
    "T1598": "Uses phishing to elicit sensitive information rather than to deliver a payload.",
    "T1597": "Searches closed/private sources (paid feeds, dark web) for information on the victim.",
    "T1596": "Searches open technical databases (WHOIS, certificate transparency, scan repositories) for victim data.",
    "T1593": "Searches public websites and domains for information useful to targeting.",
    "T1594": "Searches a victim's own website for exploitable information before an intrusion.",
    "T1583": "Acquires infrastructure (servers, domains, accounts) to use in an operation.",
    "T1586": "Compromises existing third-party accounts to support an operation (e.g. for phishing or C2).",
    "T1584": "Compromises third-party infrastructure (servers, domains) for use in an operation.",
    "T1587": "Develops custom capabilities (malware, exploits, tools) rather than acquiring them.",
    "T1585": "Creates and cultivates accounts to support an operation (e.g. social media personas).",
    "T1588": "Obtains capabilities (malware, exploits, tools) from a third party rather than developing them.",
    "T1608": "Stages capabilities on attacker-controlled infrastructure ahead of use.",
    "T1189": "Compromises a user's browser as part of a strategic web compromise (watering hole).",
    "T1190": "Exploits a vulnerability in an internet-facing application or service to gain initial access.",
    "T1133": "Uses legitimate external remote access services (VPN, RDP gateway) to gain initial access.",
    "T1200": "Introduces or misuses hardware (rogue device, implant) for initial access.",
    "T1566": "Sends fraudulent messages to trick a user into revealing credentials or running malicious content.",
    "T1091": "Uses removable media (autorun, malicious files) to move into or between systems.",
    "T1195": "Compromises a product or its supply chain before it reaches the victim.",
    "T1199": "Abuses an established trust relationship with a third party (MSP, vendor) to gain access.",
    "T1078": "Uses valid, legitimate account credentials to gain or maintain access.",
    "T1059": "Abuses a command or scripting interpreter (PowerShell, bash, etc.) to execute commands.",
    "T1609": "Uses a container administration service to execute commands inside a container.",
    "T1610": "Deploys a container to execute code within a containerized environment.",
    "T1203": "Exploits a client application vulnerability to execute code.",
    "T1204": "Relies on a user taking an action (opening a file, clicking a link) to execute malicious code.",
    "T1047": "Uses Windows Management Instrumentation to execute code locally or remotely.",
    "T1053": "Abuses task/job scheduling to execute code at a specified time or on a recurring basis.",
    "T1129": "Executes malicious code via a shared module loaded into a process.",
    "T1098": "Modifies account permissions, credentials, or settings to maintain or expand access.",
    "T1547": "Configures a program to run automatically at boot or logon to maintain persistence.",
    "T1037": "Abuses boot or logon initialization scripts to establish persistence.",
    "T1543": "Creates or modifies a system-level process (service, daemon) for persistence or execution.",
    "T1136": "Creates a new account to maintain access to a victim environment.",
    "T1574": "Hijacks the execution flow of a legitimate process (DLL search order, PATH) for persistence or evasion.",
    "T1556": "Modifies the authentication process to bypass or capture credentials.",
    "T1548": "Circumvents privilege-elevation controls to run code with higher permissions.",
    "T1134": "Manipulates access tokens to operate under a different user or elevated context.",
    "T1484": "Modifies domain policy (GPO, trust) to escalate privileges or evade defenses.",
    "T1068": "Exploits a software vulnerability to gain elevated privileges.",
    "T1055": "Injects code into another process's address space to evade defenses or elevate privileges.",
    "T1140": "Deobfuscates or decodes files/information staged for execution.",
    "T1222": "Modifies file or directory permissions to evade access controls.",
    "T1564": "Hides artifacts (files, processes, registry keys) from normal detection and view.",
    "T1562": "Disables or tampers with security tools and controls to evade detection.",
    "T1070": "Removes or alters evidence (logs, files) to cover tracks.",
    "T1036": "Disguises a malicious artifact to look legitimate (name, location, signature).",
    "T1027": "Obfuscates or encrypts files/information to evade detection and analysis.",
    "T1218": "Abuses a trusted, signed system binary to proxy execution of malicious code.",
    "T1110": "Systematically guesses passwords to gain access to accounts.",
    "T1555": "Retrieves credentials stored by password managers or OS credential stores.",
    "T1187": "Coerces a system into authenticating to an attacker-controlled service to capture credentials.",
    "T1003": "Dumps credential material (hashes, tickets) from OS memory or storage.",
    "T1558": "Steals or forges Kerberos tickets to gain or escalate access.",
    "T1539": "Steals a web application session cookie to hijack an authenticated session.",
    "T1552": "Discovers credentials stored insecurely in files, config, or history.",
    "T1087": "Enumerates local, domain, or cloud accounts to understand the victim environment.",
    "T1083": "Enumerates files and directories to locate information of interest.",
    "T1046": "Scans a network for open ports and available services.",
    "T1135": "Enumerates accessible network shares.",
    "T1057": "Enumerates running processes on a system.",
    "T1018": "Enumerates other systems reachable on the network.",
    "T1082": "Gathers detailed information about the system's OS, hardware, and configuration.",
    "T1016": "Enumerates network configuration details (interfaces, routing, DNS).",
    "T1033": "Identifies the current user or owner of a compromised system.",
    "T1210": "Exploits a vulnerability in a remote service to move laterally.",
    "T1570": "Transfers tools between systems on a compromised network.",
    "T1021": "Uses standard remote access services (RDP, SSH, WinRM) to move laterally.",
    "T1072": "Abuses legitimate software deployment tools to run code across many systems.",
    "T1550": "Uses stolen authentication material (tokens, hashes) instead of plaintext credentials.",
    "T1560": "Compresses or encrypts collected data before exfiltration.",
    "T1119": "Automatically collects data of interest via scripts or built-in tools.",
    "T1115": "Collects data from the system clipboard.",
    "T1005": "Collects data from a local system's files and drives.",
    "T1039": "Collects data from network-shared drives.",
    "T1074": "Stages collected data in a central location before exfiltration.",
    "T1056": "Captures user input (keystrokes, forms) to obtain credentials or data.",
    "T1113": "Captures screenshots of the compromised system.",
    "T1071": "Blends command-and-control traffic into a common application-layer protocol.",
    "T1132": "Encodes C2 traffic to obscure it in transit.",
    "T1568": "Uses dynamic resolution (DGA, fast flux) to make C2 infrastructure resilient.",
    "T1573": "Encrypts C2 traffic to protect its content and evade inspection.",
    "T1105": "Transfers additional tools or files onto a compromised host.",
    "T1095": "Uses a non-application-layer protocol for command and control.",
    "T1571": "Communicates over a non-standard port to blend in or evade filtering.",
    "T1572": "Tunnels C2 traffic through an existing protocol to evade network defenses.",
    "T1090": "Routes traffic through a proxy to obscure the true C2 destination.",
    "T1102": "Uses a legitimate web service as a C2 channel or dead-drop resolver.",
    "T1020": "Automatically exfiltrates data via a scripted or scheduled process.",
    "T1030": "Splits exfiltrated data into limited-size chunks to avoid detection thresholds.",
    "T1048": "Exfiltrates data using a protocol other than the existing C2 channel.",
    "T1041": "Exfiltrates data over the existing command-and-control channel.",
    "T1567": "Exfiltrates data to an external, legitimate web service.",
    "T1029": "Exfiltrates data on a defined schedule to blend in with normal traffic.",
    "T1531": "Removes account access to deny a victim recovery or response.",
    "T1485": "Destroys data or files to disrupt availability.",
    "T1486": "Encrypts data to deny access to it, typically for extortion (ransomware).",
    "T1565": "Manipulates data to affect business processes or decision-making.",
    "T1491": "Alters visible content (website, internal systems) to defacement effect.",
    "T1499": "Degrades or denies availability of a service via resource exhaustion.",
    "T1490": "Disables system recovery features (backups, shadow copies) to inhibit remediation.",
    "T1489": "Stops a service or process to disrupt availability.",
    "T1529": "Shuts down or reboots a system to disrupt availability.",
}


def describe(technique_id: str) -> str:
    found = find_technique(technique_id)
    base = technique_base(technique_id)
    if base in _DESCRIPTIONS:
        return _DESCRIPTIONS[base]
    if found:
        return f"See MITRE ATT&CK for the full definition of {found[1]['name']}."
    return "No description available."


def technique_base(technique_id: str) -> str:
    """'T1110.001' -> 'T1110' — Wazuh events/alerts only ever carry the
    top-level id, so any comparison against a sub-technique has to fall back
    to its parent."""
    return technique_id.split(".")[0] if technique_id else technique_id


_TECHNIQUE_INDEX: dict[str, tuple[Tactic, Technique]] = {}
for _tactic in TACTICS:
    for _tech in _tactic["techniques"]:
        _TECHNIQUE_INDEX.setdefault(_tech["id"], (_tactic, _tech))


def find_technique(technique_id: str) -> tuple[Tactic, Technique] | None:
    return _TECHNIQUE_INDEX.get(technique_id) or _TECHNIQUE_INDEX.get(technique_base(technique_id))


def all_technique_ids() -> list[str]:
    return list(_TECHNIQUE_INDEX.keys())
