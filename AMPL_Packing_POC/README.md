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

## Layout

```
config/          Django project: settings (all from environment), urls, wsgi/asgi
apps/common/     Shared pieces: response envelope, error handler, pagination, health check
apps/accounts/   Custom user model with role (ADMIN / OPERATOR), create_ampl_user command
apps/catalog/    SKUs, UID batches, product UIDs
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
