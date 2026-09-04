# threat-intel-soar

Şəxs 3 (Threat Intel & SOAR Specialist) tərəfindən idarə olunan qovluq.

**Stack:** MISP + Cortex (threat intel), TheHive + Shuffle (SOAR/avtomatlaşdırma).

## Skriptlər

| Skript | Məqsəd |
|---|---|
| `slack_notifier.py` | Alert-ləri Slack kanalına göndərir (Incoming Webhook) |
| `ticket_creator.py` | TheHive-da yeni case/ticket yaradır |
| `firewall_blocker.py` | Zərərli IP-ni firewall-da bloklayır — **defolt olaraq dry-run**, real block üçün `execute_block()` implement edilməlidir |

## Quraşdırma

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp ..\.env.example ..\.env    # sonra .env-i doldur
```

Doldurulmalı olan bütün dəyərlər üçün kök qovluqdakı `.env.example` və
`docs/SETUP-CHECKLIST.md` sənədlərinə bax (🔴 TODO-DOLDUR işarəli yerlər).

## Test

```bash
python slack_notifier.py --title "Test" --message "Test mesajı" --severity low
python ticket_creator.py --title "Test ticket" --description "Test" --severity 1
python firewall_blocker.py --ip 1.2.3.4
```
