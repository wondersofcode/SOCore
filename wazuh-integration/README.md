# wazuh-integration

Custom Wazuh manager integration that forwards attack alerts to
`socore-backend`'s `/api/ingest`.

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
above) — kept here mainly so the rule-60110 override is visible and
reviewable in git, alongside the integration script it complements.

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
one physical unlock produced two identical-looking alerts.

Fixed at the Wazuh rule level, not in this script: `local_rules.xml`
overrides rule 60110 (`overwrite="yes"`, same match conditions as the
base ruleset's `0580-win-security_rules.xml`) adding `<ignore>5</ignore>`
— repeats of the same rule for the same agent within 5 seconds are
suppressed at the source, so only the first reaches the integration
(and 5s is well under the ~4-minute gap between two genuinely separate
unlocks, so real events a few seconds apart still both alert if the
attack group differs).
