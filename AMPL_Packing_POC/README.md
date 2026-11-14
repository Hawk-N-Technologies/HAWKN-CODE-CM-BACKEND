# AMPL Packing POC — Backend

QR-based stock movement, packing and box verification for Hawk N Technologies.

Every product gets a unique 6-digit QR code. Operators scan products into a box on their phone; the server checks every scan. A full box gets its own `BOX-000001` ID and a 1 × 1 inch label, which is later scanned to verify the box.

- Python 3.12+, Django 5.2, Django REST Framework, Python `qrcode`
- PostgreSQL database `ampl_packing_poc` (separate from the HawkN OS database)
- Fully independent of HawkN OS: own folder, database, process, port (8010) and cookie names
- Frontend: `AMPL_Packing_POC/` in the HAWKN-CODE-CM-FRONTEND repo

## Documents

| File | What it is |
| --- | --- |
| `docs/TEST_RECORD.md` | End-to-end test checklist with pass/fail columns |
| `docs/DEPLOYMENT.md` | How to run it on a server (nginx, gunicorn, HTTPS, backups) |
| `docs/production.env.example` | Production settings template |

## First-time setup (development)

Run from inside `AMPL_Packing_POC/`.

```bash
python3 -m venv .venv
source .venv/bin/activate                  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(50))"   # paste into DJANGO_SECRET_KEY
# fill DB_PASSWORD (and DB_HOST / DB_PORT if not localhost:5432)
python manage.py migrate
python manage.py create_ampl_user --username admin1 --role ADMIN
python manage.py create_ampl_user --username operator1 --role OPERATOR   # assign a section later in the app
```

The database must exist first (see "Database permissions" below).

## Daily use

```bash
source .venv/bin/activate
python manage.py runserver 8010
```

Check: <http://localhost:8010/api/v1/health> shows `"database": "ok"`. Then start the frontend.

## Tests

```bash
python manage.py test          # 142 tests, reuses the test database
```

The tests cover every packing rule, the database constraints, real simultaneous requests (double completion, the same product in two boxes) and every API endpoint.

## Production check (on the laptop)

This runs Django's deployment safety check with production-style values, without changing `.env`:

```bash
DJANGO_DEBUG=false DJANGO_ALLOWED_HOSTS=ampl-poc.example.com \
DJANGO_CSRF_TRUSTED_ORIGINS=https://ampl-poc.example.com DJANGO_BEHIND_HTTPS_PROXY=true \
DJANGO_COOKIE_SECURE=true DJANGO_SECURE_SSL_REDIRECT=true DJANGO_HSTS_SECONDS=3600 \
DJANGO_HSTS_INCLUDE_SUBDOMAINS=true python manage.py check --deploy
```

Expected: `System check identified no issues (1 silenced).` The silenced item is HSTS "preload", which is a decision for the whole hawkntechnologies.com domain.

## Settings (`.env`)

| Variable | Development | Production |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | random | different random value |
| `DJANGO_DEBUG` | `true` | `false` |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | your domain |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | every address you open the app from (e.g. `https://192.168.1.20:5180` for the phone) | `https://your-domain` |
| `DJANGO_COOKIE_SECURE` | `false` | `true` |
| `DJANGO_BEHIND_HTTPS_PROXY`, `DJANGO_SECURE_SSL_REDIRECT` | `false` | `true` |
| `DJANGO_HSTS_SECONDS` | `0` | `3600`, later `31536000` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | your database | server database |
| `DB_CONN_MAX_AGE` | `0` (required with `runserver`) | `60` |

If a setting appears twice in `.env`, the last line wins. Real environment variables beat the file.

## Database permissions

`ampl_poc_user` must own `ampl_packing_poc` **and** its `public` schema (PostgreSQL 15+ only lets the owner create tables). Run as `postgres`:

```sql
-- Query Tool opened on ampl_packing_poc
ALTER DATABASE ampl_packing_poc OWNER TO ampl_poc_user;
ALTER SCHEMA public OWNER TO ampl_poc_user;
ALTER ROLE ampl_poc_user CREATEDB;            -- development only, for tests

-- Query Tool opened on test_ampl_packing_poc (create it first, owner ampl_poc_user)
ALTER SCHEMA public OWNER TO ampl_poc_user;
```

Tests reuse `test_ampl_packing_poc` (see `apps/common/test_runner.py`), so this is needed once.

