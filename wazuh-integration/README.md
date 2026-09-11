# wazuh-integration

Custom Wazuh manager integration that forwards attack alerts to
`socore-backend`'s `/api/ingest`.

Two agents feed the same manager: the real Windows agent, and a second
Wazuh agent installed directly on the SOCore VM itself (official `.deb`,
enrolled against the manager's own `127.0.0.1:11514`/`1515`) so the VM's
own SSH logins and system events are monitored too — both go through
this exact same integration script and filtering.

## Deployment

These two files live at `/var/ossec/integrations/` inside the
`single-node-wazuh.manager-1` container (a named Docker volume,
`wazuh_integrations`, so they survive container recreation):

- `custom-socore-integration` — shell wrapper (Wazuh's own convention:
  the executable name Wazuh calls, which resolves the bundled Python
  interpreter and invokes the matching `.py` file)
- `custom-socore-integration.py` — the actual logic

`local_rules.xml` in this folder is a copy of what's deployed at
`/var/ossec/etc/rules/local_rules.xml` inside the manager container (a
separate persistent volume, `wazuh_etc`, from the integrations one
above) — kept here so its (currently unmodified) state and the history
of what was tried against rule 60110 are visible in git.

Both need `root:wazuh` ownership and `750` permissions, matching Wazuh's
built-in integrations (`shuffle`, `slack`, etc.) in the same directory.

## ossec.conf

```xml
<integration>
  <name>custom-socore-integration</name>
  <hook_url>http://172.22.0.1:8000/api/ingest</hook_url>
  <level>7</level>
  <alert_format>json</alert_format>
</integration>
```

`172.22.0.1` is the `single-node_default` Docker bridge gateway IP, not
`localhost` — the manager container can't reach the backend's own
loopback. `socore-backend`'s systemd unit binds to this address
specifically (not `0.0.0.0`) so it stays unreachable from outside the
VM while still reachable from Nginx and this container.

## Noise filtering

A bare `<level>7</level>` filter catches every Wazuh subsystem, not
just attacks — e.g. a freshly-enrolled agent's one-time SCA policy scan
fires ~350 individual level-7 "compliance failed" findings in a single
burst (`attack_type: "Sca"`, `source_ip: "0.0.0.0"`). The script skips
alerts belonging to `EXCLUDED_GROUPS` (currently just `sca`) before
building or sending an event, rather than trying to enumerate every
real attack group in an ossec.conf allowlist — which risks silently
missing a future legitimate one.

A second filter drops routine Windows account activity — a successful
logon (4624), logoff (4634), workstation unlock (4801), or lock (4802)
— when the rule carries no real threat group (`ATTACK_GROUPS`, reusing
`GROUP_ATTACK_TYPE`'s keys). These event IDs alone are normal desktop
use, not something an analyst needs to see; a failed logon (4625) or
anything tagged with a genuine attack group still goes through
regardless of its event ID.

## Duplicate alerts (rule 60110)

A single interactive unlock on Windows creates **two** "user account
changed" audit events (event ID 4738, Wazuh rule 60110 → MITRE T1098
Account Manipulation) a few hundred ms apart — one per linked UAC token
(elevated + filtered), even though nothing about the account actually
changed. Both independently clear the `<level>7</level>` threshold, so
one physical unlock produced two identical-looking alerts, which in
turn produced two Slack notifications from `socore-backend`.

Two attempts at fixing this at the Wazuh rule level did not work:

1. Overriding rule 60110 with `<ignore>5</ignore>` — relies on
   `<ignore>`'s default `same_source_ip` key, but these alerts carry no
   `srcip` (a local Windows security event, not network-sourced), so it
   never found "the same source" and both copies still went out.
2. Adding `<same_field>agent.id</same_field>` to make the key explicit
   — rejected at config-load time: `<same_field>` is only valid paired
   with `<if_matched_sid>`/frequency, not as a plain `<ignore>` modifier.

Lowering rule 60110's level below the forwarding threshold isn't right
either — it's a real detection when it fires for genuine account
tampering, so blanket-suppressing it would blind us to that, not just
this benign per-logon artifact.

`local_rules.xml` is left with rule 60110 at its unmodified base-ruleset
definition. The dedup instead lives in `custom-socore-integration.py`
(`is_duplicate()`, `DEDUP_WINDOW_S`): a small state file, keyed by
`(rule id, agent id)` and guarded by a file lock (two invocations 225ms
apart is exactly the race this needs to survive), drops a repeat of the
same rule/agent within 5 seconds — long enough to catch the linked-token
pair, short enough that two genuinely separate real detections of the
same rule on the same agent still both alert.
