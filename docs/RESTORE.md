# SOCore — Full Restore Guide

Bu təlimat GCP hesabı bloklandıqda və ya istənilən başqa VM-ə köçmək lazım olduqda
`socore-full-backup.tar.gz` + `socore-secrets.zip` arxivlərindən sistemi tam bərpa etmək üçündür.

---

## 0. Tələblər

| Tələb | Minimum |
|---|---|
| OS | Ubuntu 22.04 LTS (tövsiyə) |
| RAM | 8 GB (MISP + Cortex + Wazuh + Shuffle üçün) |
| Disk | 40 GB SSD |
| İctimai IP | 1 statik IP (DNS üçün lazım) |
| Port | 80, 443, 1514, 1515 açıq olmalıdır |

---

## 1. Yeni VM-ə qoşulun

```bash
# GCP nümunəsi:
gcloud compute ssh <yeni-vm-adı> --zone=<zone> --project=<proje-id>

# Digər provayderlərdə:
ssh ubuntu@<yeni-vm-ip>
```

---

## 2. Docker və Docker Compose quraşdırın

```bash
sudo apt-get update && sudo apt-get upgrade -y

# Docker Engine
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose v2 (plugin)
sudo apt-get install -y docker-compose-plugin

# Yoxlayın
docker --version
docker compose version
```

---

## 3. Arxivi VM-ə köçürün və açın

```bash
# Lokal komputerinizdən (PowerShell və ya Terminal):
gcloud compute scp socore-full-backup.tar.gz <yeni-vm>:~/ --zone=<zone> --project=<proje>
gcloud compute scp socore-secrets.zip        <yeni-vm>:~/ --zone=<zone> --project=<proje>

# VM-də:
tar xzf ~/socore-full-backup.tar.gz -C ~/
ls ~/socore-full-backup/
# → wazuh/ misp/ cortex/ shuffle/ docker/ nginx/ letsencrypt/ env/

# .env faylını açın (zip parolunu daxil edin):
unzip socore-secrets.zip -d ~/socore-full-backup/env/
```

---

## 4. socore-backend .env yerləşdirin

```bash
mkdir -p ~/SOCore/socore-backend
cp ~/socore-full-backup/env/socore-backend.env ~/SOCore/socore-backend/.env

# Faylı yoxlayın — bu dəyişənlər dəyişməməlidir:
#   SUPABASE_URL, SUPABASE_JWT_SECRET, GROQ_API_KEY,
#   DATABASE_URL (Supabase external URL)
# Yalnız VM-ə bağlı dəyişənlər yenilənməlidir (məs. WAZUH_MANAGER yeni IP)
nano ~/SOCore/socore-backend/.env
```

---

## 5. Nginx konfiqurasiyasını bərpa edin

```bash
sudo apt-get install -y nginx

sudo cp ~/socore-full-backup/nginx/sites-available/* /etc/nginx/sites-available/

# Aktiv edin
for F in /etc/nginx/sites-available/*; do
  sudo ln -sf "$F" /etc/nginx/sites-enabled/$(basename "$F")
done

sudo nginx -t            # konfiqurasiyanı yoxlayın
sudo systemctl reload nginx
```

---

## 6. SSL sertifikatları

### 6a. Mövcud sertifikatları köçürün (eyni domen, yeni IP)

```bash
sudo cp -r ~/socore-full-backup/letsencrypt/ /etc/
sudo chmod -R 755 /etc/letsencrypt
sudo chmod -R 600 /etc/letsencrypt/archive
```

### 6b. DNS A qeydini yeniləyin

Domeninizin (socore.tech) DNS idarəçisindən (Cloudflare, Namecheap və s.) gedin:

```
A   @        <ESKİ IP>  →  <YENİ VM IP>
A   www      <ESKİ IP>  →  <YENİ VM IP>
A   wazuh    <ESKİ IP>  →  <YENİ VM IP>   (əgər varsa)
```

DNS yayılmasını gözləyin (5–30 dəqiqə):

```bash
watch -n 10 "dig +short socore.tech"
```

### 6c. Sertifikatı yeniləyin

DNS yayıldıqdan sonra:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

---

## 7. Wazuh bərpası

```bash
# Wazuh docker-compose faylını yerləşdirin
mkdir -p ~/wazuh-docker
cp ~/socore-full-backup/docker/*wazuh*.yml ~/wazuh-docker/docker-compose.yml

# Servis konfiqurasiyasını bərpa edin
# (Docker volume mount yollarını docker-compose.yml ilə uyğunlaşdırın)
cp ~/socore-full-backup/wazuh/ossec.conf       ~/wazuh-docker/config/wazuh_manager/ossec.conf
cp ~/socore-full-backup/wazuh/local_rules.xml  ~/wazuh-docker/config/wazuh_manager/local_rules.xml

# Wazuh-u başladın
cd ~/wazuh-docker
docker compose up -d

# Qeydlərə baxın
docker compose logs -f wazuh.manager
```

