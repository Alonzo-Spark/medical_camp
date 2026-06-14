# Deploying SWASTH to Vercel

This app deploys as **two Vercel projects from one repo**:

| Project | Root directory | What it serves |
|---------|---------------|----------------|
| Frontend | `frontend/` | React + Vite static site |
| Backend  | repo root     | Django REST API as Python serverless functions |

Database = Supabase Postgres (pooler). Scan images = Supabase Storage.
**The voicebot is disabled** (telephony + background threads are incompatible
with serverless); re-enable it later on a persistent host if needed.

---

## 1. Supabase setup

1. **Storage bucket** — Supabase dashboard → Storage → New bucket:
   - Name: `scans`
   - **Public** bucket: ON (so image URLs render in the browser)
2. **Service-role key** — Settings → API → copy the `service_role` key
   (secret). This is used server-side to upload images. Never expose it to the
   frontend.
3. **DB connection (pooler)** — Settings → Database → Connection pooling
   (Transaction mode, port **6543**). Note host / user / password.

## 2. Deploy the backend (Django)

1. New Vercel project → import this repo → **Root Directory = repo root**.
2. Framework preset: **Other** (the included `vercel.json` handles the build).
3. Environment variables — set everything from [`.env.example`](.env.example):
   `DJANGO_SECRET_KEY`, `DEBUG=False`, `GEMINI_API_KEY`, the `SUPABASE_DB_*`
   pooler values, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
   `SUPABASE_STORAGE_BUCKET=scans`. (Set `CORS_ALLOWED_ORIGINS` after step 3.)
4. Deploy. Note the backend URL, e.g. `https://swasth-api.vercel.app`.
5. **Run migrations once** (Supabase is shared, so do it from your machine):
   ```bash
   # with the same SUPABASE_DB_* env vars in your local .env
   python manage.py migrate
   ```
   This adds the new `ScanSession.image_url` column (migration 0056).

## 3. Deploy the frontend (React)

1. New Vercel project → same repo → **Root Directory = `frontend`**.
2. Framework preset: **Vite** (auto-detected).
3. Environment variable: `VITE_API_BASE = https://<backend-url>/api`.
4. Deploy. Note the frontend URL, e.g. `https://swasth.vercel.app`.

## 4. Wire CORS

Back in the **backend** project, set:
```
CORS_ALLOWED_ORIGINS = https://<frontend-url>
```
and redeploy. (Any `*.vercel.app` origin is already allowed by regex, so this
mainly matters for a custom domain.)

---

## Notes & limits

- **Image uploads** are compressed client-side to stay under Vercel's hard
  **4.5 MB** request-body limit (see `frontend/src/utils/image.js`).
- **OCR runs synchronously** during upload (no background threads) — well within
  the 300s function limit.
- **Static files** for the Django admin are served at runtime by WhiteNoise via
  Django's staticfiles finders (no `collectstatic` build step needed).
- **Migrations** are not run automatically on Vercel — run `manage.py migrate`
  manually whenever models change.
