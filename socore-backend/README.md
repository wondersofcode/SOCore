# SOCore Backend

Detection ilə dashboard arasındakı "beyin": Wazuh alertini qəbul edir, risk
skoru hesablayır, AI (Groq) izahı əlavə edir, saxlayır və dashboard-a API
verir. Human-in-the-Loop təsdiqi ilə cavab tədbirini (firewall blok dry-run +
Slack) icra edir. Groq həmçinin Dashboard-dakı AI assistant chat-ı və
Reports-dakı AI shift summary-ni işlədir — hər ikisi real data-ya
(alerts/cases/pending) əsaslanır, uydurma cavab vermir.

## İşə salmaq

```bash
cd socore-backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Konfiqurasiya (opsional — key olmasa mock işləyir)
cp .env.example .env
# .env-də GROQ_API_KEY və SLACK_WEBHOOK_URL doldur

uvicorn app.main:app --reload --port 8000
```

Aç: http://localhost:8000/docs (bütün endpoint-ləri buradan test edə bilərsən)

## Dashboard-u qoşmaq

Dashboard qovluğunda:
```bash
VITE_API_URL=http://localhost:8000 npm run dev
```
Backend işləyirsə dashboard avtomatik "live" data-ya keçir; işləmirsə nümunə
data ilə açılır (yəni backend olmadan da sınaya bilərsən).

## Endpoint-lər

| Metod | Yol | Nə edir |
|---|---|---|
| GET  | /api/health | Status, AI aktivdirmi, hər inteqrasiyanın real connection statusu |
| GET  | /api/me | Cari istifadəçinin profili (ad, rol, tema, saat qurşağı) |
| PATCH | /api/profile | Profil yenilə (ad, avatar, tema, saat qurşağı) |
| POST | /api/ingest | Wazuh alertini qəbul edir, skorlayır, izah verir |
| GET  | /api/alerts | Bütün alertlər (dashboard bunu oxuyur) |
| GET  | /api/alerts/{id} | Tək alert |
| GET  | /api/pending | Təsdiq gözləyənlər |
| GET  | /api/decisions | Audit trail |
| POST | /api/approve/{id} | Analitik təsdiqi/rəddi (HITL) |
| GET  | /api/events, /api/events/{id}, /api/events/count | Xam Wazuh hadisə tarixçəsi |
| GET/POST/PATCH | /api/cases* | Case idarəetməsi (yaratma, qeyd, tapşırıq, status) |
| POST | /api/assistant/chat | AI chat — real alert/case/approval data-sına əsaslanaraq Groq ilə cavab |
| GET  | /api/reports/shift-summary | AI növbə xülasəsi (8/12/24 saat, 5 dəq keş) |
| GET  | /api/reports/export | Növbə hesabatını Excel (.xlsx) kimi endirir |
| GET/POST/PATCH | /api/admin/* | İstifadəçi təsdiqi, rədd, rol dəyişikliyi (yalnız admin) |

## Wazuh-u qoşmaq

Wazuh integration script-i `/api/ingest`-ə bu formatda POST etməlidir:

```json
{
  "source_ip": "77.83.36.190",
  "attack_type": "Brute Force",
  "mitre_id": "T1110",
  "mitre_name": "Brute Force",
  "rule_level": 12,
  "country": "RU",
  "asn": "AS208046",
  "vt_score": 88,
  "abuse_score": 95,
  "raw": "log mətni"
}
```

rule_level (0-15) avtomatik severity-yə çevrilir. vt_score/abuse_score
opsionaldır (Cortex/MISP-dən gələ bilər, gəlməsə 0 sayılır).
