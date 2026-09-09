#!/var/ossec/framework/python/bin/python3
# custom-socore-integration: forwards Wazuh alerts to the SOCore backend's /api/ingest.
#
# ossec.conf configuration:
# <integration>
#  <name>custom-socore-integration</name>
#  <hook_url>http://172.22.0.1:8000/api/ingest</hook_url>
#  <level>7</level>
#  <alert_format>json</alert_format>
# </integration>
#
# Error Codes:
#   1 - Module requests not found
#   2 - Incorrect input arguments
#   6 - Alert file does not exist
#   7 - Error getting json_alert

import fcntl
import json
import os
import sys
import time

ERR_NO_REQUEST_MODULE = 1
ERR_BAD_ARGUMENTS = 2
ERR_FILE_NOT_FOUND = 6
ERR_INVALID_JSON = 7

# Wazuh rule groups that are housekeeping/compliance noise, not attacks. A
# <level>7</level> filter alone can't tell these apart from a real threat —
# e.g. a single SCA policy scan on a freshly-enrolled agent fires ~350
# individual level-7 findings ("Sca" attack_type, source_ip 0.0.0.0) in one
# burst. Skip them here rather than trying to enumerate every real attack
# group in an ossec.conf allowlist, which would risk silently missing a
# future legitimate one.
EXCLUDED_GROUPS = {'sca'}

# Windows Security event IDs for routine, expected user activity — a
# successful logon (4624), logoff (4634), or workstation unlock (4801) /
# lock (4802). These alone are not a signal worth an analyst's attention;
# only filtered when the rule ALSO carries no real attack group (see
# ATTACK_GROUPS below), so a genuine correlation that happens to touch one
# of these event IDs still gets through. Failed logons (4625) are
# deliberately absent — those always pass.
NORMAL_ACTIVITY_EVENT_IDS = {'4624', '4634', '4801', '4802'}

# Some Windows security events legitimately fire more than once for one
# physical action — e.g. rule 60110 ("User account changed", 4738) fires
# twice per interactive unlock, once per UAC linked token, ~0.1-0.3s apart
# in Wazuh's own alert timestamps, with nothing actually changed either
# time. Wazuh's own <ignore> rule mechanism doesn't help here (see
# local_rules.xml for why two attempts at fixing it there didn't work), so
# it's deduped here instead: any repeat of the same (rule id, agent) within
# this many seconds is dropped.
#
# Not 5s: wazuh-integratord runs queued integration calls one at a time,
# waiting for each script invocation (this one) to exit before starting the
# next. send_event()'s POST can itself take up to 25s (its own timeout),
# most of it /api/ingest's own MISP+Cortex enrichment — so two alerts that
# were 0.2s apart in Wazuh can end up ~19s apart by the time this script
# actually runs for the second one (confirmed from actual invocation
# timestamps, not the alerts' own). 60s covers that with margin; two
# genuinely separate real detections of the same rule/agent within a
# minute are rare enough to accept the tradeoff.
DEDUP_WINDOW_S = 60

# Rule groups that name a platform/subsystem, not an attack — never usable
# as attack_type even as a last resort (this is how "Windows" was showing up
# as the attack type for a brute-force alert: groups[0] happened to be the
# generic OS group, not the actual threat category).
NON_ATTACK_GROUPS = {
    'windows', 'windows_security', 'linux', 'macos', 'solaris', 'bsd', 'aix',
    'hp-ux', 'syslog', 'ossec', 'wazuh', 'gpg13', 'gdpr', 'pci_dss', 'hipaa',
    'nist_800_53', 'tsc', 'audit',
}

