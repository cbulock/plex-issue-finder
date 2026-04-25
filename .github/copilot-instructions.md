# Copilot Instructions

## Build, test, and lint commands

| Area | Command | Notes |
| --- | --- | --- |
| Backend dev server | `cd backend && npm install && npm run dev` | Runs the Express API on port 3000 with `node --watch src/index.js`. |
| Backend production server | `cd backend && npm run start` | Serves the API and the built frontend from `frontend/dist`. |
| Frontend dev server | `cd frontend && npm install && npm run dev` | Runs Vite on port 5173 and proxies `/api` to `http://127.0.0.1:3000`. |
| Frontend build | `cd frontend && npm run build` | Produces `frontend/dist` for production. |
| Frontend preview | `cd frontend && npm run preview` | Previews the built Vite app locally. |
| Docker run | `docker compose up -d` | Starts the published single-container app on host port 8756. |
| Docker rebuild | `docker compose build` | Rebuilds the image locally. |

There are currently **no automated test scripts or lint scripts** in `backend/package.json` or `frontend/package.json`, so there is no full-suite or single-test command to run.

## High-level architecture

- The app is a **single-container web app**: Vite builds the Vue frontend, and Express serves both the API and the production SPA. In development, run backend and frontend separately.
- `backend/src/index.js` is the backend entry point. It mounts feature routes under `/api/*`, exposes `/api/health`, then falls back to serving `frontend/dist/index.html` for SPA routing.
- `backend/src/db/index.js` is the only persistence layer. SQLite stores both user settings and the Radarr runtime cache. Default settings are inserted on first run, and environment variables only seed values that are still blank.
- Plex is the source of library contents. `backend/src/api/plex.js` fetches Plex libraries, movie metadata, TV episode metadata, and the Plex `machineIdentifier` used for deep links in the UI.
- Radarr and Sonarr are joined to Plex by external IDs, not filenames. Movie features use TMDB IDs from Plex/Radarr; TV features use TVDB IDs from Plex/Sonarr.
- The movie duration check is the most stateful backend flow: it fetches Plex movies, reuses SQLite-cached Radarr runtimes keyed by TMDB ID, optionally clears that cache on `?force=true`, and falls back to normalized `title + year` matching when TMDB IDs are missing.
- The frontend is organized by feature: each route has a Pinia store for async state and a view for PrimeVue tables/actions. The router lazy-loads feature views from `frontend/src/router/index.js`.
- Feature stores persist the last result set in `localStorage`, so the UI is intentionally stateful across refreshes even though the backend checks are stateless.

## Key conventions

- Use `frontend/src/api/client.js` for new API calls when possible. It only parses JSON when the response is actually JSON and throws backend error messages cleanly.
- The settings API never returns raw secrets. `GET /api/settings` masks saved secrets as `***` and exposes `plex_token_set`, `radarr_api_key_set`, and `sonarr_api_key_set`; `POST /api/settings` must ignore `***` so unchanged secrets are preserved.
- The settings store is intentionally asymmetric: `fetchSettings()` fails silently during startup, while `saveSettings()` surfaces failures through `saveError` and rethrows.
- The root `<Toast>` is mounted once in `frontend/src/App.vue`. For transient success/error feedback, import `useToast()` in the view instead of adding new top-level toast mounts.
- Result-heavy Pinia stores use `markRaw()` before saving API payloads. This avoids PrimeVue `DataTable` reactivity problems on large result arrays and should be preserved for similar feature results.
- For the same reason, views pre-compute base URLs like Plex/Radarr/Sonarr link prefixes in top-level computed values instead of reading deep reactive state inside table row slots.
- `plex_library_ids` is stored as a comma-separated string in SQLite, while `quality_thresholds` is stored as a JSON string keyed by Plex section key. Keep that serialization format when adding settings.
- Sonarr routes use a shared concurrency-limited worker pattern (`CONCURRENCY_LIMIT = 5`) when fanning out episode requests. Follow that pattern rather than firing unbounded parallel requests.
- The Vite proxy must target `http://127.0.0.1:3000`, not `http://localhost:3000`, or local development can fail because Node resolves `localhost` to IPv6 while the backend listens on IPv4.