### 7a. Agent-ləri yenidən qeydiyyatdan keçirin

**Windows komputerinizdə** (`C:\Program Files (x86)\ossec-agent\ossec.conf`):

```xml
<server>
  <address>YENİ_VM_IP</address>   <!-- buranı dəyişin -->
  <port>1514</port>
  <protocol>tcp</protocol>
</server>
```

Windows PowerShell (Administrator):

```powershell
net stop OssecSvc
# ossec.conf-u yuxarıdakı kimi redaktə edin
net start OssecSvc
```

**VM-in özündəki agent** (`/var/ossec/etc/ossec.conf`):

```bash
sudo nano /var/ossec/etc/ossec.conf
# <address> sahəsini yeni VM IP ilə dəyişin (lokal olarsa 127.0.0.1)
sudo systemctl restart wazuh-agent
```

**Manager-də agent-i authorize edin:**

```bash
docker exec -it <wazuh-manager-container> /var/ossec/bin/manage_agents
# ya da:
docker exec -it <wazuh-manager-container> /var/ossec/bin/agent-auth -m 127.0.0.1
```

---

## 8. MISP bərpası

```bash
mkdir -p ~/misp
cp ~/socore-full-backup/docker/*misp*.yml ~/misp/docker-compose.yml

# MISP-i başladın
cd ~/misp
docker compose up -d

# Event-ləri import edin (serverlər hazır olduqdan sonra):
curl -sk -X POST \
  -H "Authorization: <yeni-admin-api-key>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d @~/socore-full-backup/misp/events_export.json \
  https://localhost/events/add
```

---

## 9. Cortex bərpası

```bash
mkdir -p ~/cortex
cp ~/socore-full-backup/docker/*cortex*.yml ~/cortex/docker-compose.yml
sudo cp ~/socore-full-backup/cortex/application.conf /etc/cortex/ 2>/dev/null || true

cd ~/cortex
docker compose up -d

# Analyzer-ləri yenidən aktiv edin:
# Admin UI → http://<IP>:9001 → Organization → Analyzers
# socore-full-backup/cortex/analyzers.json siyahısına əsasən hər birini manual aktiv edin
# (API key-lər yenidən daxil edilməlidir — backup-da saxlanılmayıb)
```

---

## 10. Shuffle bərpası

```bash
mkdir -p ~/shuffle
cp ~/socore-full-backup/docker/*shuffle*.yml ~/shuffle/docker-compose.yml

cd ~/shuffle
docker compose up -d

# Workflow-ları import edin:
# Admin UI → http://<IP>:3001 → Workflows → Import
# socore-full-backup/shuffle/workflows.json faylını yükləyin
# YA DA API ilə:
curl -s -X POST \
  -H "Authorization: Bearer <yeni-shuffle-key>" \
  -H "Content-Type: application/json" \
  -d @~/socore-full-backup/shuffle/workflows.json \
  http://localhost:3001/api/v1/workflows/import
```

---

## 11. socore-backend xidmətini başladın

```bash
cd ~/SOCore/socore-backend

# .env artıq 4-cü addımda yerləşdirilib
# Docker ilə:
docker compose up -d

# YA DA Node.js ilə birbaşa:
npm install
npm run build
npm start
```

---

## 12. Son yoxlama siyahısı

```bash
# Bütün konteynerləri yoxlayın
docker ps --format "table {{.Names}}\t{{.Status}}"

# Nginx
curl -I https://socore.tech

# Backend API
curl https://socore.tech/api/health

# Wazuh manager
docker logs wazuh.manager 2>&1 | tail -20

# MISP
curl -sk https://localhost/users/login | grep -i misp
```

---

## Qısa Referans: Əsas Port-lar

| Servis | Port |
|---|---|
| Nginx (HTTP) | 80 |
| Nginx (HTTPS) | 443 |
| Wazuh syslog | 514/udp |
| Wazuh agent | 1514/tcp |
| Wazuh enrollment | 1515/tcp |
| Wazuh API | 55000 |
| MISP | 443 (Nginx üzərindən) |
| Cortex | 9001 |
| Shuffle | 3001 |
| Backend API | 3000 (Nginx proxy) |

---

*Sual və ya problem üçün: backup qovluğundaki konfiqurasiya fayllarını Claude Code-a göstərin.*
