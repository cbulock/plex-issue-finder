# Agents Guide — Plex Issue Finder

## Project Overview

A self-hosted web app for diagnosing Plex library issues. It compares Plex movie durations against Radarr's expected runtimes and flags movies that appear to be incomplete downloads. Users can trigger redownloads through Radarr directly from the UI.

**Stack:**
- **Backend:** Node.js + Express, SQLite via `better-sqlite3`, Axios for Plex/Radarr API calls
- **Frontend:** Vue 3 (Composition API + `<script setup>`), Pinia stores, PrimeVue component library, Vite
- **Deployment:** Single Docker container — Express serves the Vite production build as static files

---

## Repository Layout

```
backend/
  src/
    index.js          # Express app entry point, route mounting, static file serving
    routes/
      settings.js     # GET/POST /api/settings
      movies.js       # GET /api/movies/check, POST /api/movies/redownload, cache routes
    api/
      plex.js         # Plex HTTP API client
      radarr.js       # Radarr HTTP API client
    db/
      index.js        # SQLite schema, migrations, settings CRUD, Radarr runtime cache
  data/               # SQLite DB lives here in dev (gitignored)

frontend/
  src/
    main.js           # App bootstrap — PrimeVue, Pinia, ToastService, router
    App.vue           # Root layout — NavBar + <Toast position="top-right"> + <router-view>
    router/index.js   # Vue Router routes
    views/
      DashboardView.vue
      SettingsView.vue
      MovieDurationView.vue
    stores/
      settings.js     # Pinia store — fetchSettings (silent failure), saveSettings (throws on error)
      movieDuration.js
    api/
      client.js       # fetch wrapper — checks Content-Type before .json(), throws on !res.ok
  vite.config.js      # Dev proxy: /api → http://127.0.0.1:3000 (must use 127.0.0.1, not localhost)
```

---

## Dev Setup

Run backend and frontend simultaneously in separate terminals:

```bash
# Terminal 1 — backend (port 3000)
cd backend
npm install
npm run dev        # node --watch src/index.js

# Terminal 2 — frontend (Vite, port 5173)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api/*` to `http://127.0.0.1:3000`.

> **Important:** The proxy target must be `127.0.0.1`, not `localhost`. Modern Node.js resolves `localhost` to `::1` (IPv6), but the backend binds to `0.0.0.0` (IPv4), causing 502 errors through the proxy.

---

## Build & Production

```bash
docker compose up -d        # builds image and starts container on port 3000
docker compose build        # rebuild image only
```

The Dockerfile is a multi-stage build: Vite builds the frontend, then the output is copied into the backend image. Express serves `frontend/dist` as static files in production.

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Returns all settings (sensitive values masked as `***`) |
| POST | `/api/settings` | Saves one or more settings; ignores `***` placeholder values |
| GET | `/api/movies/check?force=true` | Runs the duration check; `force=true` clears Radarr cache first |
| POST | `/api/movies/redownload` | Deletes Radarr movie files and triggers a new search `{ movieIds: number[] }` |
| POST | `/api/movies/refresh-cache` | Clears the Radarr runtime cache |
| GET | `/api/movies/cache-stats` | Returns SQLite cache stats |
| GET | `/api/health` | Health check — returns `{ status: "ok" }` |

---

## Key Conventions

### Error Handling
- **`api/client.js`** only calls `.json()` if the response `Content-Type` is `application/json` — prevents crashes on empty/HTML error bodies (e.g., proxy errors).
- **`stores/settings.js`** — `fetchSettings` swallows errors silently (backend may not be ready on startup). `saveSettings` propagates errors via `saveError` ref.
- Toast notifications (PrimeVue `useToast`) are used for all user-facing success/error feedback. The `<Toast>` component is mounted once in `App.vue`. Import `useToast` from `primevue/usetoast` in any component that needs it.

### Settings Store
- `saveError` (not `error`) is the ref that holds save failures — the distinction matters because fetch failures are intentionally silent.
- Sensitive keys (`plex_token`, `radarr_api_key`) are masked as `***` in GET responses. The POST handler skips saving if the value is `***`.

### Database
- SQLite at `backend/data/plex-issue-finder.db` (dev) or `/data/plex-issue-finder.db` (Docker, set via `DB_PATH` env var).
- Schema is created on first run via `initSchema()` in `db/index.js`. Default settings rows are inserted with `INSERT OR IGNORE`.
- Radarr runtimes are cached in `radarr_cache` keyed by TMDB ID.

### Frontend Patterns
- All views use `<script setup>` with Composition API.
- Pinia stores are the single source of truth for async state (`loading`, data, errors).
- PrimeVue components are imported per-component (not globally registered), except `Toast` which is in `App.vue`.

---

## Adding a New Feature

1. **Backend route:** Add a new file in `backend/src/routes/`, mount it in `index.js`.
2. **Pinia store:** Create `frontend/src/stores/<feature>.js` following the pattern in `settings.js` or `movieDuration.js`.
3. **View:** Add a Vue SFC in `frontend/src/views/`, register it in `frontend/src/router/index.js`, and add a card to `DashboardView.vue`.
4. Use `useToast()` for success/error feedback — do not use inline `<Message>` banners for transient state.
