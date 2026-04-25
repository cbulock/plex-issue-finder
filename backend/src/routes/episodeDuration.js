const express = require('express');
const axios = require('axios');
const router = express.Router();
const { fetchPlexTvEpisodes } = require('../api/plex');
const { fetchSonarrSeries } = require('../api/sonarr');
const { getSetting } = require('../db');

const CONCURRENCY_LIMIT = 5;

function getConfig() {
  const libraryIds = getSetting('plex_library_ids') || '';
  return {
    plexUrl: getSetting('plex_url'),
    plexToken: getSetting('plex_token'),
    sonarrUrl: getSetting('sonarr_url'),
    sonarrApiKey: getSetting('sonarr_api_key'),
    leewayPercent: parseFloat(getSetting('leeway_percent') || '5'),
    minDiffMinutes: parseFloat(getSetting('episode_min_diff_min') || '3'),
    selectedLibraryIds: libraryIds ? libraryIds.split(',').map((s) => s.trim()).filter(Boolean) : [],
  };
}

function validateConfig(config) {
  const missing = [];
  if (!config.plexUrl) missing.push('plex_url');
  if (!config.plexToken) missing.push('plex_token');
  if (!config.sonarrUrl) missing.push('sonarr_url');
  if (!config.sonarrApiKey) missing.push('sonarr_api_key');
  return missing;
}

