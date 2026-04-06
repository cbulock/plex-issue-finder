const express = require('express');
const router = express.Router();
const { fetchPlexMovies } = require('../api/plex');
const { fetchRadarrMovies } = require('../api/radarr');
const { getSetting } = require('../db');

// GET /api/coverage/check
router.get('/check', async (req, res) => {
  const plexUrl = getSetting('plex_url');
  const plexToken = getSetting('plex_token');
  const radarrUrl = getSetting('radarr_url');
  const radarrApiKey = getSetting('radarr_api_key');

  const missing = [];
  if (!plexUrl) missing.push('plex_url');
  if (!plexToken) missing.push('plex_token');
  if (!radarrUrl) missing.push('radarr_url');
  if (!radarrApiKey) missing.push('radarr_api_key');
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing configuration: ${missing.join(', ')}. Please configure in Settings.` });
  }

  const libraryIds = getSetting('plex_library_ids') || '';
  const selectedLibraryIds = libraryIds ? libraryIds.split(',').map((s) => s.trim()).filter(Boolean) : [];

  console.log('\n[Coverage] Starting coverage check');

  try {
    const [{ movies: plexMovies, machineIdentifier }, radarrMap] = await Promise.all([
      fetchPlexMovies(plexUrl, plexToken, selectedLibraryIds),
      fetchRadarrMovies(radarrUrl, radarrApiKey),
    ]);

    console.log(`[Coverage] Plex: ${plexMovies.length} movies, Radarr: ${radarrMap.size} movies`);

    const radarrTmdbIds = new Set(radarrMap.keys());

    const unmanaged = [];
    for (const movie of plexMovies) {
      if (!movie.tmdbId || !radarrTmdbIds.has(movie.tmdbId)) {
        unmanaged.push({
          title: movie.title,
          year: movie.year,
          tmdbId: movie.tmdbId,
          plexRatingKey: movie.ratingKey,
          sectionTitle: movie.sectionTitle,
          reason: movie.tmdbId ? 'Not in Radarr' : 'No TMDB ID',
        });
      }
    }

    unmanaged.sort((a, b) => a.title.localeCompare(b.title));

    console.log(`[Coverage] ${unmanaged.length} unmanaged movies (in Plex, not in Radarr)`);

    res.json({
      summary: {
        total: plexMovies.length,
        unmanaged: unmanaged.length,
        plexUrl,
        plexMachineId: machineIdentifier,
      },
      unmanaged,
    });
  } catch (err) {
    console.error('[Coverage] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
