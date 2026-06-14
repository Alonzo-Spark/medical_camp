# Docker deployment on a Hetzner VM (IP access, no domain)

Brings up the whole app with `docker compose up`:
- **nginx** container (port 80) — serves the React build, proxies the API, serves `/media`
- **backend** container — gunicorn + Django
- **DB** — Supabase (external, via `.env`)
- **media** — stored on the host at `./data/media` (local disk), cleaned by a cron

> ⚠️ **Voicebot caveat:** Exotel telephony webhooks require a **public HTTPS URL**.
> Over plain `http://<IP>` the voicebot calls won't work end-to-end (the rest of
> the app — patients, vitals, OCR, reports — works fine). Add a domain + TLS later
> to enable voicebot calling.

---

## 1. Install Docker on the VM

```bash
curl -fsSL https://get.docker.com | sh
# (compose plugin is included with modern Docker)
docker compose version
```

## 2. Get the code

First **commit & push** your local changes, then on the VM:
```bash
cd /opt
git clone <YOUR_REPO_URL> medical_camp
cd medical_camp
git checkout boilerplate-lite
```

## 3. Create `.env`

Create `/opt/medical_camp/.env` (replace `<VM_IP>` with your server's IP):

```
DJANGO_SECRET_KEY=<long random string>
DEBUG=False
ALLOWED_HOSTS=<VM_IP>,localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=http://<VM_IP>

GEMINI_API_KEY=<...>

# Database (Supabase pooler)
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.xxxx
SUPABASE_DB_PASSWORD=<...>
SUPABASE_DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
SUPABASE_DB_PORT=6543

# Voicebot (optional until you have HTTPS)
SARVAM_API_KEY=<...>
EXOTEL_ACCOUNT_SID=<...>
EXOTEL_API_KEY=<...>
EXOTEL_API_TOKEN=<...>
EXOTEL_CALLER_ID=<...>
PUBLIC_URL=http://<VM_IP>
```

## 4. Create media folders (local storage)

```bash
mkdir -p data/media/scanned_reports data/media/voicebot_prompts/dynamic
```
Upload your Telugu/Hindi prompt `.wav` files into
`data/media/voicebot_prompts/` (when you wire up the voicebot).

## 5. One-time database migration

Your Supabase schema is already current from earlier, but to be safe run:
```bash
# Temporarily set SUPABASE_DB_PORT=5432 in .env for migrations, then back to 6543
docker compose run --rm backend python manage.py migrate
docker compose run --rm backend python manage.py createsuperuser   # optional
```

## 6. Build & start

```bash
docker compose up -d --build
docker compose ps          # both services "running"
docker compose logs -f     # watch for errors
```

Open **`http://<VM_IP>`** — the app should load.

## 7. Open the firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw --force enable
```

## 8. Media cleanup cron (host)

`./data/media` is on the host, so a plain cron cleans it. Keep 7 days:
```bash
chmod +x /opt/medical_camp/deploy/cleanup_media.sh
( sudo crontab -l 2>/dev/null; \
  echo "30 3 * * * RETENTION_DAYS=7 MEDIA_ROOT=/opt/medical_camp/data/media /opt/medical_camp/deploy/cleanup_media.sh >> /var/log/medicalcamp_cleanup.log 2>&1" ) | sudo crontab -
```
(Run as root via `sudo crontab` since container-written files are root-owned.)

---

## Redeploying after code changes

```bash
cd /opt/medical_camp
git pull
docker compose up -d --build
```

## Useful commands

```bash
docker compose logs -f backend        # backend logs
docker compose restart backend        # restart after .env change
docker compose down                   # stop everything
docker compose exec backend python manage.py migrate   # run a migration
```

## Later: add a domain + HTTPS (enables voicebot)

When you get a domain, the cleanest path is to put **Caddy** or **nginx +
certbot** in front (or add a TLS-terminating reverse proxy), point the domain's
`A` record at the VM, set `PUBLIC_URL`/`ALLOWED_HOSTS`/`CSRF_TRUSTED_ORIGINS` to
the domain, and point Exotel webhooks at `https://<domain>/api/voicebot/...`.
Ask me and I'll add a Caddy service to the compose file — it auto-provisions TLS.