async function mapWithConcurrency(items, fn, limit) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// GET /api/episode-duration/check
router.get('/check', async (req, res) => {
  const config = getConfig();
  const missing = validateConfig(config);
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing configuration: ${missing.join(', ')}. Please configure in Settings.`,
    });
  }

  console.log('\n[EpisodeDuration] Starting episode duration check');

  try {
    // --- Step 1: Fetch Plex TV episodes ---
    let plexEpisodes, machineIdentifier;
    try {
      ({ episodes: plexEpisodes, machineIdentifier } = await fetchPlexTvEpisodes(
        config.plexUrl,
        config.plexToken,
        config.selectedLibraryIds
      ));
    } catch (plexErr) {
      console.error('[EpisodeDuration] Plex fetch FAILED:', plexErr.message);
      // Config/library errors (e.g. no matching libraries) are client errors, not gateway errors
      const isConfigError = plexErr.message.includes('No matching TV show libraries');
      return res
        .status(isConfigError ? 400 : 502)
        .json({ error: plexErr.message });
    }

    console.log(`[EpisodeDuration] Plex: ${plexEpisodes.length} total episodes`);

    // --- Step 2: Fetch Sonarr series and build tvdbId -> series map ---
    let allSonarrSeries;
    try {
      allSonarrSeries = await fetchSonarrSeries(config.sonarrUrl, config.sonarrApiKey);
    } catch (sonarrErr) {
      console.error('[EpisodeDuration] Sonarr fetch FAILED:', sonarrErr.message);
      return res.status(502).json({ error: `Failed to connect to Sonarr: ${sonarrErr.message}` });
    }

    // Build tvdbId -> { runtime, id, titleSlug, title } map
    const sonarrSeriesMap = new Map();
    for (const series of allSonarrSeries) {
      if (series.tvdbId) {
        sonarrSeriesMap.set(series.tvdbId, {
          runtime: series.runtime || 0,
          id: series.id,
          titleSlug: series.titleSlug || '',
          title: series.title,
        });
      }
    }

    console.log(`[EpisodeDuration] Sonarr: ${allSonarrSeries.length} series, ${sonarrSeriesMap.size} with TVDB IDs`);

    // --- Step 3: Compare durations ---
    const flagged = [];
    const ok = [];
    const noMatch = [];

    for (const ep of plexEpisodes) {
      // Only process episodes from Sonarr-managed shows (matched by TVDB ID)
      if (!ep.tvdbId) continue;

      const sonarr = sonarrSeriesMap.get(ep.tvdbId);
      if (!sonarr) continue; // Show not in Sonarr — skip silently

      if (sonarr.runtime === 0) {
        noMatch.push({
          showTitle: ep.showTitle,
          showYear: ep.showYear,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
          title: ep.title,
          plexRatingKey: ep.ratingKey,
          plexDurationMin: ep.durationMin,
          reason: 'Sonarr series runtime is 0',
        });
        continue;
      }

      const expected = sonarr.runtime;
      const actual = ep.durationMin;

      // Skip episodes with zero duration (likely missing/undownloaded)
      if (actual === 0) continue;
      // Guard against unexpected zero runtime (should be caught above, but be defensive)
      if (expected === 0) continue;

      const diffMinutes = Math.abs(actual - expected);
      const diffPercent = diffMinutes / expected * 100;
      const percentThresholdMinutes = expected * (config.leewayPercent / 100);
      const thresholdMinutes = Math.max(percentThresholdMinutes, config.minDiffMinutes);

      const entry = {
        showTitle: ep.showTitle,
        showYear: ep.showYear,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        plexRatingKey: ep.ratingKey,
        sonarrSeriesId: sonarr.id,
        sonarrSeriesSlug: sonarr.titleSlug,
        plexDurationMin: actual,
        expectedDurationMin: expected,
        diffMinutes,
        diffPercent: parseFloat(diffPercent.toFixed(2)),
        thresholdMinutes: parseFloat(thresholdMinutes.toFixed(2)),
      };

      if (diffMinutes > thresholdMinutes) {
        flagged.push(entry);
      } else {
        ok.push(entry);
      }
    }

    // Sort flagged by diff descending
    flagged.sort((a, b) => b.diffPercent - a.diffPercent);

    // Count only episodes from Sonarr-managed shows (tvdbId matched)
    const managedTotal = flagged.length + ok.length + noMatch.length;

    console.log(`[EpisodeDuration] Results: ${flagged.length} flagged, ${ok.length} ok, ${noMatch.length} no match (of ${managedTotal} Sonarr-managed episodes)`);

    res.json({
      summary: {
        total: managedTotal,
        flagged: flagged.length,
        ok: ok.length,
        noMatch: noMatch.length,
        leewayPercent: config.leewayPercent,
        minDiffMinutes: config.minDiffMinutes,
        plexUrl: config.plexUrl,
        sonarrUrl: config.sonarrUrl,
        plexMachineId: machineIdentifier,
      },
      flagged,
      noMatch,
    });
  } catch (err) {
    console.error('[EpisodeDuration] Unexpected error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/episode-duration/redownload
// Body: { episodes: [{ sonarrSeriesId, seasonNumber, episodeNumber }] }
router.post('/redownload', async (req, res) => {
  try {
    const { episodes } = req.body;
    if (!Array.isArray(episodes) || episodes.length === 0) {
      return res.status(400).json({ error: 'episodes must be a non-empty array' });
    }

    const config = getConfig();
    const missing = validateConfig(config);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing configuration: ${missing.join(', ')}` });
    }

    const baseUrl = config.sonarrUrl.replace(/\/$/, '');
    const headers = { 'X-Api-Key': config.sonarrApiKey };

    // Group requested episodes by seriesId for efficient fetching
    const bySeriesId = new Map();
    for (const ep of episodes) {
      if (typeof ep.sonarrSeriesId !== 'number' || typeof ep.seasonNumber !== 'number' || typeof ep.episodeNumber !== 'number') {
        return res.status(400).json({ error: 'Each episode entry must have numeric sonarrSeriesId, seasonNumber, and episodeNumber' });
      }
      if (!bySeriesId.has(ep.sonarrSeriesId)) {
        bySeriesId.set(ep.sonarrSeriesId, []);
      }
      bySeriesId.get(ep.sonarrSeriesId).push({ seasonNumber: ep.seasonNumber, episodeNumber: ep.episodeNumber });
    }

    console.log(`[EpisodeRedownload] Processing ${episodes.length} episode(s) across ${bySeriesId.size} series...`);

    // Fetch episodes for each series and collect Sonarr episode IDs
    const sonarrEpisodeIds = [];
    const errors = [];

    const seriesEntries = [...bySeriesId.entries()];
    const episodeFetchResults = await mapWithConcurrency(
      seriesEntries,
      async ([seriesId, requestedEps]) => {
        try {
          const { data: seriesEpisodes } = await axios.get(`${baseUrl}/api/v3/episode`, {
            headers,
            params: { seriesId },
          });
          const matched = [];
          for (const req of requestedEps) {
            const found = seriesEpisodes.find(
              (e) => e.seasonNumber === req.seasonNumber && e.episodeNumber === req.episodeNumber
            );
            if (found) {
              matched.push(found);
            } else {
              errors.push(`Episode S${String(req.seasonNumber).padStart(2, '0')}E${String(req.episodeNumber).padStart(2, '0')} not found in Sonarr for seriesId=${seriesId}`);
            }
          }
          return matched;
        } catch (err) {
          errors.push(`Failed to fetch episodes for seriesId=${seriesId}: ${err.message}`);
          return [];
        }
      },
      CONCURRENCY_LIMIT
    );

    for (const matched of episodeFetchResults) {
      for (const ep of matched) {
        sonarrEpisodeIds.push(ep.id);
      }
    }

    if (sonarrEpisodeIds.length === 0) {
      return res.json({ queued: 0, deleted: 0, errors });
    }

    // Delete existing episode files
    let deleted = 0;
    const episodeFileIds = episodeFetchResults
      .flat()
      .filter((ep) => ep.hasFile && ep.episodeFileId)
      .map((ep) => ep.episodeFileId);

    for (const fileId of episodeFileIds) {
      try {
        await axios.delete(`${baseUrl}/api/v3/episodefile/${fileId}`, { headers });
        console.log(`[EpisodeRedownload] Deleted episode file id=${fileId}`);
        deleted++;
      } catch (err) {
        const msg = `Failed to delete episode file id=${fileId}: ${err.message}`;
        console.error(`[EpisodeRedownload] ${msg}`);
        errors.push(msg);
      }
    }

    // Trigger episode search
    try {
      await axios.post(
        `${baseUrl}/api/v3/command`,
        { name: 'EpisodeSearch', episodeIds: sonarrEpisodeIds },
        { headers }
      );
      console.log(`[EpisodeRedownload] Search command queued for ${sonarrEpisodeIds.length} episode(s)`);
    } catch (err) {
      const msg = `Failed to trigger episode search: ${err.message}`;
      console.error(`[EpisodeRedownload] ${msg}`);
      errors.push(msg);
    }

    res.json({ queued: sonarrEpisodeIds.length, deleted, errors });
  } catch (err) {
    console.error('[EpisodeRedownload] Unexpected error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