# Known Wazuh rule groups mapped to a human-readable attack category, used
# only when the alert carries no MITRE technique name of its own.
GROUP_ATTACK_TYPE = {
    'authentication_failed': 'Brute Force',
    'authentication_failures': 'Brute Force',
    'multiple_auth_failures': 'Brute Force',
    'invalid_login': 'Brute Force',
    'web_attack': 'Web Attack',
    'attacks': 'Attack',
    'attack': 'Attack',
    'intrusion_detection': 'Intrusion Detection',
    'malware': 'Malware',
    'recon': 'Reconnaissance',
    'scan': 'Port Scan',
    'policy_violation': 'Policy Violation',
    'exploit_attempt': 'Exploit Attempt',
}

# Rule groups that name a genuine threat category rather than routine
# activity — reusing GROUP_ATTACK_TYPE's keys, since that's already the
# curated list of "this group means something happened" tags. Presence of
# any of these always overrides NORMAL_ACTIVITY_EVENT_IDS filtering below.
ATTACK_GROUPS = set(GROUP_ATTACK_TYPE)


def derive_attack_type(rule: dict, mitre_technique: str) -> str:
    """
    Pick a human-readable attack category — never a bare platform/OS group
    like "windows" or "linux". Preference order:
      1. The MITRE technique name, if the rule has one (already a clean,
         specific label — e.g. "Brute Force").
      2. A curated mapping from known attack-related rule groups.
      3. The first group that isn't just a platform/compliance tag.
      4. The rule's own description, as a last resort.
    """
    if mitre_technique:
        return mitre_technique

    groups = rule.get('groups') or []
    for g in groups:
        if g in GROUP_ATTACK_TYPE:
            return GROUP_ATTACK_TYPE[g]
    for g in groups:
        if g not in NON_ATTACK_GROUPS:
            return g.replace('_', ' ').title()

    description = rule.get('description') or ''
    return description[:60] if description else 'Unknown'


try:
    import requests
except ModuleNotFoundError:
    print("No module 'requests' found. Install: pip install requests")
    sys.exit(ERR_NO_REQUEST_MODULE)

debug_enabled = False
pwd = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
json_alert = {}

ALERT_INDEX = 1
HOOK_URL_INDEX = 3

LOG_FILE = f'{pwd}/logs/integrations.log'
DEDUP_STATE_FILE = f'{pwd}/logs/socore_dedup_state.json'


def main(args):
    global debug_enabled
    try:
        bad_arguments = False
        if len(args) >= 4:
            msg = '{0} {1} {2} {3} {4}'.format(
                args[1], args[2], args[3], args[4] if len(args) > 4 else '', args[5] if len(args) > 5 else '',
            )
            debug_enabled = len(args) > 4 and args[4] == 'debug'
        else:
            msg = '# ERROR: Wrong arguments'
            bad_arguments = True

        with open(LOG_FILE, 'a') as f:
            f.write(msg + '\n')

        if bad_arguments:
            debug('# ERROR: Exiting, bad arguments. Inputted: %s' % args)
            sys.exit(ERR_BAD_ARGUMENTS)

        process_args(args)
    except Exception as e:
        debug(str(e))
        raise


def process_args(args) -> None:
    debug('# Running SOCore integration')

    alert_file_location: str = args[ALERT_INDEX]
    hook_url: str = args[HOOK_URL_INDEX]

    json_alert = get_json_alert(alert_file_location)
    debug(f"# Opening alert file at '{alert_file_location}' with '{json_alert}'")

    groups = set((json_alert.get('rule', {}) or {}).get('groups') or [])
    excluded = groups & EXCLUDED_GROUPS
    if excluded:
        debug(f'# Skipping alert: excluded group(s) {excluded} (not an attack)')
        return

    if not (groups & ATTACK_GROUPS):
        event_id = str((((json_alert.get('data', {}) or {}).get('win', {}) or {}).get('system', {}) or {}).get('eventID', ''))
        if event_id in NORMAL_ACTIVITY_EVENT_IDS:
            debug(f'# Skipping alert: routine Windows activity (event ID {event_id}), no attack group present')
            return

    rule_id = str((json_alert.get('rule', {}) or {}).get('id', ''))
    agent_id = str((json_alert.get('agent', {}) or {}).get('id', ''))
    if rule_id and is_duplicate(rule_id, agent_id):
        debug(f'# Skipping alert: duplicate of rule {rule_id} for agent {agent_id} within {DEDUP_WINDOW_S}s')
        return

    event = build_wazuh_event(json_alert)
    debug(f'# Sending event: {event}')

    send_event(event, hook_url)


