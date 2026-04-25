# Plex Issue Finder

A web app for diagnosing and fixing issues with your Plex media library, styled with the Emberline terminal-inspired design system.

**Current features:**
- 🎬 **Movie Duration Check** — flags movies whose actual Plex duration differs from the expected runtime in Radarr by more than a configurable percentage tolerance and minimum minute difference.
- 🎥 **Video Quality Check** — flags movies below a configurable minimum resolution threshold, with per-library settings.
- 🔍 **Unmanaged Movies** — finds movies in Plex that have no matching entry in Radarr, so they won't receive quality upgrades or monitoring.
- 📺 **Unmonitored Episodes** — finds shows in Sonarr with unmonitored seasons or episodes. Enable monitoring directly from the results.
- ⏱️ **Episode Duration Check** — flags TV episodes whose actual Plex duration differs from the expected runtime in Sonarr by more than a configurable percentage tolerance and minimum minute difference.

## Requirements

- Docker & Docker Compose
- A running Plex Media Server
- A running Radarr instance
- A running Sonarr instance (for the Unmonitored Episodes and Episode Duration Check tools)

## Quick Start

```bash
git clone https://github.com/cbulock/plex-issue-finder
cd plex-issue-finder
docker compose up -d
```

Then open **http://\<your-server-ip\>:8756** in your browser.

> The pre-built image (`ghcr.io/cbulock/plex-issue-finder:latest`) is a single container that includes both the frontend and backend. It is pulled automatically from the GitHub Container Registry — no local build required.

## Configuration

All settings can be configured through the **Settings** page in the UI. They are persisted in a Docker volume so they survive container restarts.

Alternatively, you can pre-seed credentials via environment variables in `docker-compose.yml`:

| Variable        | Description                          |
|-----------------|--------------------------------------|
| `PLEX_URL`      | Plex server URL (e.g. `http://192.168.1.50:32400`) |
| `PLEX_TOKEN`    | Plex authentication token            |
| `RADARR_URL`    | Radarr URL (e.g. `http://192.168.1.50:7878`)        |
| `RADARR_API_KEY`| Radarr API key                       |
| `SONARR_URL`    | Sonarr URL (e.g. `http://192.168.1.50:8989`)        |
| `SONARR_API_KEY`| Sonarr API key                       |

### Finding your Plex Token

See [Plex support article](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/).

### Finding your Radarr API Key

Go to **Radarr → Settings → General → Security → API Key**.

### Finding your Sonarr API Key

Go to **Sonarr → Settings → General → Security → API Key**.

## Development

### Backend

```bash
cd backend
cp ../.env.example .env   # fill in your values
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api/*` to `http://127.0.0.1:3000`, so run both simultaneously.

The frontend also installs the shared Emberline design system directly from GitHub via `github:cbulock/design-system`, which provides the shared fonts, tokens, and base CSS used by the app shell and views.

## Movie Duration Check

1. Configure Plex and Radarr URLs + credentials in **Settings**.
2. Optionally select which Plex libraries to scan under **Plex Libraries** in Settings.
3. Set your preferred leeway percentage (default: **5%**) and movie minimum difference (default: **5 min**).
4. Navigate to **Movie Duration Check** and click **Run Check**.
5. Movies are flagged only when the runtime difference is greater than both the percentage threshold and the minimum difference, i.e. `|actual - expected| > max(expected * leeway%, min_diff_minutes)`.
6. Radarr runtimes are cached in SQLite. Use **Force Refresh Cache** to re-fetch.
7. Select flagged movies and click **Redownload** to delete the existing file in Radarr and trigger a new automatic search.

## Video Quality Check

1. Configure Plex and Radarr URLs + credentials in **Settings**.
2. Under **Plex Libraries** in Settings, select the libraries to scan and set a minimum resolution threshold per library (default: **1080p**).
3. Navigate to **Video Quality Check** and click **Run Check**.
4. Movies below their library's resolution threshold are flagged, showing resolution, codec, and audio details.
5. Select flagged movies and click **Redownload** to trigger a Radarr quality upgrade search.

## Unmanaged Movies

1. Configure Plex and Radarr URLs + credentials in **Settings**.
2. Optionally select which Plex libraries to scan under **Plex Libraries** in Settings.
3. Navigate to **Unmanaged Movies** and click **Run Check**.
4. Movies present in Plex but with no matching TMDB entry in Radarr are listed. These movies won't receive automatic quality upgrades or monitoring.

## Unmonitored Episodes

1. Configure your Sonarr URL and API key in **Settings**.
2. Navigate to **Unmonitored Episodes** and click **Run Check**.
3. The tool scans all monitored series in Sonarr and identifies unmonitored seasons and individually unmonitored episodes.
4. Expand a row to see season and episode details.
5. Select series and click **Monitor All Selected** to enable monitoring for all unmonitored content in those series.

## Episode Duration Check

1. Configure Plex and Sonarr URLs + credentials in **Settings**.
2. Set your preferred leeway percentage (default: **5%**) and episode minimum difference (default: **3 min**) under **Duration Tolerance** in Settings.
3. Navigate to **Episode Duration Check** and click **Run Check**.
4. Only episodes from shows managed by Sonarr (matched by TVDB ID) are compared. Episodes are flagged only when the runtime difference is greater than both the percentage threshold and the minimum difference, i.e. `|actual - expected| > max(expected * leeway%, min_diff_minutes)`.
5. Select flagged episodes and click **Redownload** to delete the existing file in Sonarr and trigger a new automatic episode search.

## Data Storage

All settings and cache are stored in a SQLite database at `/data/plex-issue-finder.db` inside the container, mounted as a Docker named volume (`plex-issue-finder-data`).
