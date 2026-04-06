const express = require('express');
const router = express.Router();
const { fetchPlexMovies } = require('../api/plex');
const { fetchRadarrMovies } = require('../api/radarr');
const { getSetting } = require('../db');

const RESOLUTION_RANK = { '480p': 1, '720p': 2, '1080p': 3, '4k': 4 };

function parseResolution(raw) {
  if (!raw) return { label: 'Unknown', rank: 0 };
  const r = String(raw).toLowerCase();
  if (r === '4k' || r === '2160') return { label: '4K', rank: 4 };
  if (r === '1080') return { label: '1080p', rank: 3 };
  if (r === '720') return { label: '720p', rank: 2 };
  if (r === '480') return { label: '480p', rank: 1 };
  return { label: raw, rank: 0 };
}

// GET /api/quality/check
router.get('/check', async (req, res) => {
  const plexUrl = getSetting('plex_url');
  const plexToken = getSetting('plex_token');
  const radarrUrl = getSetting('radarr_url');
  const radarrApiKey = getSetting('radarr_api_key');

  if (!plexUrl || !plexToken) {
    return res.status(400).json({ error: 'Plex URL and token must be configured in Settings.' });
  }

  const libraryIds = getSetting('plex_library_ids') || '';
  const selectedLibraryIds = libraryIds ? libraryIds.split(',').map((s) => s.trim()).filter(Boolean) : [];

  let thresholds = {};
  try {
    thresholds = JSON.parse(getSetting('quality_thresholds') || '{}');
  } catch {
    thresholds = {};
  }

  console.log('\n[Quality] Starting quality check');
  console.log('[Quality] Thresholds by section:', thresholds);

  try {
    const [{ movies, machineIdentifier }, radarrMap] = await Promise.all([
      fetchPlexMovies(plexUrl, plexToken, selectedLibraryIds),
      radarrUrl && radarrApiKey ? fetchRadarrMovies(radarrUrl, radarrApiKey) : Promise.resolve(new Map()),
    ]);
    console.log(`[Quality] Fetched ${movies.length} movies from Plex, ${radarrMap.size} from Radarr`);

    const flagged = [];
    const ok = [];

    for (const movie of movies) {
      const thresholdKey = thresholds[movie.sectionKey] || '1080p';
      const thresholdRank = RESOLUTION_RANK[thresholdKey] || 3;
      const { label: resLabel, rank: resRank } = parseResolution(movie.videoResolution);

      const entry = {
        title: movie.title,
        year: movie.year,
        tmdbId: movie.tmdbId,
        plexRatingKey: movie.ratingKey,
        sectionKey: movie.sectionKey,
        sectionTitle: movie.sectionTitle,
        videoResolution: resLabel,
        videoCodec: movie.videoCodec || '',
        audioCodec: movie.audioCodec || '',
        audioChannels: movie.audioChannels || 0,
        threshold: thresholdKey,
        radarrSlug: radarrMap.get(movie.tmdbId)?.titleSlug || '',
        radarrId: radarrMap.get(movie.tmdbId)?.radarrId || null,
      };

      if (resRank < thresholdRank) {
        flagged.push(entry);
      } else {
        ok.push(entry);
      }
    }

    flagged.sort((a, b) => a.title.localeCompare(b.title));

    console.log(`[Quality] Results: ${flagged.length} flagged, ${ok.length} ok`);

    res.json({
      summary: {
        total: movies.length,
        flagged: flagged.length,
        ok: ok.length,
        plexUrl,
        plexMachineId: machineIdentifier,
        radarrUrl: radarrUrl || '',
      },
      flagged,
      ok,
    });
  } catch (err) {
    console.error('[Quality] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