## Layout

```
config/          settings (all from environment), urls, wsgi/asgi, .env loader
apps/common/     response envelope, error handler, pagination, health check, IdCounter
apps/accounts/   user model (ADMIN / OPERATOR), login, users admin API, create_ampl_user command
apps/catalog/    SKUs, UID batches, product UIDs, UID generation, CSV export
apps/packing/    box configurations (versioned), sections, boxes, scanning rules, verification, scan log
apps/labels/     QR codes (SVG) and label data for printing
apps/reports/    dashboard counters, packing history, scan log API
tests/           automated tests, one file per milestone
docs/            test record, deployment guide, production settings template
```

## Business rules (enforced by the server and the database)

- Product UIDs: unique, 6 digits, first digit 1–9; generated as a permutation, so they never repeat. 900,000 in total.
- A product can be in only one box at a time; a section has only one open box.
- Each scan is checked: format, exists, not void, not already in a box, SKU in the configuration, SKU count not full.
- A box completes only when every SKU count matches exactly. Completion is atomic and safe to repeat; box IDs are gapless.
- Configurations are versioned: a version used by a box never changes.
- Every scan, rejection, completion, cancellation, lookup and verification is logged.

## API

All under `/api/v1/`. JSON envelope: `{"success": true, "data": …}` or `{"success": false, "code": "…", "message": "…", "errors": […]}`.
Not logged in → 401 `NOT_AUTHENTICATED`. Wrong role → 403 `PERMISSION_DENIED`.

| Area | Method and path | Who |
| --- | --- | --- |
| Health | `GET /health` | Public |
| Login | `GET /auth/csrf`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Public / logged in |
| Users | `GET, POST /users`, `PATCH /users/{id}` | Admin |
| SKUs | `GET, POST /skus`, `GET, PATCH /skus/{id}` | Admin |
| UIDs | `POST /skus/{id}/uid-batches`, `GET /uid-batches`, `GET /uid-batches/{id}`, `GET /uid-batches/{id}/export.csv`, `GET /product-uids`, `GET /product-uids/{uid}`, `POST /product-uids/{uid}/void`, `GET /uid-capacity` | Admin |
| Configurations | `GET, POST /box-configurations`, `GET, PATCH /box-configurations/{id}`, `POST /box-configurations/{id}/versions` | Admin |
| Sections | `GET, POST /sections`, `PATCH /sections/{id}`, `POST /sections/{id}/operators`, `DELETE /sections/{id}/operators/{user_id}` | Admin |
| Packing | `GET /my/sections`, `POST /sections/{id}/boxes`, `GET /boxes/{public_id}`, `POST /boxes/{public_id}/scans`, `DELETE /boxes/{public_id}/items/{uid}`, `POST /boxes/{public_id}/complete`, `POST /boxes/{public_id}/cancel` | Operator of the section, or admin |
| Verification | `GET /boxes/lookup?code=`, `POST /boxes/{public_id}/verifications` | Any operator or admin |
| Labels | `GET /product-uids/{uid}/qr.svg`, `GET /uid-batches/{id}/labels`, `GET /boxes/{box_uid}/qr.svg`, `GET /boxes/{public_id}/label` | Admin / operator of the section |
| Reports | `GET /dashboard/summary`, `GET /boxes` (history), `GET /scan-logs` | Admin |

With `DJANGO_DEBUG=true`, the API URLs also open as clickable pages in the browser.

## Known limitations

- **6-digit UIDs are not anti-counterfeit.** Anyone can print a QR with a valid-looking number. They are for tracking, not security.
- **Capacity is 900,000 product UIDs** for the life of the system. The dashboard shows what is left.
- **Verification checks the record, not the box.** Scanning a box label shows what the system recorded at packing. Only "Physical inspection" means someone opened and counted the box.
- **Sticker sheet presets are starting values.** Print one test page and adjust the layout for your exact sheet.
- **Printing uses the browser's print dialog.** There is no silent or automatic printing.
- **One open box per section.** Several operators cannot pack separate boxes in the same section at the same time.
- **The phone camera needs HTTPS.** Locally this uses a self-signed certificate (one-time warning on the phone); on a server, a real certificate.
- **Vibration does not work on iPhone** (browser limitation). The sound and screen colours still work.
- **There is no screen to void a UID.** The API exists (`POST /product-uids/{uid}/void`).
