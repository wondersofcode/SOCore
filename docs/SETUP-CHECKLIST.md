# External services setup checklist

Step-by-step, browser/CLI setup for the external services SOCore's pipeline
integrates with: threat intel enrichment (MISP, Cortex), SOAR automation
(Shuffle), and notifications (Slack). None of these are required for the
core app to run — see the [root README](../README.md#setup) — but without
them the pipeline runs in a degraded (skip/mock) mode.

> Slack notifications, dry-run IP blocking, and case management already run
> inside `socore-backend` itself (see
> [`socore-backend/README.md`](../socore-backend/README.md)) — no separate
> scripts are needed for those. The old standalone scripts referenced below
> live in `docs/archive/threat-intel-soar/` for historical context only.

## 1. Virtual machine

- [ ] Provision a VM for MISP, Cortex, and Shuffle (recommended: 4 vCPU / 8GB RAM minimum)
- [ ] Install Docker and Docker Compose
- [ ] Open the required ports (MISP 443/8443, Cortex 9001, Shuffle 3001)

## 2. MISP (threat intel)

- [ ] Stand up MISP from the official [`misp/misp-docker`](https://github.com/MISP/misp-docker) repo
- [ ] Log into the admin panel and change the default password
- [ ] Create your own API key under **Administration → List Auth Keys**
- [ ] Set `MISP_URL` and `MISP_API_KEY` in `socore-backend/.env`

## 3. Cortex (threat intel analyzers)

- [ ] Stand up Cortex and create the first admin user
- [ ] Enable the analyzers you need (e.g. VirusTotal, AbuseIPDB)
- [ ] Generate an API key for a new "orgadmin" user
- [ ] Set `CORTEX_URL` and `CORTEX_API_KEY` in `socore-backend/.env`

## 4. TheHive — deprecated, superseded by built-in case management

TheHive became commercial as of v5 (license required after a 14-day
trial), so it is **not used**. Case management is implemented natively in
`socore-backend`'s `/api/cases*` endpoints instead — see
[`socore-backend/README.md`](../socore-backend/README.md). None of the
steps below are needed:

- ~~Stand up TheHive (with its Cassandra + Elasticsearch dependencies)~~
- ~~Create an API key under Admin panel → Organisation → Users~~
- ~~Connect Cortex to TheHive under Admin → Cortex~~
- ~~Set `THEHIVE_URL` and `THEHIVE_API_KEY` in `.env`~~

## 5. Shuffle (SOAR automation)

- [ ] Create an account on [shuffle.io](https://shuffler.io) (or stand up a self-hosted instance)
- [ ] Build a workflow and note its **Webhook Trigger** node URL (not Shuffle's own login URL)
- [ ] Set `SHUFFLE_WEBHOOK_URL` in `socore-backend/.env` to that trigger URL — high-risk alerts are POSTed here automatically

## 6. Slack

Slack notifications already run inside `socore-backend` itself
(`app/actions.py::send_slack_alert` — see
[`socore-backend/README.md`](../socore-backend/README.md)). You only need
to create the webhook:

- [ ] Create a new app at [api.slack.com/apps](https://api.slack.com/apps)
- [ ] Enable **Incoming Webhooks** and pick the alert channel
- [ ] Set the webhook URL as `SLACK_WEBHOOK_URL` in **`socore-backend/.env`** (not the repo root `.env` — there isn't one)

## 7. VirusTotal

- [ ] Create an account at [virustotal.com](https://www.virustotal.com)
- [ ] Copy your API key from Profile → API Key
- [ ] Enter the same key into Cortex's VirusTotal analyzer configuration

## 8. AbuseIPDB

- [ ] Create an account at [abuseipdb.com](https://www.abuseipdb.com)
- [ ] Account → API → Create Key
- [ ] Enter the same key into Cortex's AbuseIPDB analyzer configuration

## 9. Test the pipeline end-to-end

- [ ] `cd socore-backend && uvicorn app.main:app --reload --port 8000`
- [ ] `POST http://localhost:8000/api/ingest` with a test Wazuh event (see the
      JSON example in [`socore-backend/README.md`](../socore-backend/README.md#wiring-up-wazuh))
      — the Slack notification and risk scoring will fire automatically
- [ ] Approve the resulting alert from the dashboard (or `/docs` Swagger UI)
      — the dry-run IP block and Slack notification should appear in the backend logs

## 10. Wazuh → Backend integration

This integration has been verified fully end-to-end against a real Windows
agent (Brute Force / T1110, "Multiple Windows Logon Failures" rule) — it's
not just wired up, it's confirmed working against real detections. See
[`wazuh-integration/README.md`](../wazuh-integration/README.md) for the
manager-side setup.

## Note on IP blocking

`socore-backend/app/actions.py`'s `block_ip()` **never performs a real
block** by default, for safety — it only logs what it would do. If real
blocking is needed, that function needs to be deliberately implemented
against a real firewall (iptables / cloud provider / NGFW) after the team
agrees on the approach.
