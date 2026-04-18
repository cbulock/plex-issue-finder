const express = require('express');
const router = express.Router();
const {
  fetchSonarrSeries,
  fetchSonarrEpisodes,
  monitorEpisodes,
  updateSonarrSeries,
} = require('../api/sonarr');
const { getSetting } = require('../db');

const CONCURRENCY_LIMIT = 5;

function getSonarrConfig() {
  return {
    sonarrUrl: getSetting('sonarr_url'),
    sonarrApiKey: getSetting('sonarr_api_key'),
  };
}

function validateSonarrConfig(config) {
  const missing = [];
  if (!config.sonarrUrl) missing.push('sonarr_url');
  if (!config.sonarrApiKey) missing.push('sonarr_api_key');
  return missing;
}

/**
 * Process an array of items with limited concurrency.
 * Returns an array of results in the same order as the input.
 */
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

// GET /api/sonarr/check — find series with unmonitored seasons/episodes
router.get('/check', async (req, res) => {
  const config = getSonarrConfig();
  const missing = validateSonarrConfig(config);
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing configuration: ${missing.join(', ')}. Please configure Sonarr in Settings.`,
    });
  }

  console.log('\n[Sonarr] Starting unmonitored check');

  try {
    const allSeries = await fetchSonarrSeries(config.sonarrUrl, config.sonarrApiKey);

    const results = [];
    let totalSeries = allSeries.length;
    let seriesWithIssues = 0;
    let totalUnmonitoredSeasons = 0;
    let totalUnmonitoredEpisodes = 0;

    // Filter to monitored series that need episode-level inspection
    const candidates = allSeries.filter((series) => {
      if (!series.monitored) return false;

      const unmonitoredSeasons = (series.seasons || []).filter(
        (s) => !s.monitored && s.seasonNumber > 0
      );
      const hasMonitoredSeasons = (series.seasons || []).some(
        (s) => s.monitored && s.seasonNumber > 0
      );

      return unmonitoredSeasons.length > 0 || hasMonitoredSeasons;
    });

    console.log(`[Sonarr] ${candidates.length} candidate series to inspect (of ${allSeries.length} total)`);

    // Fetch episodes for all candidates with limited concurrency
    const episodeResults = await mapWithConcurrency(
      candidates,
      async (series) => {
        try {
          return await fetchSonarrEpisodes(config.sonarrUrl, config.sonarrApiKey, series.id);
        } catch (err) {
          console.warn(`[Sonarr] Failed to fetch episodes for "${series.title}": ${err.message}`);
          return [];
        }
      },
      CONCURRENCY_LIMIT
    );

    for (let i = 0; i < candidates.length; i++) {
      const series = candidates[i];
      const episodes = episodeResults[i];

      const unmonitoredSeasons = (series.seasons || []).filter(
        (s) => !s.monitored && s.seasonNumber > 0
      );

      // Find individually unmonitored episodes in monitored seasons
      const monitoredSeasonNumbers = new Set(
        (series.seasons || [])
          .filter((s) => s.monitored && s.seasonNumber > 0)
          .map((s) => s.seasonNumber)
      );
      const individuallyUnmonitored = episodes.filter(
        (ep) => monitoredSeasonNumbers.has(ep.seasonNumber) && !ep.monitored
      );

      // Skip if nothing is unmonitored
      if (unmonitoredSeasons.length === 0 && individuallyUnmonitored.length === 0) continue;

      const seasonEntries = unmonitoredSeasons.map((s) => {
        const seasonEps = episodes.filter((ep) => ep.seasonNumber === s.seasonNumber);
        const unmonitoredCount = seasonEps.filter((ep) => !ep.monitored).length;
        return {
          seasonNumber: s.seasonNumber,
          totalEpisodes: seasonEps.length,
          unmonitoredEpisodes: unmonitoredCount,
          episodeIds: seasonEps.filter((ep) => !ep.monitored).map((ep) => ep.id),
        };
      });

      const individualEntries = individuallyUnmonitored.map((ep) => ({
        episodeId: ep.id,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        title: ep.title || `Episode ${ep.episodeNumber}`,
        hasFile: ep.hasFile || false,
      }));

      if (seasonEntries.length > 0 || individualEntries.length > 0) {
        seriesWithIssues++;
        totalUnmonitoredSeasons += seasonEntries.length;
        totalUnmonitoredEpisodes += individualEntries.length;
        for (const s of seasonEntries) {
          totalUnmonitoredEpisodes += s.unmonitoredEpisodes;
        }

        results.push({
          seriesId: series.id,
          title: series.title,
          year: series.year,
          titleSlug: series.titleSlug || '',
          tvdbId: series.tvdbId || null,
          totalSeasons: (series.seasons || []).filter((s) => s.seasonNumber > 0).length,
          unmonitoredSeasons: seasonEntries,
          unmonitoredEpisodes: individualEntries,
        });
      }
    }

    results.sort((a, b) => a.title.localeCompare(b.title));

    console.log(`[Sonarr] Results: ${seriesWithIssues} series with issues, ${totalUnmonitoredSeasons} unmonitored seasons, ${totalUnmonitoredEpisodes} unmonitored episodes`);

    res.json({
      summary: {
        totalSeries,
        seriesWithIssues,
        totalUnmonitoredSeasons,
        totalUnmonitoredEpisodes,
        sonarrUrl: config.sonarrUrl,
      },
      results,
    });
  } catch (err) {
    console.error('[Sonarr] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sonarr/monitor — enable monitoring for selected episodes/seasons
router.post('/monitor', async (req, res) => {
  const { episodeIds, seasons } = req.body;
  // episodeIds: number[] — individual episodes to monitor
  // seasons: { seriesId: number, seasonNumbers: number[] }[] — full seasons to monitor

  const config = getSonarrConfig();
  const missing = validateSonarrConfig(config);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing configuration: ${missing.join(', ')}` });
  }

  // Validate episodeIds if provided
  if (episodeIds !== undefined && (!Array.isArray(episodeIds) || !episodeIds.every((id) => typeof id === 'number'))) {
    return res.status(400).json({ error: 'episodeIds must be an array of numbers' });
  }

  // Validate seasons if provided
  if (seasons !== undefined) {
    if (!Array.isArray(seasons)) {
      return res.status(400).json({ error: 'seasons must be an array' });
    }
    for (const entry of seasons) {
      if (!entry || typeof entry !== 'object' || typeof entry.seriesId !== 'number' || !Array.isArray(entry.seasonNumbers)) {
        return res.status(400).json({ error: 'Each season entry must have a numeric seriesId and an array of seasonNumbers' });
      }
    }
  }

  const errors = [];
  let monitoredEpisodes = 0;
  let monitoredSeasons = 0;

  // 1. Monitor individual episodes
  if (Array.isArray(episodeIds) && episodeIds.length > 0) {
    try {
      await monitorEpisodes(config.sonarrUrl, config.sonarrApiKey, episodeIds, true);
      monitoredEpisodes = episodeIds.length;
      console.log(`[Sonarr] Monitored ${episodeIds.length} individual episodes`);
    } catch (err) {
      const msg = `Failed to monitor episodes: ${err.message}`;
      console.error(`[Sonarr] ${msg}`);
      errors.push(msg);
    }
  }

  // 2. Monitor full seasons (requires updating the series object)
  if (Array.isArray(seasons) && seasons.length > 0) {
    // Fetch series list once for all season updates
    let allSeries;
    try {
      allSeries = await fetchSonarrSeries(config.sonarrUrl, config.sonarrApiKey);
    } catch (err) {
      const msg = `Failed to fetch series list: ${err.message}`;
      console.error(`[Sonarr] ${msg}`);
      errors.push(msg);
      return res.json({ monitoredEpisodes, monitoredSeasons, errors });
    }

    for (const { seriesId, seasonNumbers } of seasons) {
      try {
        const series = allSeries.find((s) => s.id === seriesId);
        if (!series) {
          errors.push(`Series ${seriesId} not found`);
          continue;
        }

        // Update season monitoring
        let updated = false;
        for (const season of series.seasons) {
          if (seasonNumbers.includes(season.seasonNumber) && !season.monitored) {
            season.monitored = true;
            updated = true;
            monitoredSeasons++;
          }
        }

        if (updated) {
          await updateSonarrSeries(config.sonarrUrl, config.sonarrApiKey, series);

          // Also monitor all episodes in those seasons
          const episodes = await fetchSonarrEpisodes(config.sonarrUrl, config.sonarrApiKey, seriesId);
          const epsToMonitor = episodes
            .filter((ep) => seasonNumbers.includes(ep.seasonNumber) && !ep.monitored)
            .map((ep) => ep.id);

          if (epsToMonitor.length > 0) {
            await monitorEpisodes(config.sonarrUrl, config.sonarrApiKey, epsToMonitor, true);
            monitoredEpisodes += epsToMonitor.length;
          }

          console.log(`[Sonarr] Monitored seasons ${seasonNumbers.join(', ')} for "${series.title}"`);
        }
      } catch (err) {
        const msg = `Failed to monitor seasons for series ${seriesId}: ${err.message}`;
        console.error(`[Sonarr] ${msg}`);
        errors.push(msg);
      }
    }
  }

  res.json({ monitoredEpisodes, monitoredSeasons, errors });
});

module.exports = router;
