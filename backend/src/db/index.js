const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/plex-issue-finder.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS radarr_cache (
      tmdb_id     INTEGER PRIMARY KEY,
      title       TEXT NOT NULL,
      runtime_min INTEGER NOT NULL,
      title_slug  TEXT NOT NULL DEFAULT '',
      radarr_id   INTEGER,
      fetched_at  TEXT NOT NULL
    );
  `);

  // Migrate: add title_slug column if it doesn't exist yet
  const cols = db.prepare("PRAGMA table_info(radarr_cache)").all();
  if (!cols.find((c) => c.name === 'title_slug')) {
    db.exec("ALTER TABLE radarr_cache ADD COLUMN title_slug TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.find((c) => c.name === 'radarr_id')) {
    db.exec("ALTER TABLE radarr_cache ADD COLUMN radarr_id INTEGER");
  }

  // Insert default settings if not present
  const defaults = [
    ['plex_url', ''],
    ['plex_token', ''],
    ['radarr_url', ''],
    ['radarr_api_key', ''],
    ['leeway_percent', '5'],
    ['plex_library_ids', ''],
    ['quality_thresholds', '{}'],
  ];
  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of defaults) {
    insert.run(key, value);
  }

  // Seed from .env if values are present and settings are still empty
  const seeds = [
    ['plex_url', process.env.PLEX_URL],
    ['plex_token', process.env.PLEX_TOKEN],
    ['radarr_url', process.env.RADARR_URL],
    ['radarr_api_key', process.env.RADARR_API_KEY],
  ];
  const update = db.prepare(
    'UPDATE settings SET value = ? WHERE key = ? AND value = ?'
  );
  for (const [key, envVal] of seeds) {
    if (envVal) update.run(envVal, key, '');
  }
}

function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function getAllSettings() {
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function setSetting(key, value) {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, String(value));
}

function getCachedRuntime(tmdbId) {
  return getDb()
    .prepare('SELECT * FROM radarr_cache WHERE tmdb_id = ?')
    .get(tmdbId);
}

function upsertCachedRuntime(tmdbId, title, runtimeMin, titleSlug = '', radarrId = null) {
  getDb()
    .prepare(
      'INSERT OR REPLACE INTO radarr_cache (tmdb_id, title, runtime_min, title_slug, radarr_id, fetched_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(tmdbId, title, runtimeMin, titleSlug, radarrId, new Date().toISOString());
}

function clearCache() {
  getDb().prepare('DELETE FROM radarr_cache').run();
}

function getCacheStats() {
  const row = getDb()
    .prepare('SELECT COUNT(*) as count, MIN(fetched_at) as oldest, MAX(fetched_at) as newest FROM radarr_cache')
    .get();
  return row;
}

module.exports = {
  getDb,
  getSetting,
  getAllSettings,
  setSetting,
  getCachedRuntime,
  upsertCachedRuntime,
  clearCache,
  getCacheStats,
};
