# socore-backend

FastAPI backend for SOCore — ingests raw Wazuh events, enriches and scores
them into alerts, gets AI explanations/chat/shift-summaries from Groq,
manages the human-in-the-loop approval flow, and serves it all to the
dashboard over a REST API.

See the [root README](../README.md) for the overall architecture and the
full setup flow (Supabase, frontend, external services). This file covers
the backend specifically: getting it running, the endpoint list, and how
to wire a real Wazuh manager into it.

## Getting started

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Fill in at least DATABASE_URL and SUPABASE_URL — see the table below.
# Everything else is optional; unconfigured integrations degrade
# gracefully (mock/skip) instead of crashing the app.

uvicorn app.main:app --reload --port 8000
```

Interactive docs (Swagger UI) at `http://localhost:8000/docs` — every
endpoint below is directly testable from there, including auth-protected
ones (use the "Authorize" button with a Supabase-issued JWT).

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | Supabase's direct Postgres connection string (`Settings → Database → Connection string → URI`). Without it the backend won't start persisting anything. |
| `SUPABASE_URL` | **Yes** | Your Supabase project's base URL (`Settings → API → Project URL`), used to fetch its JWKS and verify auth tokens. Without it, every authenticated endpoint returns `500`. |
| `GROQ_API_KEY` | Recommended | [console.groq.com](https://console.groq.com/keys) — powers alert explanations, the AI assistant chat, and shift summaries. Empty = deterministic template fallback instead of a real AI call. |
| `PUBLIC_HOST` | No | Your own VM's public IP/host. Used only to build the "Open tool" links inside `GET /api/health`'s connection-status payload (Wazuh dashboard, MISP, Cortex, Shuffle). Defaults to the demo VM's IP if unset. |
| `SLACK_WEBHOOK_URL` | No | Incoming webhook for alert/decision notifications. Skipped silently if unset. |
| `MISP_URL`, `MISP_API_KEY`, `MISP_VERIFY_SSL` | No | MISP instance for IOC lookups. Skipped if unset. |
| `CORTEX_URL`, `CORTEX_API_KEY` | No | Cortex instance (VirusTotal/AbuseIPDB analyzers). Skipped if unset. |
| `SHUFFLE_WEBHOOK_URL` | No | The specific workflow's **Webhook Trigger** URL (not Shuffle's own login URL) — high-risk alerts are POSTed here for SOAR automation. Skipped if unset. |

### Connecting the dashboard

Point the frontend's `VITE_API_URL` at wherever this is running
(`http://localhost:8000` for local dev). See
[`design_zip`](../design_zip) / the root README for frontend setup.

## Endpoints

| Method & Path | Description |
|---|---|
| `GET /api/health` | Live connection status (real TCP reachability checks) for Wazuh, MISP, Cortex, Shuffle, Slack — plus "Open tool" links built from `PUBLIC_HOST`. Powers the dashboard's System Health / Pipeline Connections panels. |
| `GET /api/profile` | Current authenticated user's profile (role, status, theme, timezone). |
| `PATCH /api/profile` | Update the current user's own profile (theme, timezone, avatar). |
| `POST /api/ingest` | Wazuh manager → backend webhook. Accepts a raw Wazuh alert JSON, stores it as an `Event`, runs correlation/enrichment, and — if it clears the risk threshold — produces a scored `Alert`. |
| `GET /api/alerts` | List alerts (paginated, filterable by severity/status/search). |
| `GET /api/alerts/{id}` | Single alert detail, including its AI explanation, MITRE technique, and enrichment data. |
| `GET /api/alerts/{id}/explain` | Fetch (or lazily generate) the Groq explanation for one alert. |
| `GET /api/pending` | Alerts currently awaiting analyst approval. |
| `POST /api/decisions` | Record an analyst's approve/reject decision on an alert; writes to the audit trail and, if approved, triggers the response action / Shuffle handoff. |
| `GET /api/decisions` | Decision/audit history. |
| `GET /api/events` | Raw Wazuh event history (every event received, independent of whether it became an alert). |
| `GET /api/events/{id}` | Single raw event, including its original JSON payload. |
| `GET /api/cases` | List cases (Kanban board data: Open / Investigating / Contained / Closed). |
| `POST /api/cases` | Create a case, optionally linked to one or more alerts. |
| `PATCH /api/cases/{id}` | Update a case's status, notes, or tasks. |
| `GET /api/mitre` | ATT&CK Center: the full Enterprise matrix with coverage status/counts computed live from real `alerts` + `simulation_runs` rows. |
| `GET /api/mitre/{technique_id}` | One technique's detail: coverage stats, related alerts, related cases, related simulation runs. |
| `GET /api/simulations` | Simulation Center catalog (the allowlisted, controlled detection-validation tests) with real run stats per entry. |
| `GET /api/simulations/summary` | Simulation Center overview metrics (passed/failed/running, detection rate, techniques never tested). |
| `GET /api/simulations/{id}` | One catalog entry's detail. |
| `POST /api/simulations/{id}/runs` | *(l2_analyst/admin)* Start a controlled run — opens a detection window, executes nothing. |
| `GET /api/simulations/runs` | Run history, filterable by `techniqueId`/`status`/`platform`. |
| `GET /api/simulations/runs/{id}` | One run's detail: current evidence-based status + a real timeline (Wazuh event → ingestion → correlation → alert → response). |
| `POST /api/simulations/runs/{id}/mark-executed` | *(l2_analyst/admin)* Analyst confirms the manual test was actually performed. |
| `POST /api/assistant/chat` | AI assistant chat — answers a free-text question via Groq, grounded in a snapshot of current alerts/cases/pending approvals. |
| `GET /api/reports/shift-summary` | Groq-generated shift recap for an 8/12/24-hour window (5-minute cache). |
| `GET /api/reports/shift-summary/export` | The same window exported as a full Excel workbook (Executive Summary + Alerts/Cases/Events/Decisions sheets), built with `openpyxl`. |
| `GET /api/admin/users` | *(admin only)* List all users, including pending registrations. |
| `POST /api/admin/users/{id}/approve` | *(admin only)* Approve a pending registration. |
| `PATCH /api/admin/users/{id}/role` | *(admin only)* Change a user's role (`l1_analyst` / `l2_analyst` / `admin`). |

