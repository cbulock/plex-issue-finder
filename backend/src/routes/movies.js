const express = require('express');
const router = express.Router();
const { fetchPlexMovies } = require('../api/plex');
const { fetchRadarrMovies } = require('../api/radarr');
const {
  getSetting,
  getCachedRuntime,
  upsertCachedRuntime,
  clearCache,
  getCacheStats,
} = require('../db');

function getConfig() {
  const libraryIds = getSetting('plex_library_ids') || '';
  return {
    plexUrl: getSetting('plex_url'),
    plexToken: getSetting('plex_token'),
    radarrUrl: getSetting('radarr_url'),
    radarrApiKey: getSetting('radarr_api_key'),
    leewayPercent: parseFloat(getSetting('leeway_percent') || '5'),
    minDiffMinutes: parseFloat(getSetting('movie_min_diff_min') || '5'),
    selectedLibraryIds: libraryIds ? libraryIds.split(',').map((s) => s.trim()).filter(Boolean) : [],
  };
}

function validateConfig(config) {
  const missing = [];
  if (!config.plexUrl) missing.push('plex_url');
  if (!config.plexToken) missing.push('plex_token');
  if (!config.radarrUrl) missing.push('radarr_url');
  if (!config.radarrApiKey) missing.push('radarr_api_key');
  return missing;
}

// Normalize a title for fuzzy matching (lowercase, strip punctuation/articles)
function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

