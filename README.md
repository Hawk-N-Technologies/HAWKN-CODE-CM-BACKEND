# HawkN Backend

Node.js + Express 5 API for the HawkN platform. PostgreSQL (managed via pgAdmin).

## Run locally
```bash
npm install
cp .env.example .env   # then fill in values
npm run dev            # auto-restarts on file save
```
Check: http://localhost:4000/api/v1/health

## Structure
```
src/
  server.js          # entry point — starts the server
  app.js             # express setup: middleware + routes
  config/env.js      # all env vars read here, nowhere else
  constants/roles.js # MUST match frontend roles.js
  db/                # Postgres connection + SQL (feature/db)
  middlewares/       # errorHandler, notFound, (auth later)
  modules/<feature>/ # one folder per feature: routes, controller, service
  routes/index.js    # mounts every module under /api/v1
  utils/             # ApiError, response helpers
```

## Branch rules
- Never push to `main` or `staging`.
- Branch every feature off latest `dev` as `feature/<name>`, PR back into `dev`.
