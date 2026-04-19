# Plex Issue Finder

A web app for diagnosing and fixing issues with your Plex media library.

**Current features:**
- 🎬 **Movie Duration Check** — flags movies whose actual Plex duration differs from the expected runtime in Radarr by more than a configurable tolerance.
- 🎥 **Video Quality Check** — flags movies below a configurable minimum resolution threshold, with per-library settings.
- 🔍 **Unmanaged Movies** — finds movies in Plex that have no matching entry in Radarr, so they won't receive quality upgrades or monitoring.
- 📺 **Unmonitored Episodes** — finds shows in Sonarr with unmonitored seasons or episodes. Enable monitoring directly from the results.

## Requirements

- Docker & Docker Compose
- A running Plex Media Server
- A running Radarr instance
- A running Sonarr instance (for the Unmonitored Episodes tool)

## Quick Start

```bash
git clone https://github.com/cbulock/plex-issue-finder
cd plex-issue-finder
docker compose up -d
```

Then open **http://\<your-server-ip\>:8756** in your browser.

> The image is published to the GitHub Container Registry (`ghcr.io/cbulock/plex-issue-finder:latest`) and is pulled automatically. To build locally instead, run `docker compose up -d --build`.

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

The frontend dev server proxies `/api/*` to `http://localhost:3000`, so run both simultaneously.

## Movie Duration Check

1. Configure Plex and Radarr URLs + credentials in **Settings**.
2. Optionally select which Plex libraries to scan under **Plex Libraries** in Settings.
3. Set your preferred leeway percentage (default: **5%**).
4. Navigate to **Movie Duration Check** and click **Run Check**.
5. Movies where `|actual − expected| / expected > leeway%` are flagged.
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

## Data Storage

All settings and cache are stored in a SQLite database at `/data/plex-issue-finder.db` inside the container, mounted as a Docker named volume (`plex-issue-finder-data`).
