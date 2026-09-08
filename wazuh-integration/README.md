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
