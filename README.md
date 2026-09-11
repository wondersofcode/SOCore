<p align="center">
  <img src="design_zip/public/logo.png" alt="SOCore" width="220">
</p>

<h1 align="center">SOCore</h1>

<p align="center">
  <b>Real Wazuh alertlərini anında AI-dəstəkli qərarlara çevirən, human-in-the-loop bir SOC platforması.</b>
</p>

<p align="center">
  <a href="https://socore.tech"><img src="https://img.shields.io/badge/Live%20Demo-socore.tech-4f8cff?style=for-the-badge" alt="Live Demo"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Wazuh-005571?style=flat-square&logo=wazuh&logoColor=white" alt="Wazuh">
  <img src="https://img.shields.io/badge/Groq-F55036?style=flat-square&logoColor=white" alt="Groq">
  <img src="https://img.shields.io/badge/Nginx-009639?style=flat-square&logo=nginx&logoColor=white" alt="Nginx">
  <img src="https://img.shields.io/badge/Google%20Cloud-4285F4?style=flat-square&logo=googlecloud&logoColor=white" alt="Google Cloud">
</p>

---

## Nə edir

SOCore, real bir Wazuh SIEM-dən gələn hadisələri qəbul edən, onları risk səviyyəsinə görə skorlayan, süni intellektlə izah edən və analitikə "təsdiqlə/rədd et" qərarı verən uçdan-uca bir SOC (Security Operations Center) platformasıdır. Məqsəd, klassik SIEM-lərin doldurduğu boşluğu — xam alert selini mənalı, hərəkətə keçirilə bilən siqnala çevirmək — kiçik miqyasda, amma real infrastruktur üzərində göstərməkdir.

Zəncir belə işləyir: **Detect → Enrich → Respond → Track**. Wazuh manager-ə düşən hər hadisə (real Windows agent-dən *və* özü-monitorinq edən VM-in öz Linux agent-indən) əvvəlcə xam şəkildə (`Event`) saxlanılır, sonra MISP (threat intel) və Cortex/VirusTotal/AbuseIPDB (reputasiya analizi) ilə zənginləşdirilir, Groq ilə insan dilində izah alır və risk skoru ilə bir `Alert`-ə çevrilir. Yüksək riskli alertlər analitikin təsdiqini gözləyən bir cavab tədbiri (Human-in-the-Loop) təklif edir; təsdiqlənən/rədd edilən hər qərar audit trail-də izlənir, lazım gəldikdə isə Shuffle üzərindən SOAR avtomatlaşdırmasına ötürülür.

