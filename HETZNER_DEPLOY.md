# Deploying the Medical Camp app on a Hetzner VM

One server runs everything: **Nginx** (serves the React build + reverse-proxies),
**Gunicorn** (Django API + voicebot), and your database. A persistent VM means
the **voicebot works**, uploads aren't size-capped, and there are no cold starts.

Assumptions (tell me if different):
- Ubuntu 22.04/24.04
- App lives at `/opt/medical_camp`
- A domain (e.g. `camp.example.com`) pointed at the VM's IP via an `A` record
  (needed for HTTPS, which Exotel webhooks require). IP-only works but no easy TLS.

**Storage model:** everything is on the VM's local disk under `media/` — scan
images (`media/scanned_reports/`) and voicebot audio (`media/voicebot_prompts/`).
Nginx serves them at `/media/`. A daily cron purges old disposable files
(step 10). No Supabase Storage needed.

> ⚠️ **Use Python 3.12, not 3.13.** The voicebot imports the `audioop` module,
> which was removed from the stdlib in Python 3.13. Ubuntu 24.04 ships 3.12 — good.

---

## 1. First-time server setup

SSH in as root (or a sudo user), then:

```bash
apt update && apt upgrade -y
apt install -y python3 python3-venv python3-pip git nginx curl ufw

# Node 20 (to build the React frontend on the server)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

## 2. Get the code

```bash
mkdir -p /opt && cd /opt
git clone <YOUR_REPO_URL> medical_camp
cd medical_camp
git checkout boilerplate-lite      # or your deploy branch
```

## 3. Python environment

```bash
cd /opt/medical_camp
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 4. Backend `.env`

Create `/opt/medical_camp/.env` (Django loads it automatically):

```
DJANGO_SECRET_KEY=<long random string>
DEBUG=False
ALLOWED_HOSTS=camp.example.com
CSRF_TRUSTED_ORIGINS=https://camp.example.com

GEMINI_API_KEY=<...>

# Database — see step 8 for the local-Postgres option
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.xxxx
SUPABASE_DB_PASSWORD=<...>
SUPABASE_DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
SUPABASE_DB_PORT=6543

# Voicebot (TTS via Sarvam + Exotel telephony)
SARVAM_API_KEY=<...>
EXOTEL_ACCOUNT_SID=<...>
EXOTEL_API_KEY=<...>
EXOTEL_API_TOKEN=<...>
EXOTEL_CALLER_ID=<...>
EXOTEL_FLOW_URL=<...>
EXOTEL_REMINDER_FLOW_URL=<...>
PUBLIC_URL=https://camp.example.com
```

Scan images and voicebot audio are stored on local disk, so **no Supabase
Storage keys are needed**. Since the frontend and API are the **same origin**,
CORS isn't needed either.

## 5. Django: migrate + collect static

```bash
source venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser   # optional, for /admin

# Create the media directories (local storage for scans + voicebot audio)
mkdir -p media/scanned_reports media/voicebot_prompts/dynamic
```

## 6. Build the frontend

The frontend calls the API at a relative `/api` (same origin), so build with:

```bash
cd /opt/medical_camp/frontend
echo "VITE_API_BASE=/api" > .env.production
npm install
npm run build      # outputs to frontend/dist
```

## 7. Gunicorn service + Nginx

```bash
# Gunicorn systemd service
cp /opt/medical_camp/deploy/gunicorn.service /etc/systemd/system/medicalcamp.service
# Make sure the app dir is owned so www-data can read it and write media/
chown -R www-data:www-data /opt/medical_camp
systemctl daemon-reload
systemctl enable --now medicalcamp
systemctl status medicalcamp        # should be "active (running)"

# Nginx
cp /opt/medical_camp/deploy/nginx.conf /etc/nginx/sites-available/medicalcamp
# edit it: set server_name to your domain/IP
sed -i 's/YOUR_DOMAIN_OR_IP/camp.example.com/' /etc/nginx/sites-available/medicalcamp
ln -sf /etc/nginx/sites-available/medicalcamp /etc/nginx/sites-enabled/medicalcamp
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Visit `http://camp.example.com` — the app should load.

## 8. HTTPS (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d camp.example.com
```
Auto-renews via a systemd timer. Your site is now `https://`.

---

## (Optional) Local Postgres — kills DB latency

If your Hetzner VM is in the EU and Supabase is in Singapore, every query is a
long round trip. Running Postgres on the same VM removes that entirely:

```bash
apt install -y postgresql
sudo -u postgres psql -c "CREATE DATABASE medicalcamp;"
sudo -u postgres psql -c "CREATE USER campuser WITH PASSWORD 'strongpw';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE medicalcamp TO campuser;"
```
Then point `.env` at it (`SUPABASE_DB_HOST=localhost`, `PORT=5432`, the new
name/user/password), migrate, and import your Supabase data with
`pg_dump` → `psql`. (Scan-image Storage can stay on Supabase, or switch to local
`media/` — both work on a VM.) Ask me and I'll give exact dump/restore commands.

---

## 9. Voicebot (already enabled in code)

The voicebot is now active in `INSTALLED_APPS` and URLs — the persistent server
runs its thread/disk code as-is. To make it functional:

1. Upload your prompt recordings (the Telugu/Hindi `.wav` files from
   `Downloads/audios`) to `/opt/medical_camp/media/voicebot_prompts/` with the
   filenames the code expects (`followup_q1.wav`, `followup_q1_hindi.wav`,
   `scenario1.wav`, `scenario1_hindi.wav`, …). Dynamic per-call audio is created
   automatically under `voicebot_prompts/dynamic/`.
2. Make sure the voicebot `.env` vars (step 4) are set.
3. `chown -R www-data:www-data /opt/medical_camp/media` and
   `systemctl restart medicalcamp`.
4. Point your Exotel flow's webhook URLs at
   `https://camp.example.com/api/voicebot/...`.

> If TTS keys are missing, camp creation still works — the auto-reminder signal
> just logs an error instead of blocking. So you can defer voicebot config.

I can help map your exact recording filenames to what the code expects.

## 10. Periodic media cleanup (cron)

A daily cron purges old scan images + per-call voicebot audio (keeps the
permanent prompts):

```bash
chmod +x /opt/medical_camp/deploy/cleanup_media.sh
# Run daily at 03:30, keep 7 days (edit RETENTION_DAYS to taste, e.g. 3)
( crontab -l 2>/dev/null; \
  echo "30 3 * * * RETENTION_DAYS=7 MEDIA_ROOT=/opt/medical_camp/media /opt/medical_camp/deploy/cleanup_media.sh >> /var/log/medicalcamp_cleanup.log 2>&1" ) | crontab -
```

---

## Redeploying after code changes

```bash
cd /opt/medical_camp
git pull
source venv/bin/activate
pip install -r requirements.txt          # if deps changed
python manage.py migrate                  # if models changed
python manage.py collectstatic --noinput
( cd frontend && npm install && npm run build )   # if frontend changed
systemctl restart medicalcamp
```
