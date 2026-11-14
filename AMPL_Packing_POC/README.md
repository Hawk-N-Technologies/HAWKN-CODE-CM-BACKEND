# AMPL Packing POC — Backend

QR-based stock movement, packing and box verification API for Hawk N Technologies.

- Python 3.12+, Django 5.2, Django REST Framework
- PostgreSQL database `ampl_packing_poc` (separate from the HawkN OS database)
- Runs on its own; shares no code, tables, cookies or ports with HawkN OS.

## First-time setup

Run these from inside `AMPL_Packing_POC/`.

```bash
# 1. Virtual environment
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 2. Packages
pip install -r requirements.txt

# 3. Settings
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(50))"   # paste into DJANGO_SECRET_KEY
# then fill DB_PASSWORD (and DB_HOST / DB_PORT if not localhost:5432)

# 4. Database tables
python manage.py migrate

# 5. Tests
python manage.py test

# 6. Run
python manage.py runserver 8010
```

Check: open <http://localhost:8010/api/v1/health>. It should show `"database": "ok"`.

## Users

No accounts are hard-coded. Create them with (password is asked for, hidden):

```bash
python manage.py create_ampl_user --username admin1 --role ADMIN
python manage.py create_ampl_user --username operator1 --role OPERATOR --section A   # section must exist
```

Admins can sign in at <http://localhost:8010/admin/> to manage SKUs, box configurations and sections
until the React admin screens arrive (M7).

## API (so far)

All under `/api/v1/`. Admin-only unless noted.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Public |
| GET | `/auth/csrf` | Public; sets the CSRF cookie |
| POST | `/auth/login` | Public; `{username, password}`; max 10 tries/min per IP |
| POST | `/auth/logout` | Logged in |
| GET | `/auth/me` | Logged in; user, role, sections |
| GET, POST | `/skus` | `?q=&is_active=` / `{code, name, description}` |
| GET, PATCH | `/skus/{id}` | Code cannot change |
| POST | `/skus/{id}/uid-batches` | `{quantity}` 1-10000 |
| GET | `/uid-batches?sku=` | |
| GET | `/uid-batches/{id}` | With all UIDs |
| GET | `/uid-batches/{id}/export.csv` | CSV download |
| GET | `/product-uids?sku=&status=&batch=&q=` | |
| GET | `/product-uids/{uid}` | With box and scan history |
| POST | `/product-uids/{uid}/void` | `{reason}`; only unused UIDs |
| GET | `/uid-capacity` | Used / remaining of 900,000 |
| GET, POST | `/box-configurations` | `{code, name, items:[{sku_id, quantity}], notes}` creates version 1 |
| GET, PATCH | `/box-configurations/{id}` | `{name, is_active}`; cannot deactivate while a section uses it |
| POST | `/box-configurations/{id}/versions` | `{items, notes, apply_to_sections}`; new version (old ones never change) |
| GET, POST | `/sections` | `{code, name, active_config_version_id}` |
| PATCH | `/sections/{id}` | `{name, is_active, active_config_version_id}`; open box keeps its version |
| POST | `/sections/{id}/operators` | `{user_id}` (operators only) |
| DELETE | `/sections/{id}/operators/{user_id}` | |
| GET, POST | `/users?role=` | `{username, password, role, first_name, last_name}` |
| PATCH | `/users/{id}` | `{first_name, last_name, role, is_active, password}`; cannot lock yourself out |
| GET | `/dashboard/summary` | Admin; UID and box counts, today's totals, UID capacity |
| GET | `/boxes?status=&section=&operator=&date_from=&date_to=&q=` | Admin; packing history (status also accepts MISMATCH) |
| GET | `/scan-logs?accepted=&action=&q=&date_from=&date_to=` | Admin; audit trail of every scan and action |
| GET | `/my/sections` | Operator/admin; sections + open box |
| POST | `/sections/{id}/boxes` | Operator/admin; 201 new box or 200 open box |
| GET | `/boxes/{public_id}` | Operator/admin; progress and items |
| POST | `/boxes/{public_id}/scans` | `{raw_value, client_scan_id}` |
| DELETE | `/boxes/{public_id}/items/{uid}` | `{reason}`; open box only |
| POST | `/boxes/{public_id}/complete` | Safe to repeat |
| POST | `/boxes/{public_id}/cancel` | `{reason}` |
| GET | `/boxes/lookup?code=BOX-000001` | Any AMPL user; full box record from its label (logged) |
| POST | `/boxes/{public_id}/verifications` | `{method: RECORD_CHECK or PHYSICAL_INSPECTION, result: MATCH or MISMATCH, notes}` |
| GET | `/product-uids/{uid}/qr.svg` | QR image (SVG) |
| GET | `/boxes/{box_uid}/qr.svg` | Box QR image; operator of that section or admin |
| GET | `/uid-batches/{id}/labels?page=` | Label data + QR SVGs, 1000 per page |
| GET | `/boxes/{public_id}/label` | 1 x 1 inch box label data; completed boxes only |

QR codes are generated on request from the identifier (error correction M, 29 x 29 modules) and never stored.

Not logged in → 401 `NOT_AUTHENTICATED`. Wrong role → 403 `PERMISSION_DENIED`.
With `DJANGO_DEBUG=true`, these URLs also open as clickable pages in the browser.

## Layout

```
config/          Django project: settings (all from environment), urls, wsgi/asgi
apps/common/     Shared pieces: response envelope, error handler, pagination, health check
apps/accounts/   Custom user model with role (ADMIN / OPERATOR), create_ampl_user command
apps/catalog/    SKUs, UID batches, product UIDs
apps/reports/    Dashboard counters, packing history, scan log
apps/packing/    Box configurations (versioned), sections, operators, boxes, box items,
                 verifications, scan log
tests/           Automated tests
```

## Conventions

- All endpoints live under `/api/v1/`.
- Success: `{"success": true, "data": ...}`. Error: `{"success": false, "code": "...", "message": "...", "errors": [...]}`.
- All database tables are prefixed `ampl_`.
- Cookies are `ampl_sessionid` and `ampl_csrftoken` so they never clash with HawkN OS.
- Secrets only in `.env` (git-ignored) or server environment variables.

## Database permissions

On the shared server, new databases get a `public` schema owned by `postgres`, so ownership must be fixed once per database.
Run as `postgres` in pgAdmin:

```sql
-- Query Tool opened on ampl_packing_poc
ALTER DATABASE ampl_packing_poc OWNER TO ampl_poc_user;
ALTER SCHEMA public OWNER TO ampl_poc_user;
ALTER ROLE ampl_poc_user CREATEDB;

-- Query Tool opened on test_ampl_packing_poc (create it first if missing,
-- owner ampl_poc_user)
ALTER SCHEMA public OWNER TO ampl_poc_user;
```

Tests reuse `test_ampl_packing_poc` instead of re-creating it (see `apps/common/test_runner.py`),
so this setup is needed only once.

## Docker

```bash
docker build -t ampl-packing-poc-backend .
docker run --env-file .env -p 8010:8010 ampl-packing-poc-backend
```

The container applies migrations on start. Production deployment is finalised in M9.