// GET /api/movies/check?force=true
router.get('/check', async (req, res) => {
  const config = getConfig();
  const missing = validateConfig(config);
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing configuration: ${missing.join(', ')}. Please configure in Settings.`,
    });
  }

  const forceRefresh = req.query.force === 'true';
  console.log(`\n[Check] Starting duration check (forceRefresh=${forceRefresh})`);

  try {
    // --- Step 1: Fetch Plex movies ---
    const { movies: plexMovies, machineIdentifier } = await fetchPlexMovies(config.plexUrl, config.plexToken, config.selectedLibraryIds);
    const plexWithTmdb = plexMovies.filter((m) => m.tmdbId).length;
    console.log(`[Check] Plex: ${plexMovies.length} total, ${plexWithTmdb} have TMDB IDs, ${plexMovies.length - plexWithTmdb} missing TMDB IDs`);

    // --- Step 2: Build Radarr runtime map (TMDB ID keyed) ---
    let radarrMap = new Map();       // tmdbId -> { title, runtimeMinutes, fromCache }
    let radarrTitleMap = new Map();  // normalizedTitle+year -> { tmdbId, title, runtimeMinutes }

    if (forceRefresh) {
      clearCache();
      console.log('[Check] Cache cleared for force refresh');
    }

    // Check what's already cached
    const uncachedTmdbIds = new Set();
    let cacheHits = 0;

    for (const movie of plexMovies) {
      if (!movie.tmdbId) continue;
      const cached = getCachedRuntime(movie.tmdbId);
      if (cached && !forceRefresh) {
        radarrMap.set(movie.tmdbId, {
          title: cached.title,
          runtimeMinutes: cached.runtime_min,
          titleSlug: cached.title_slug || '',
          radarrId: cached.radarr_id || null,
          fromCache: true,
        });
        cacheHits++;
      } else {
        uncachedTmdbIds.add(movie.tmdbId);
      }
    }

    console.log(`[Check] Cache: ${cacheHits} hits, ${uncachedTmdbIds.size} need Radarr fetch`);

    // Fetch from Radarr if we have anything uncached OR movies without TMDB IDs
    const moviesWithoutTmdb = plexMovies.filter((m) => !m.tmdbId);
    const needRadarrFetch = uncachedTmdbIds.size > 0 || moviesWithoutTmdb.length > 0;

    if (needRadarrFetch) {
      console.log('[Check] Fetching from Radarr...');
      let radarrFull;
      try {
        radarrFull = await fetchRadarrMovies(config.radarrUrl, config.radarrApiKey);
      } catch (radarrErr) {
        console.error('[Check] Radarr fetch FAILED:', radarrErr.message);
        return res.status(502).json({
          error: `Failed to connect to Radarr: ${radarrErr.message}`,
        });
      }

      console.log(`[Check] Radarr returned ${radarrFull.size} movies`);

      // Cache and map all Radarr movies
      for (const [tmdbId, data] of radarrFull) {
        upsertCachedRuntime(tmdbId, data.title, data.runtimeMinutes, data.titleSlug, data.radarrId);
        radarrMap.set(tmdbId, { ...data, fromCache: false });

        // Build title+year index for fallback matching
        const key = `${normalizeTitle(data.title)}:${data.year}`;
        radarrTitleMap.set(key, { tmdbId, ...data });
      }

      console.log(`[Check] Radarr data cached. radarrMap size: ${radarrMap.size}`);
    } else {
      // Build title map from cache for no-TMDB fallback (shouldn't happen often)
      console.log('[Check] All entries served from cache, skipping Radarr fetch');
    }

    // --- Step 3: Compare durations ---
    const flagged = [];
    const ok = [];
    const noMatch = [];
    let titleFallbacks = 0;

    for (const movie of plexMovies) {
      let radarr = movie.tmdbId ? radarrMap.get(movie.tmdbId) : null;
      let matchedBy = 'tmdb';

      // Fallback: match by normalized title + year
      if (!radarr && radarrTitleMap.size > 0) {
        const key = `${normalizeTitle(movie.title)}:${movie.year}`;
        const titleMatch = radarrTitleMap.get(key);
        if (titleMatch) {
          radarr = { title: titleMatch.title, runtimeMinutes: titleMatch.runtimeMinutes, fromCache: false };
          matchedBy = 'title';
          titleFallbacks++;
        }
      }

      if (!radarr || radarr.runtimeMinutes === 0) {
        noMatch.push({
          title: movie.title,
          year: movie.year,
          tmdbId: movie.tmdbId,
          plexRatingKey: movie.ratingKey,
          plexDurationMin: movie.durationMin,
          reason: radarr ? 'Radarr runtime is 0' : 'Not found in Radarr',
        });
        continue;
      }

      const expected = radarr.runtimeMinutes;
      const actual = movie.durationMin;
      const diffMinutes = Math.abs(actual - expected);
      const diffPercent = diffMinutes / expected * 100;
      const percentThresholdMinutes = expected * (config.leewayPercent / 100);
      const thresholdMinutes = Math.max(percentThresholdMinutes, config.minDiffMinutes);

      const entry = {
        title: movie.title,
        year: movie.year,
        tmdbId: movie.tmdbId,
        plexRatingKey: movie.ratingKey,
        radarrSlug: radarr.titleSlug || '',
        radarrId: radarr.radarrId || null,
        plexDurationMin: actual,
        expectedDurationMin: expected,
        diffMinutes,
        diffPercent: parseFloat(diffPercent.toFixed(2)),
        thresholdMinutes: parseFloat(thresholdMinutes.toFixed(2)),
        matchedBy,
        fromCache: radarr.fromCache,
      };

      if (diffMinutes > thresholdMinutes) {
        flagged.push(entry);
      } else {
        ok.push(entry);
      }
    }

    // Sort flagged by diff descending
    flagged.sort((a, b) => b.diffPercent - a.diffPercent);

    console.log(`[Check] Results: ${flagged.length} flagged, ${ok.length} ok, ${noMatch.length} no match, ${titleFallbacks} title-fallback matches`);

    res.json({
      summary: {
        total: plexMovies.length,
        flagged: flagged.length,
        ok: ok.length,
        noMatch: noMatch.length,
        leewayPercent: config.leewayPercent,
        minDiffMinutes: config.minDiffMinutes,
        plexUrl: config.plexUrl,
        radarrUrl: config.radarrUrl,
        plexMachineId: machineIdentifier,
      },
      flagged,
      noMatch,
    });
  } catch (err) {
    console.error('[Check] Unexpected error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/movies/redownload
router.post('/redownload', async (req, res) => {
  const { movieIds } = req.body;
  if (!Array.isArray(movieIds) || movieIds.length === 0) {
    return res.status(400).json({ error: 'movieIds must be a non-empty array' });
  }

  const config = getConfig();
  const missing = validateConfig(config);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing configuration: ${missing.join(', ')}` });
  }

  const baseUrl = config.radarrUrl.replace(/\/$/, '');
  const headers = { 'X-Api-Key': config.radarrApiKey };
  const errors = [];
  let deleted = 0;

  console.log(`[Redownload] Processing ${movieIds.length} movies...`);

  // Step 1: Delete existing files
  for (const radarrId of movieIds) {
    try {
      const { data: movie } = await require('axios').get(`${baseUrl}/api/v3/movie/${radarrId}`, { headers });
      if (movie.hasFile && movie.movieFile && movie.movieFile.id) {
        await require('axios').delete(`${baseUrl}/api/v3/moviefile/${movie.movieFile.id}`, { headers });
        console.log(`[Redownload] Deleted file for "${movie.title}" (radarrId=${radarrId})`);
        deleted++;
      } else {
        console.log(`[Redownload] No file to delete for "${movie.title}" (radarrId=${radarrId})`);
      }
    } catch (err) {
      const msg = `Failed to delete file for radarrId=${radarrId}: ${err.message}`;
      console.error(`[Redownload] ${msg}`);
      errors.push(msg);
    }
  }

  // Step 2: Trigger search for all movies (batch command)
  try {
    await require('axios').post(
      `${baseUrl}/api/v3/command`,
      { name: 'MoviesSearch', movieIds },
      { headers }
    );
    console.log(`[Redownload] Search command queued for ${movieIds.length} movies`);
  } catch (err) {
    const msg = `Failed to trigger search: ${err.message}`;
    console.error(`[Redownload] ${msg}`);
    errors.push(msg);
  }

  res.json({ queued: movieIds.length, deleted, errors });
});

// POST /api/movies/refresh-cache
router.post('/refresh-cache', (req, res) => {
  clearCache();
  console.log('[Cache] Cleared by user request');
  res.json({ success: true, message: 'Cache cleared. Next check will re-fetch from Radarr.' });
});

// GET /api/movies/cache-stats
router.get('/cache-stats', (req, res) => {
  const stats = getCacheStats();
  res.json(stats);
});

module.exports = router;

