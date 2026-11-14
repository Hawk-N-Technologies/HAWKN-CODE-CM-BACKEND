# AMPL Packing POC — Deployment guide

Where to host is the HawkN team's decision. This guide describes what the app needs on any Linux server.

## 1. What runs where

```
Frontend: https://ampl-poc.hawkntechnologies.com (React app)
Backend:  https://ampl-pocapi.hawkntechnologies.com (Django + gunicorn on port 18000)
Database: PostgreSQL ampl-poc on 194.164.148.10:17999 (user: pocampl)
```

- **HTTPS is required.** Phone cameras only work on `https://` pages.
- **Backend API:** Bound to port 18000, exposed under `ampl-pocapi.hawkntechnologies.com`.
- **CORS & Cookies:** CORS is enabled for `https://ampl-poc.hawkntechnologies.com`. Cookies are shared across `*.hawkntechnologies.com` domain.
- HawkN OS is not touched: separate database, separate process, separate port, different cookie names.

## 2. Server requirements

| Item | Version / note |
| --- | --- |
| Python | 3.12 or 3.13 recommended (3.14 also worked in development) |
| Node.js | 20+ (only to build the frontend) |
| nginx | Any recent version, with a TLS certificate (e.g. Let's Encrypt) |
| PostgreSQL | Existing HawkN server; database `ampl_packing_poc` owned by `ampl_poc_user` |
| Docker | Optional; the backend has a `Dockerfile` |

## 3. Database (once)

On the PostgreSQL server, as an admin (the same as on the development machine):

```sql
CREATE ROLE ampl_poc_user WITH LOGIN PASSWORD 'strong-unique-password';
CREATE DATABASE ampl_packing_poc OWNER ampl_poc_user ENCODING 'UTF8';
\c ampl_packing_poc
ALTER SCHEMA public OWNER TO ampl_poc_user;
```

`CREATEDB` is only needed where automated tests run, not on the production server.

## 4. Backend

```bash
cd AMPL_Packing_POC                         # inside HAWKN-CODE-CM-BACKEND
cp docs/production.env.example .env        # then fill in every empty value
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py check --deploy            # must say: no issues (1 silenced)
python manage.py migrate
python manage.py collectstatic --noinput   # copies admin CSS/JS into staticfiles/
python manage.py create_ampl_user --username admin1 --role ADMIN
gunicorn config.wsgi:application --bind 127.0.0.1:18000 --workers 3 --timeout 30
```

Run gunicorn under a process manager (systemd, supervisor or Docker) so it restarts on reboot.

**With Docker instead:**

```bash
# Build either from root directory or from inside AMPL_Packing_POC:
# From root directory:
docker build -f AMPL_Packing_POC/Dockerfile -t ampl-packing-poc-backend .
# Or from inside AMPL_Packing_POC:
# cd AMPL_Packing_POC && docker build -t ampl-packing-poc-backend .

docker run -d --name ampl-backend --restart unless-stopped --env-file .env \
  -p 127.0.0.1:18000:18000 -v /srv/ampl-packing/staticfiles:/AMPL_Packing_POC/staticfiles ampl-packing-poc-backend
```

The container applies migrations and collects static files every time it starts. It runs as user id 10001, so allow it to write the static folder once: `sudo mkdir -p /srv/ampl-packing/staticfiles && sudo chown 10001 /srv/ampl-packing/staticfiles`.

**Check:** `curl https://<your-domain>/api/v1/health` should return `"database": "ok"`.

## 5. Frontend

```bash
cd AMPL_Packing_POC                         # inside HAWKN-CODE-CM-FRONTEND
npm ci
npm run build                               # creates dist/
sudo mkdir -p /var/www/ampl-packing && sudo cp -r dist/* /var/www/ampl-packing/
```

No environment file is needed for the build: the app always calls `/api/v1` on its own address.
Use `deploy/nginx.conf.example` (frontend repo) as the nginx site and reload nginx.

## 6. Production settings explained

| Setting | Production value | Why |
| --- | --- | --- |
| `DJANGO_DEBUG` | `false` | No error pages with code details |
| `DJANGO_ALLOWED_HOSTS` | your domain | Rejects requests for other host names |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://your-domain` | Login and forms only from your site |
| `DJANGO_BEHIND_HTTPS_PROXY` | `true` | Trust nginx's "this was HTTPS" header |
| `DJANGO_COOKIE_SECURE` | `true` | Cookies only sent over HTTPS |
| `DJANGO_SECURE_SSL_REDIRECT` | `true` | Any `http://` request is sent to `https://` |
| `DJANGO_HSTS_SECONDS` | `3600`, later `31536000` | Browsers remember to use HTTPS only |
| `DB_CONN_MAX_AGE` | `60` | Reuse database connections under gunicorn (keep `0` with `runserver`) |

## 7. Backups and updates

- **Backup** (daily, keep at least 7): `pg_dump -Fc -U ampl_poc_user -h <db-host> ampl_packing_poc > ampl_$(date +%F).dump`
- **Restore test** (on a spare database): `pg_restore -d <spare-db> ampl_YYYY-MM-DD.dump`
- **Update the app:** pull the new code, then repeat `pip install -r requirements.txt`, `migrate`, `collectstatic`, restart gunicorn; and `npm ci && npm run build`, then copy `dist/` again.

## 8. After deployment, check

1. `https://<domain>/status` shows Frontend, Backend API, Database all **OK**.
2. Admin signs in, opens the dashboard.
3. A phone signs in as an operator, opens a section, **Start camera** works (no certificate warning).
4. Print one box label and one product sheet from a desktop.
