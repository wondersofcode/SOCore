# SETUP CHECKLIST — Şəxs 3 (Threat Intel & SOAR Specialist)

Bu sənəd sənin **əl ilə, brauzerdən** etməli olduğun addımları sadalayır.
Kodla bağlı hər şey (`threat-intel-soar/`) artıq skeleton kimi hazırdır —
bu addımları edərək `.env` faylındakı 🔴 TODO-DOLDUR yerlərini dolduracaqsan.

## 1. Virtual Machine
- [ ] MISP, Cortex, TheHive, Shuffle üçün bir VM hazırla (tövsiyə: min. 4 vCPU / 8GB RAM)
- [ ] Docker və Docker Compose quraşdır
- [ ] Lazımi portları aç (MISP 443/8443, Cortex 9001, TheHive 9000, Shuffle 3001)

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

## 4. TheHive (SOAR case management)
- [ ] TheHive-ı qaldır (Cassandra + Elasticsearch asılılıqları ilə)
- [ ] Admin panel > Organisation > Users bölməsindən özünə API key yarat
- [ ] Cortex-i TheHive-a qoşmaq üçün **Admin > Cortex** bölməsində Cortex API key-ini daxil et
- [ ] `.env` faylında `THEHIVE_URL` və `THEHIVE_API_KEY`-i doldur

## 5. Shuffle (SOAR avtomatlaşdırma)
- [ ] shuffle.io-da (və ya self-hosted) hesab aç / instance qaldır
- [ ] Settings > API Keys bölməsindən API key yarat
- [ ] `.env` faylında `SHUFFLE_URL` və `SHUFFLE_API_KEY`-i doldur
- [ ] TheHive alert-lərini Shuffle workflow-una bağlamaq üçün webhook trigger qur

## 6. Slack
- [ ] [api.slack.com/apps](https://api.slack.com/apps) saytında yeni app yarat
- [ ] **Incoming Webhooks**-u aktiv et, alert kanalını seç
- [ ] Webhook URL-ni `.env` faylında `SLACK_WEBHOOK_URL`-ə yaz

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

## 9. Test (skriptlər hazır olduqdan sonra)
- [ ] `python threat-intel-soar/slack_notifier.py --title Test --message "test" --severity low`
- [ ] `python threat-intel-soar/ticket_creator.py --title "Test ticket" --description test --severity 1`
- [ ] `python threat-intel-soar/firewall_blocker.py --ip 1.2.3.4` (dry-run — real block yoxdur)

## Qeyd
`firewall_blocker.py` təhlükəsizlik səbəbindən defolt olaraq **heç vaxt real
block etmir** — yalnız nə edəcəyini loglayır. Real block lazım olarsa, əvvəlcə
komanda ilə razılaşıb `firewall_blocker.py`-dakı `execute_block()` funksiyasını
öz mühitinizə uyğun implement etmək lazımdır.
