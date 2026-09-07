# SOCore

4 nəfərlik SOC layihəsi.

## Struktur

- `docs/` — sənədləşdirmə (bax: `docs/SETUP-CHECKLIST.md`)
- `socore-backend/` — backend (FastAPI) — bax `socore-backend/README.md`
- `design_zip/` — dashboard/frontend (Vite + React)
- `threat-intel-soar/` — Threat Intel & SOAR (MISP + Cortex, TheHive + Shuffle) — bax `threat-intel-soar/README.md`

## Başlamaq üçün

```bash
cp .env.example .env
```

`.env` faylındakı 🔴 TODO-DOLDUR işarəli dəyərləri `docs/SETUP-CHECKLIST.md`-dəki
addımları izləyərək doldur.