Bu bir demo/mock UI deyil — arxada real Wazuh manager, real Supabase Postgres verilənlər bazası və real GCP VM üzərində işləyən bir backend var. Canlı demoya buradan bax: **[socore.tech](https://socore.tech)**

## Arxitektura

```mermaid
flowchart LR
    WinAgent["Windows Agent\n(Wazuh agent)"] --> Manager["Wazuh Manager"]
    VMAgent["VM-in öz Linux agent-i\n(self-monitoring)"] --> Manager
    Manager -->|"custom-socore-integration.py"| Backend["SOCore Backend\n(FastAPI)"]
    Backend --> DB[("Supabase\nPostgres")]
    Backend <--> MISP["MISP\n(Threat Intel)"]
    Backend <--> Cortex["Cortex\nVirusTotal / AbuseIPDB"]
    Backend --> Groq["Groq\n(izah + AI assistant + shift summary)"]
    Backend -->|"yüksək risk"| Shuffle["Shuffle\n(SOAR workflow)"]
    Backend <--> Dashboard["Dashboard\n(React, Nginx)"]
    Dashboard <--> Auth["Supabase Auth\n(l1 / l2 / admin)"]
```

Wazuh manager hər hadisəni `custom-socore-integration.py` skripti ilə backend-in `/api/ingest` endpoint-inə göndərir. Backend hadisəni əvvəlcə xam (`events` cədvəli), sonra skorlanmış (`alerts` cədvəli) formada Postgres-də saxlayır; dashboard isə bu API-lardan real vaxtda oxuyur. Backend həmçinin `GET /api/health` üzərindən Wazuh/MISP/Cortex/Shuffle/Slack-a real TCP əlçatanlıq yoxlaması edir — Settings səhifəsindəki "Pipeline connections" siyahısı hardcoded deyil, bu yoxlamaların canlı nəticəsidir.

## Texnologiya stack-i

| Qat | Texnologiyalar |
|---|---|
| **Backend** | FastAPI, Python 3, Supabase (Postgres), Groq (AI izah, chat, shift summary) |
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS |
| **SIEM / Threat Intel / SOAR** | Wazuh (manager + 2 agent), MISP, Cortex (VirusTotal, AbuseIPDB), Shuffle |
| **Auth** | Supabase Auth (3 rol: `l1_analyst` / `l2_analyst` / `admin`, qeydiyyat təsdiqi ilə) |
| **İnfrastruktur** | Google Cloud Platform (GCP), Nginx, Let's Encrypt |

## Əsas xüsusiyyətlər

- **Real Wazuh inteqrasiyası, iki mənbədən** — Windows agent *və* VM-in özünü izləyən Linux agent (SSH girişləri, sistem hadisələri), hər ikisi eyni pipeline-dan keçir
- **AI-generated alert izahları** — hər alert Groq ilə insan dilində, risk skorunu əsaslandıran izahla gəlir (VirusTotal/AbuseIPDB skorları ilə birlikdə)
- **AI Assistant chat** — Dashboard-da üzən bir chat widget, cari alert/case/approval data-sına əsaslanaraq analitikin sualına Groq ilə cavab verir (uydurma deyil — real data context-i kimi göndərilir)
- **AI Shift Summary + Excel export** — Reports səhifəsində 8/12/24 saatlıq pəncərə üçün Groq-un yazdığı növbə xülasəsi (5 dəqiqəlik keş ilə), yanında tam bir SOC hesabatı olaraq Excel-ə (Overview + KPI-lar + qrafiklər + Alerts/Cases/Events/Decisions vərəqləri) ixrac düyməsi
- **Human-in-the-Loop təsdiq axını** — yüksək riskli alertlər analitikin təsdiqini gözləyir, hər qərar audit trail-ə yazılır
- **Real threat intelligence + analiz** — MISP (IOC axtarışı) və Cortex üzərindən VirusTotal/AbuseIPDB analizi
- **SOAR avtomatlaşdırması** — yüksək riskli alertlər Shuffle workflow-una avtomatik ötürülür
- **3-səviyyəli rol-əsaslı giriş** — Supabase Auth ilə `l1_analyst` / `l2_analyst` / `admin`; bəzi funksiyalar (məs. inteqrasiya alətinə birbaşa keçid) yalnız L2/Admin-ə açıqdır; yeni qeydiyyatlar admin təsdiqini gözləyir
- **Şəxsi saat qurşağı** — hər istifadəçi öz saat qurşağını seçir, bütün alert/event/case vaxtları ona görə göstərilir
- **Persistent verilənlər bazası** — bütün events/alerts/cases Supabase Postgres-də saxlanılır, restart-da itmir
- **Ayrı Event/Alert modeli** — hər Wazuh hadisəsinin xam forması (`Event`) skorlanmış nəticədən (`Alert`) ayrıca izlənir
- **Canlı Pipeline Connections / System Health** — hər inteqrasiyanın (Wazuh/MISP/Cortex/Shuffle/Slack) "connected" statusu real TCP yoxlaması ilə göstərilir, hardcoded deyil

## Layihə strukturu

```
SOCore/
├── socore-backend/     # FastAPI backend — ingest, korrelyasiya, AI izah/chat/summary, Excel export, API
├── design_zip/         # React + TypeScript dashboard (frontend)
├── wazuh-integration/  # Wazuh manager → backend inteqrasiya script-i
└── docs/               # Sənədləşdirmə (quraşdırma checklist-i və s.)
```

## Quraşdırma

### Backend

```bash
cd socore-backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# .env-də DATABASE_URL (Supabase), GROQ_API_KEY, MISP/CORTEX/SHUFFLE
# dəyərlərini doldur (boş qalsa müvafiq funksiyalar mock/skip rejimində işləyir)

uvicorn app.main:app --reload --port 8000
```

API sənədləşdirməsi: `http://localhost:8000/docs`

### Frontend

```bash
cd design_zip
npm install

# design_zip/.env faylı yarat:
#   VITE_API_URL=http://localhost:8000
#   VITE_SUPABASE_URL=<Supabase layihə URL-i>
#   VITE_SUPABASE_ANON_KEY=<Supabase publishable/anon key>

npm run dev
```

Backend işləmirsə dashboard nümunə (seed) data ilə açılır — yəni backend olmadan da UI-ı sınaya bilərsən.

### Tələb olunan xarici xidmətlər

Platforma tam işləmək üçün aşağıdakı xarici xidmətlərə ehtiyac duyur:

- **Supabase** — Postgres verilənlər bazası + Auth (l1/l2/admin rolları)
- **Groq API key** — AI alert izahları, chat assistant və shift summary üçün ([console.groq.com](https://console.groq.com/keys))
- **Wazuh manager** — real SIEM hadisə mənbəyi
- **MISP** — threat intelligence (IOC axtarışı)
- **Cortex** — VirusTotal/AbuseIPDB analizatorları
- **Shuffle** — SOAR workflow avtomatlaşdırması

Hər birinin necə quraşdırılıb API key alınacağı addım-addım: **[docs/SETUP-CHECKLIST.md](docs/SETUP-CHECKLIST.md)**

## Komanda

Layihə 4 nəfərlik komanda tərəfindən aparılır:

| Rol | Məsuliyyət |
|---|---|
| **SIEM / Infrastructure** | Wazuh manager, agent-lər, GCP VM, deployment |
| **Backend / AI** | FastAPI backend, korrelyasiya məntiqi, Groq inteqrasiyası (izah, chat, shift summary) |
| **Threat Intel / SOAR** | MISP, Cortex, Shuffle inteqrasiyaları və workflow-ları |
| **Detection / Docs** | Wazuh detection qaydaları, sənədləşdirmə, test ssenariləri |
