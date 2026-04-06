# Plex Issue Finder

A web app for diagnosing and fixing issues with your Plex media library.

**Current features:**
- 🎬 **Movie Duration Check** — flags movies whose actual Plex duration differs from the expected runtime in Radarr by more than a configurable tolerance.

## Requirements

- Docker & Docker Compose
- A running Plex Media Server
- A running Radarr instance

## Quick Start

```bash
git clone <repo-url> plex-issue-finder
cd plex-issue-finder
docker-compose up -d
```

Then open **http://\<your-server-ip\>:3000** in your browser.

## Configuration

All settings can be configured through the **Settings** page in the UI. They are persisted in a Docker volume so they survive container restarts.

Alternatively, you can pre-seed credentials via environment variables in `docker-compose.yml`:

| Variable        | Description                          |
|-----------------|--------------------------------------|
| `PLEX_URL`      | Plex server URL (e.g. `http://192.168.1.50:32400`) |
| `PLEX_TOKEN`    | Plex authentication token            |
| `RADARR_URL`    | Radarr URL (e.g. `http://192.168.1.50:7878`)        |
| `RADARR_API_KEY`| Radarr API key                       |

### Finding your Plex Token

See [Plex support article](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/).

### Finding your Radarr API Key

Go to **Radarr → Settings → General → Security → API Key**.

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
2. Set your preferred leeway percentage (default: **5%**).
3. Navigate to **Movie Duration Check** and click **Run Check**.
4. Movies where `|actual − expected| / expected > leeway%` are flagged.
5. Radarr runtimes are cached in SQLite. Use **Force Refresh Cache** to re-fetch.

## Data Storage

All settings and cache are stored in a SQLite database at `/data/plex-issue-finder.db` inside the container, mounted as a Docker named volume (`plex-issue-finder-data`).
