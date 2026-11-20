# HawkN CM — Go-Live Checklist

Work through this top to bottom. Tick each box before moving on.
Commands run in the **backend** folder unless it says otherwise.

---

## 1. Final walk-through (local or staging — never the live database)

Log in as each role with the demo accounts and do one real task end to end.

- [ ] **Admin** — Company Profile, Policies, SOPs, People Management, Project Management, BRD Approval, Deployment Planning, Development Monitoring, Delivery & Handover
- [ ] **HR** — onboard an employee (with password), Leave & LOP, Payroll, Holidays, Bonuses & Increments, Internship / Probation, SOPs
- [ ] **BD** — add a lead and a client, create a project, upload a BRD, dashboard numbers
- [ ] **Project Lead** — team, modules, phases (tick "Needs client approval" on the UI phase), tasks, bugs, dashboard numbers
- [ ] **Developer** — tasks, Kanban, bug fixing, SOPs
- [ ] **Tester** — build testing, phase sign-off, retesting, field training, submit a delivery
- [ ] **Client** — phase approval, bugs/tickets, delivery (accept / follow-up), training, BRD approval
- [ ] Phone check: open 3–4 pages on a phone — the ☰ menu opens and every page fits the screen
- [ ] `npm test` → all tests pass (uses the separate `hawkn_test` database)

## 2. Live server settings (`.env` on the server — never commit it)

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` → the **new, empty** live database
- [ ] `JWT_SECRET` → a **new** random value (the server refuses to start with a short or example secret):
      `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- [ ] `JWT_EXPIRES_IN=30d`
- [ ] `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` → a **new** pair from `npx web-push generate-vapid-keys` (don't reuse the laptop keys)
- [ ] `VAPID_SUBJECT=mailto:hr@hawkntechnologies.com`
- [ ] `FRONTEND_URL` → only if the portal runs on an address other than `https://clientportal.hawkntechnologies.com`
- [ ] `PORT` → whatever the host expects

## 3. Live database (once)

```bash
npm ci                       # exact packages from package-lock.json
npm run migrate              # creates every table
npm run migrate:status       # must end with "0 pending"
```

Create the roles, the company and the **real** first admin
(set these only for this one command — don't leave the password in `.env`):

```bash
COMPANY_NAME="Hawk'N Technologies" \
FIRST_ADMIN_EMAIL="<real admin email>" \
FIRST_ADMIN_PASSWORD="<12+ chars, upper, lower, number, symbol>" \
FIRST_ADMIN_FIRST_NAME="<first name>" \
FIRST_ADMIN_LAST_NAME="<last name>" \
npm run setup:production
```

- [ ] Output says `✅ First admin created: …`
- [ ] **Do not** run `npm run seed` — it creates the demo accounts and is blocked when `NODE_ENV=production`

## 4. Start the backend

```bash
npm start
```

- [ ] No `❌` lines (if there are, the server stops and says what to fix)
- [ ] No "Demo accounts are still active" warning
- [ ] `https://clientportalapi.hawkntechnologies.com/` answers

## 5. Frontend (frontend repo)

The live portal is the Docker + nginx build (`Dockerfile`, `nginx.conf`):

- [ ] `nginx.conf` forwards `/api/` **and** `/socket.io/` to the live API (both are in the file — live notifications need `/socket.io/`)
- [ ] Build and deploy the container; open `https://clientportal.hawkntechnologies.com`
- [ ] ⚠️ `vercel.json` sends `/api` to `https://bhsquarebackend.onrender.com`. If Vercel is used for anything, point it at the HawkN API first — otherwise ignore it
- [ ] Debug `console.log` output is removed from the production build automatically (errors still show)

## 6. Real data (after the walk-through, on the live portal)

- [ ] First admin logs in → Company Profile, Company Policies, Roles & Responsibilities, Employee Hierarchy
- [ ] Admin adds HR in **People Management**
- [ ] HR onboards every employee (**Employee Onboarding** — HR sets each password and shares it privately)
- [ ] HR / Admin write the SOPs
- [ ] BD adds clients (each client gets a login) and projects; Admin assigns project leads, testers and operations
- [ ] Holidays and salary structures entered before the first payroll

## 7. Demo accounts

- [ ] Live database: never created (seed is blocked) — confirm with the startup log in step 4
- [ ] Staging / any shared database used for the walk-through: Admin → **People Management** → Edit → Status **Inactive** for `admin@gmail.com` and `hr@gmail.com` (log in as the real admin first)

## 8. Smoke test on live (10 minutes)

- [ ] Each role logs in and lands on its dashboard
- [ ] One notification arrives live (e.g. Admin assigns a project lead → the lead's bell updates without refreshing)
- [ ] Phone / laptop alerts: Notifications → **Turn on alerts** works (needs HTTPS; on iPhone add the site to the Home Screen first)
- [ ] Log out and back in works

## 9. After launch

- [ ] Daily database backup (e.g. `pg_dump` on a schedule) and one test restore
- [ ] Password resets: only HR / Admin reset passwords — a reset logs the user out of every device
- [ ] Someone named owns the server logs for the first week
- [ ] New code always goes `feature branch → dev → staging → main`; run `npm run migrate` on the server after each release (migrations only add, they never drop data)