def build_wazuh_event(alert: dict) -> dict:
    """Map a raw Wazuh alert onto the backend's WazuhEvent schema
    (see socore-backend/app/models.py)."""
    data = alert.get('data', {}) or {}
    rule = alert.get('rule', {}) or {}
    mitre = rule.get('mitre', {}) or {}
    agent = alert.get('agent', {}) or {}

    source_ip = (
        data.get('srcip')
        or data.get('src_ip')
        or (data.get('win', {}) or {}).get('eventdata', {}).get('ipAddress')
        or agent.get('ip')
        or '0.0.0.0'
    )

    mitre_ids = mitre.get('id') or []
    mitre_techniques = mitre.get('technique') or []
    mitre_name = mitre_techniques[0] if mitre_techniques else ''
    attack_type = derive_attack_type(rule, mitre_name)

    return {
        'source_ip': source_ip,
        'attack_type': attack_type,
        'mitre_id': mitre_ids[0] if mitre_ids else '',
        'mitre_name': mitre_name,
        'rule_id': str(rule.get('id', '')),
        'rule_level': rule.get('level', 5),
        'rule_description': rule.get('description', ''),
        'agent_id': str(agent.get('id', '')),
        'agent_name': agent.get('name', ''),
        'country': '',
        'asn': '',
        'raw': alert.get('full_log') or json.dumps(alert),
        'timestamp': alert.get('timestamp'),
    }


def is_duplicate(rule_id: str, agent_id: str) -> bool:
    """
    True if (rule_id, agent_id) was already forwarded within DEDUP_WINDOW_S
    seconds. Wazuh invokes this script as a fresh process per alert, so
    there's no in-memory state to check against — a small state file does
    the job instead, with an exclusive file lock around the read-check-write
    so two invocations landing at nearly the same instant (the exact case
    this exists for) can't both read "not seen yet" before either writes.
    """
    key = f'{rule_id}:{agent_id}'
    now = time.time()
    lock_path = DEDUP_STATE_FILE + '.lock'
    with open(lock_path, 'a') as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            try:
                with open(DEDUP_STATE_FILE) as f:
                    state = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                state = {}

            last_seen = state.get(key)
            duplicate = last_seen is not None and (now - last_seen) < DEDUP_WINDOW_S

            # Prune anything outside the window so the file doesn't grow forever.
            state = {k: t for k, t in state.items() if now - t < DEDUP_WINDOW_S}
            state[key] = now
            with open(DEDUP_STATE_FILE, 'w') as f:
                json.dump(state, f)

            return duplicate
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)


def send_event(event: dict, hook_url: str) -> None:
    try:
        response = requests.post(hook_url, json=event, timeout=25)
        debug(f'# Response received: {response.status_code} {response.text}')
    except Exception as e:
        debug(f'# ERROR: Request to {hook_url} failed: {e}')


def debug(msg: str) -> None:
    if debug_enabled:
        print(msg)
    with open(LOG_FILE, 'a') as f:
        f.write(msg + '\n')


def get_json_alert(file_location: str) -> dict:
    try:
        with open(file_location) as alert_file:
            return json.load(alert_file)
    except FileNotFoundError:
        debug(f"# Failed getting json_alert. Alert file {file_location} doesn't exist")
        sys.exit(ERR_FILE_NOT_FOUND)
    except json.decoder.JSONDecodeError as e:
        debug(f'# Failed getting json_alert. Error: {e}')
        sys.exit(ERR_INVALID_JSON)


if __name__ == '__main__':
    main(sys.argv)