This table is kept in sync with `app/main.py` — if you add a route, update it here too. The live, always-accurate version is `/docs`.

## ATT&CK Center & Simulation Center

**ATT&CK Center** (`app/mitre.py`, `app/mitre_attack_data.py`) renders the
Enterprise ATT&CK matrix (public MITRE taxonomy, static) and layers a live
coverage status on every technique, computed from two real sources only:

- `alerts.mitre_id` — every alert already carries the technique Wazuh
  reported (see `correlation.py`). A technique with at least one alert is
  `detected`.
- `simulation_runs` — a technique with no real alerts but a passed
  simulation run is `tested_passed`; failed/partial runs and no alerts is
  `tested_failed`; no alerts and no runs is `not_tested`.

Nothing here is fabricated — a technique the platform has never seen from
either source reports `not_tested`, never an invented percentage.

**Simulation Center** (`app/simulation_catalog.py`, `app/simulations.py`) is
a *detection-validation* tool, not an attack platform:

- The catalog is a fixed, reviewed allowlist in code — there is no
  "create simulation" endpoint and no remote-exec surface anywhere in this
  backend. Starting a run (`POST /api/simulations/{id}/runs`) only inserts a
  `simulation_runs` row and opens a detection window; it never runs anything.
  The analyst performs the documented manual action themselves, against
  infrastructure they already control.
- Detection success is decided later, purely from whatever real
  `events`/`alerts` rows land in that window: **PASSED** requires both a
  matching `Event` and an `Alert` correctly mapped to the technique under
  test — never just "the endpoint was called". **PARTIAL** means telemetry
  arrived but never became a correctly-mapped alert. **FAILED** means the
  analyst confirmed (`mark-executed`) they ran the test and nothing was
  observed. **NOT_OBSERVED** means the window closed and the test was never
  confirmed as having actually run — kept distinct from FAILED because that
  is a genuinely different fact.
- `simulation.run` (starting a run / marking one executed) requires the
  `l2_analyst` or `admin` role (`auth.require_l2_or_admin`), the same tier as
  the frontend's other "touches real infrastructure" actions. Viewing the
  catalog, coverage, and history only requires being an approved analyst.
  Every run row records who started it, when, what was tested, and the
  result — the row itself is the audit trail.

## Wiring up Wazuh

If you have a real Wazuh manager, see
[`../wazuh-integration/README.md`](../wazuh-integration/README.md) for the
manager-side integration script and `ossec.conf` block.

If you just want to exercise the pipeline without a live Wazuh manager, you
can POST directly to `/api/ingest` in the shape Wazuh itself sends:

```json
{
  "rule": {
    "id": "5710",
    "level": 10,
    "description": "sshd: brute force trying to get access to the system.",
    "groups": ["authentication_failed", "brute_force"]
  },
  "agent": { "id": "002", "name": "web-server-01" },
  "data": { "srcip": "203.0.113.45" },
  "full_log": "Sep 11 17:52:09 sshd[1234]: Failed password for root from 203.0.113.45 port 51422 ssh2",
  "timestamp": "2026-09-11T17:52:09.021+0000"
}
```

`rule.level` (0–15) is Wazuh's own severity scale and is what the
correlation engine's risk scoring is built on:

| `rule.level` | Mapped severity |
|---|---|
| 0–6 | Low |
| 7–9 | Medium |
| 10–12 | High |
| 13–15 | Critical |

Every event is stored as-is first (`/api/events`) regardless of its level;
only events that clear the configured alerting threshold and pass
correlation become an `Alert`.
