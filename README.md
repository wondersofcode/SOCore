# SOCore

4 nəfərlik SOC layihəsi.

## Struktur

- `docs/` — sənədləşdirmə (bax: `docs/SETUP-CHECKLIST.md`)
- `socore-backend/` — backend (FastAPI) — bax `socore-backend/README.md`
- `design_zip/` — dashboard/frontend (Vite + React)
- `docs/archive/threat-intel-soar/` — ilkin Threat Intel/SOAR skriptləri (arxiv, bax `docs/archive/threat-intel-soar/README.md`) — Slack/dry-run blok/case funksionallığı indi `socore-backend`-dədir; MISP/Cortex/Shuffle üçün bax `docs/SETUP-CHECKLIST.md`

## Başlamaq üçün

```bash
cp .env.example .env
```

`.env` faylındakı 🔴 TODO-DOLDUR işarəli dəyərləri `docs/SETUP-CHECKLIST.md`-dəki
addımları izləyərək doldur.
