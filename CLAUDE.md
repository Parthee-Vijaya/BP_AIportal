# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Barnepige Timeregistrering — a web app for registering and approving childcare worker hours for Kalundborg Municipality. Danish-language UI with three roles: Admin, Godkender (Approver), Barnepige (Caregiver).

## Commands

```bash
# Development (from repo root)
npm run dev              # Start backend + frontend concurrently
npm run dev:backend      # Backend only → http://localhost:3001
npm run dev:frontend     # Frontend only → http://localhost:5173
npm run build            # Production build (frontend)

# Database seeding
node backend/seed-demo.js       # 3 caregivers, 4 children, sample entries
node backend/seed-extended.js   # Extended test data
node backend/seed-large.js      # Large dataset

# Workspace management
npm run clean            # Remove all node_modules + lockfiles
npm install              # Reinstall from root (workspace-aware)
```

No test runner is currently configured. Playwright is listed as a devDependency but no test scripts or test files exist yet.

## Architecture

NPM workspaces monorepo: `frontend/` and `backend/` as workspaces.

### Backend (Express + SQLite)

- **Entry:** `backend/src/index.js` — Express server on port 3001
- **Database:** `better-sqlite3` (synchronous). Schema in `backend/src/db/schema.sql`, DB file at `backend/src/db/database.sqlite`
- **Routes:** `backend/src/routes/` — CRUD for children, caregivers, time-entries, export (CSV), settings
- **Services:**
  - `allowanceCalculator.js` — Core business logic: splits hours into normal/evening/night/saturday/sunday categories based on time-of-day and day-of-week rules. Rounds times up to nearest quarter hour. Handles Danish holidays (Easter via Computus algorithm).
  - `grantCalculator.js` — Calculates grant period boundaries and usage. Grant types: week, month, quarter, half_year, year, specific_weekdays, frame (annual override).
- **API proxy:** Vite dev server proxies `/api/*` → `http://localhost:3001`

### Frontend (React 19 + Vite + Tailwind CSS)

- **Entry:** `frontend/src/main.jsx` → `App.jsx` (React Router v7)
- **Role-based routing** in `App.jsx`: Admin (`/admin/*`), Godkender (`/godkender/*`), Barnepige (`/barnepige/*`)
- **Pages:**
  - `pages/admin/` — AdminDashboard, ApprovalPage (largest file ~1273 lines, handles filtering/batch approval/inline editing), ChildrenPage, CaregiversPage
  - `pages/caregiver/` — CaregiverDashboard, RegisterTime (live preview of allowance calculation), MyTimeEntries
- **Components:** Layout (sidebar nav + Kalundborg branding), GrantStatusBadge, StatusBadge
- **Utils:** `api.js` (centralized fetch wrapper for all endpoints), `helpers.js` (formatting utilities)
- **Styling:** Tailwind with custom Kalundborg brand colors (primary: `#B54A32`), configured in `tailwind.config.js`

### Key Business Rules

- **Allowance time bands** — weekday normal 06-17, evening 17-23, night 23-06; Saturday normal 06-08, Saturday-tillæg 08-24; Sunday/holidays all day
- **Holidays override** day-of-week classification
- **Times round up** to nearest 15 minutes
- **Grants are per child**, not per caregiver; both pending and approved entries count toward usage
- **Month intervals** are configurable (e.g. 16th-15th) with history tracking and no retroactive changes
- **MA-numbers** are unique identifiers for caregivers, zero-padded to 8 digits

### Database Tables

Core: `caregivers`, `children`, `child_caregiver` (M2M), `time_entries` (with hour category columns and approval workflow fields), `settings`, `month_interval_history`.

## Conventions

- All UI text is in Danish
- ESM modules throughout (`"type": "module"` in both package.json files)
- No authentication system of its own — role selection is client-side only (but see AI-portal SSO below)
- Backend uses `node --watch` for dev hot reload (no nodemon)

## Deployment in Kalundborg's AI-portal (KK-AI-JARVIS01-MONO)

The app runs as the `barnepige` service behind Traefik at `/barnepige-app`
(standalone) and inside the portal as an iframe at `/barnepige`. The compose
files in the monorepo root build `Dockerfile` with `VITE_BASE_PATH=/barnepige-app/`;
Traefik strips the prefix, so the container always sees clean `/` + `/api` paths.

- **Base path**: `vite.config.js` reads `VITE_BASE_PATH`; the router basename and
  `API_BASE` derive from `import.meta.env.BASE_URL`. Locally everything stays at `/`.
- **SSO** (`backend/src/services/portalAuth.js`): every `/api` route except
  `/api/health` requires the portal's `shield-session` cookie (an Entra ID
  id_token), verified against tenant JWKS. Config via `ENTRA_TENANT_ID`,
  `ENTRA_CLIENT_ID` (audience; the portal's app registration),
  `SHIELD_SESSION_COOKIE`, optional `BARNEPIGE_ENTRA_GROUP` (403 unless member).
  Both unset ⇒ auth disabled (local dev). The verified identity is available to
  routes as `req.portalUser` (`upn`, `name`, `oid`, `groups`).
- **Frontend 401 handling**: `utils/api.js` redirects to the portal's silent
  Entra login (`/api/auth/entra/start?returnTo=…`) and returns to the same page.
- **Iframe**: `X-Frame-Options` is `SAMEORIGIN` (the portal embeds the app from
  the same origin) — don't change it back to `DENY`.
