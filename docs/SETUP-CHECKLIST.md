# SETUP CHECKLIST — Şəxs 3 (Threat Intel & SOAR Specialist)

Bu sənəd sənin **əl ilə, brauzerdən** etməli olduğun addımları sadalayır.

🔵 YENİLƏNİB: Slack bildirişi, dry-run IP blok və case idarəetməsi artıq
`socore-backend`-in özündə işləyir (bax `socore-backend/README.md`) —
bunlar üçün ayrıca skript qurmağa ehtiyac yoxdur (köhnə skriptlər
`docs/archive/threat-intel-soar/`-dadır, tarixi kontekst üçün). Threat
intel enrichment (MISP/Cortex) və SOAR avtomatlaşdırma (Shuffle) üçün
aşağıdakı VM addımları hələ də aktualdır.

## 1. Virtual Machine
- [ ] MISP, Cortex, Shuffle üçün bir VM hazırla (tövsiyə: min. 4 vCPU / 8GB RAM)
- [ ] Docker və Docker Compose quraşdır
- [ ] Lazımi portları aç (MISP 443/8443, Cortex 9001, Shuffle 3001)

## 2. MISP (Threat Intel)
- [ ] Rəsmi `misp/misp-docker` reposundan MISP-i qaldır
- [ ] Admin panelə daxil ol, default şifrəni dəyiş
- [ ] **Administration > List Auth Keys** bölməsindən özünə API key yarat
- [ ] `.env` faylında `MISP_URL` və `MISP_API_KEY`-i doldur

## 3. Cortex (Threat Intel Analyzers)
- [ ] Cortex-i qaldır, ilk admin istifadəçini yarat
- [ ] Lazımi analyzer-ləri aktiv et (məs. VirusTotal, AbuseIPDB)
- [ ] Yeni "orgadmin" user üçün API key generasiya et
- [ ] `.env` faylında `CORTEX_URL` və `CORTEX_API_KEY`-i doldur

## 4. TheHive (SOAR case management) — 🔴 KÖHNƏLMİŞ, bax `socore-backend/README.md`
TheHive 5-dən etibarən komersiyalaşıb (14 günlük trial-dan sonra lisenziya
tələb edir), buna görə **istifadə olunmur**. Case idarəetməsi
`socore-backend`-in `/api/cases*` endpoint-lərində daxili həyata keçirilib.
Aşağıdakı addımlara artıq ehtiyac yoxdur:
- ~~TheHive-ı qaldır (Cassandra + Elasticsearch asılılıqları ilə)~~
- ~~Admin panel > Organisation > Users bölməsindən özünə API key yarat~~
- ~~Cortex-i TheHive-a qoşmaq üçün Admin > Cortex bölməsində API key daxil et~~
- ~~`.env` faylında `THEHIVE_URL` və `THEHIVE_API_KEY`-i doldur~~

## 5. Shuffle (SOAR avtomatlaşdırma)
- [ ] shuffle.io-da (və ya self-hosted) hesab aç / instance qaldır
- [ ] Settings > API Keys bölməsindən API key yarat
- [ ] `.env` faylında `SHUFFLE_URL` və `SHUFFLE_API_KEY`-i doldur
- [ ] MISP/Cortex alert-lərini Shuffle workflow-una bağlamaq üçün webhook trigger qur (TheHive artıq yoxdur, bax bənd 4)

## 6. Slack — 🔴 KÖHNƏLMİŞ hissə var, bax aşağı
Slack bildirişi artıq `socore-backend`-in özündə işləyir
(`app/actions.py::send_slack_alert`, bax `socore-backend/README.md`).
Yalnız webhook-u yaratmaq lazımdır:
- [ ] [api.slack.com/apps](https://api.slack.com/apps) saytında yeni app yarat
- [ ] **Incoming Webhooks**-u aktiv et, alert kanalını seç
- [ ] Webhook URL-ni **`socore-backend/.env`** faylında `SLACK_WEBHOOK_URL`-ə yaz (kök `.env` deyil)

## 7. VirusTotal
- [ ] [virustotal.com](https://www.virustotal.com)-da hesab aç
- [ ] Profile > API Key-i kopyala
- [ ] `.env` faylında `VIRUSTOTAL_API_KEY`-i doldur
- [ ] Cortex-də VirusTotal analyzer-inə eyni key-i daxil et

## 8. AbuseIPDB
- [ ] [abuseipdb.com](https://www.abuseipdb.com)-da hesab aç
- [ ] Account > API > Create Key
- [ ] `.env` faylında `ABUSEIPDB_API_KEY`-i doldur
- [ ] Cortex-də AbuseIPDB analyzer-inə eyni key-i daxil et

## 9. Test — 🔴 köhnə skript addımları silindi
`slack_notifier.py` / `ticket_creator.py` / `firewall_blocker.py` skriptləri
arxivləşdirilib (bax `docs/archive/threat-intel-soar/`). Bunun əvəzinə real
indiki axını test et:
- [ ] `cd socore-backend && uvicorn app.main:app --reload --port 8000`
- [ ] `POST http://localhost:8000/api/ingest` bir test Wazuh event-i ilə —
      Slack bildirişi və risk skoru avtomatik işləyəcək (bax
      `socore-backend/README.md`-dəki JSON nümunəsi)
- [ ] Dashboard-dan (və ya `/docs` Swagger UI-dan) bir alert-i approve et —
      dry-run IP blok + Slack bildirişi backend loglarında görünəcək

## 10. Wazuh → Backend inteqrasiyası
Wazuh→Backend inteqrasiyası mexanizm səviyyəsində tam yoxlanılıb (integratord
tanıyır, script işləyir, backend qəbul edir). Real agent-dən gələn hücumla
tam uçdan-uca test edilməyib, çünki hazırda Wazuh-a bağlı aktiv agent yoxdur —
bu, demo zamanı bir qurban maşın (məs. Metasploitable) Wazuh agent-i ilə
qoşulanda avtomatik işə düşəcək.

## Qeyd
`socore-backend/app/actions.py`-dakı `block_ip()` təhlükəsizlik səbəbindən
defolt olaraq **heç vaxt real block etmir** — yalnız nə edəcəyini loglayır.
Real block lazım olarsa, əvvəlcə komanda ilə razılaşıb bu funksiyanı real
firewall-a (iptables/cloud provider/NGFW) uyğun implement etmək lazımdır.
