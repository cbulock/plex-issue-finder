const axios = require('axios');
const { spawn } = require('child_process');

const MS_PER_MINUTE = 60000;
const DEEP_SCAN_CONCURRENCY = Number(process.env.FFMPEG_DEEP_SCAN_CONCURRENCY || 2);
const DEEP_SCAN_TIMEOUT_MS = Number(process.env.FFMPEG_DEEP_SCAN_TIMEOUT_MS || 15 * 60 * 1000);
const FFMPEG_TERM_GRACE_MS = Number(process.env.FFMPEG_DEEP_SCAN_TERM_GRACE_MS || 5000);
const FFMPEG_LOG_LIMIT = 256 * 1024;

let ffmpegAvailablePromise = null;

function extractTmdbId(item) {
  if (!item.Guid || !Array.isArray(item.Guid)) {
    return null;
  }

  const tmdbGuid = item.Guid.find((guid) => guid.id && guid.id.startsWith('tmdb://'));
  if (!tmdbGuid) {
    return null;
  }

  return parseInt(tmdbGuid.id.replace('tmdb://', ''), 10);
}

function mapMovieMetadata(item, section) {
  const media = item.Media && item.Media[0];
  const durationMs = media ? media.duration : item.duration;

  return {
    title: item.title,
    year: item.year,
    tmdbId: extractTmdbId(item),
    ratingKey: item.ratingKey,
    sectionKey: String(section.key),
    sectionTitle: section.title,
    durationMs: durationMs || 0,
    durationMin: durationMs ? Math.round(durationMs / MS_PER_MINUTE) : 0,
    videoResolution: (media && media.videoResolution) || '',
    videoCodec: (media && media.videoCodec) || '',
    audioCodec: (media && media.audioCodec) || '',
    audioChannels: (media && media.audioChannels) || 0,
  };
}

function mapChannelLayout(value) {
  if (!value) return 0;

  const normalized = String(value).toLowerCase();
  if (normalized.includes('mono')) return 1;
  if (normalized.includes('stereo')) return 2;
  if (normalized.includes('2.1')) return 3;
  if (normalized.includes('3.1')) return 4;
  if (normalized.includes('4.1')) return 5;
  if (normalized.includes('5.1')) return 6;
  if (normalized.includes('6.1')) return 7;
  if (normalized.includes('7.1')) return 8;

  const discrete = normalized.match(/(\d+)\s*channels?/);
  if (discrete) {
    return parseInt(discrete[1], 10);
  }

  return 0;
}

function normalizeResolutionLabel(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const smallest = Math.min(w, h);

  if (smallest >= 2160) return '4k';
  if (smallest >= 1080) return '1080';
  if (smallest >= 720) return '720';
  if (smallest >= 480) return '480';
  return '';
}

function extractPrimaryAudioChannels(line) {
  if (!line) return 0;

  const channelLayoutMatch = line.match(/,\s*([0-9]\.[0-9](?:\(side\)|\(wide\))?|mono|stereo)\b/i);
  if (channelLayoutMatch) {
    return mapChannelLayout(channelLayoutMatch[1]);
  }

  const channelsMatch = line.match(/,\s*(\d+)\s*channels?\b/i);
  if (channelsMatch) {
    return parseInt(channelsMatch[1], 10);
  }

  return 0;
}

function parseFfmpegStreamMetadata(stderrText) {
  const lines = String(stderrText || '').split(/\r?\n/);
  const videoLine = lines.find((line) => line.includes(' Video: '));
  const audioLine = lines.find((line) => line.includes(' Audio: '));

  const videoCodec = videoLine?.match(/Video:\s*([^,\s]+)/)?.[1] || '';
  const audioCodec = audioLine?.match(/Audio:\s*([^,\s]+)/)?.[1] || '';
  const resolutionMatch = videoLine?.match(/(\d{2,5})x(\d{2,5})/);
  const width = resolutionMatch ? parseInt(resolutionMatch[1], 10) : 0;
  const height = resolutionMatch ? parseInt(resolutionMatch[2], 10) : 0;

  return {
    videoResolution: normalizeResolutionLabel(width, height),
    videoCodec,
    audioCodec,
    audioChannels: extractPrimaryAudioChannels(audioLine),
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function fetchPlexMovieDetails(baseUrl, headers, ratingKey) {
  const res = await axios.get(`${baseUrl}/library/metadata/${ratingKey}`, {
    headers,
    params: { includeGuids: 1 },
  });

  return res.data?.MediaContainer?.Metadata?.[0] || null;
}

async function ensureFfmpegAvailable() {
  if (!ffmpegAvailablePromise) {
    ffmpegAvailablePromise = new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'ignore', 'ignore'] });

      proc.on('error', (err) => {
        reject(new Error(`Deep scan requires ffmpeg, but it could not be started: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Deep scan requires ffmpeg, but \`ffmpeg -version\` exited with code ${code}.`));
      });
    });
  }

  return ffmpegAvailablePromise;
}

function buildPlexPartStreamUrl(baseUrl, plexToken, mediaPart) {
  const partKey = mediaPart && mediaPart.key;
  if (!partKey) {
    return null;
  }

  const url = new URL(partKey, `${baseUrl}/`);
  url.searchParams.set('download', '1');
  url.searchParams.set('X-Plex-Token', plexToken);
  return url.toString();
}

async function resolveDeepScanSourceItem({ baseUrl, headers, item, fetchDetails = fetchPlexMovieDetails }) {
  const mediaPart = item?.Media?.[0]?.Part?.[0];
  if (mediaPart?.key) {
    return { sourceItem: item, usedMetadataLookup: false };
  }

  return {
    sourceItem: await fetchDetails(baseUrl, headers, item.ratingKey),
    usedMetadataLookup: true,
  };
}

async function runFfmpegDeepScan(streamUrl, options = {}) {
  const spawnImpl = options.spawnImpl || spawn;
  const setTimeoutImpl = options.setTimeoutImpl || setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl || clearTimeout;
  const timeoutMs = Number(options.timeoutMs || DEEP_SCAN_TIMEOUT_MS);
  const termGraceMs = Number(options.termGraceMs || FFMPEG_TERM_GRACE_MS);

  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'info',
      '-nostdin',
      '-xerror',
      '-i',
      streamUrl,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-f',
      'null',
      '-',
    ];
    const proc = spawnImpl('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let timedOut = false;
    let forcedKill = false;
    let timeoutHandle = null;
    let forceKillHandle = null;

    function clearTimers() {
      if (timeoutHandle) {
        clearTimeoutImpl(timeoutHandle);
        timeoutHandle = null;
      }
      if (forceKillHandle) {
        clearTimeoutImpl(forceKillHandle);
        forceKillHandle = null;
      }
    }

    timeoutHandle = setTimeoutImpl(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      forceKillHandle = setTimeoutImpl(() => {
        forcedKill = true;
        proc.kill('SIGKILL');
      }, termGraceMs);
    }, timeoutMs);

    proc.on('error', (err) => {
      clearTimers();
      reject(err);
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > FFMPEG_LOG_LIMIT) {
        stderr = stderr.slice(-FFMPEG_LOG_LIMIT);
      }
    });

    proc.on('close', (code, signal) => {
      clearTimers();

      if (timedOut) {
        const killDetail = forcedKill ? ` after SIGTERM+SIGKILL (${termGraceMs}ms grace)` : ' after SIGTERM';
        reject(new Error(`ffmpeg deep scan timed out after ${Math.round(timeoutMs / 1000)}s${killDetail}`));
        return;
      }

      if (code === 0) {
        resolve(stderr);
        return;
      }

      const detail = stderr.trim().split(/\r?\n/).slice(-3).join(' | ') || `exit=${code} signal=${signal || 'none'}`;
      reject(new Error(`ffmpeg deep scan failed: ${detail}`));
    });
  });
}

function mergeDeepScannedMedia(item, sourceItem, scannedMedia) {
  const itemMedia = item?.Media?.[0];
  const sourceMedia = sourceItem?.Media?.[0];

  return {
    ...item,
    Media: [
      {
        ...(itemMedia || sourceMedia || {}),
        Part: itemMedia?.Part || sourceMedia?.Part || [],
        videoResolution: scannedMedia.videoResolution || itemMedia?.videoResolution || sourceMedia?.videoResolution || '',
        videoCodec: scannedMedia.videoCodec || itemMedia?.videoCodec || sourceMedia?.videoCodec || '',
        audioCodec: scannedMedia.audioCodec || itemMedia?.audioCodec || sourceMedia?.audioCodec || '',
        audioChannels: scannedMedia.audioChannels || itemMedia?.audioChannels || sourceMedia?.audioChannels || 0,
      },
    ],
  };
}

async function deepScanPlexVideoItem({ baseUrl, plexToken, headers, item, options = {} }) {
  const { sourceItem, usedMetadataLookup } = await resolveDeepScanSourceItem({
    baseUrl,
    headers,
    item,
    fetchDetails: options.fetchDetails,
  });
  const media = sourceItem?.Media?.[0];
  const part = media?.Part?.[0];
  const streamUrl = buildPlexPartStreamUrl(baseUrl, plexToken, part);

  if (!streamUrl) {
    throw new Error('missing Plex media part URL');
  }

  const stderrText = await runFfmpegDeepScan(streamUrl, options);
  const scannedMedia = parseFfmpegStreamMetadata(stderrText);
  if (!scannedMedia.videoResolution && !scannedMedia.videoCodec && !scannedMedia.audioCodec) {
    throw new Error('ffmpeg deep scan completed without stream metadata');
  }

  return {
    item: mergeDeepScannedMedia(item, sourceItem, scannedMedia),
    usedMetadataLookup,
  };
}

async function deepScanPlexVideoItems(items, context, options = {}) {
  const stats = {
    scanned: 0,
    metadataLookups: 0,
    fallbacks: 0,
  };

  const scannedItems = await mapWithConcurrency(items, options.concurrency || DEEP_SCAN_CONCURRENCY, async (item) => {
    try {
      const result = await deepScanPlexVideoItem({ ...context, item, options });
      stats.scanned += 1;
      if (result.usedMetadataLookup) {
        stats.metadataLookups += 1;
      }
      return result.item;
    } catch (err) {
      stats.fallbacks += 1;
      console.warn(`[Plex] Deep scan fallback for "${item.title || item.grandparentTitle || item.ratingKey}" (${item.ratingKey}): ${err.message}`);
      return item;
    }
  });

  return {
    items: scannedItems,
    stats,
  };
}

/**
 * Fetches all library sections from Plex.
 * Returns array of { key, title, type, count }
 */
async function fetchPlexLibraries(plexUrl, plexToken) {
  const baseUrl = plexUrl.replace(/\/$/, '');
  const headers = { 'X-Plex-Token': plexToken, Accept: 'application/json' };

  const res = await axios.get(`${baseUrl}/library/sections`, { headers });
  const sections = res.data?.MediaContainer?.Directory || [];

  return sections.map((s) => ({
    key: String(s.key),
    title: s.title,
    type: s.type,
    count: s.count || 0,
  }));
}

/**
 * Fetches all movie libraries and their movies from Plex.
 * If selectedSectionKeys is a non-empty array, only scans those sections (still filtered to type=movie).
 * Returns { movies, machineIdentifier }
 */
async function fetchPlexMovies(plexUrl, plexToken, selectedSectionKeys = null, options = {}) {
  const headers = { 'X-Plex-Token': plexToken, Accept: 'application/json' };
  const baseUrl = plexUrl.replace(/\/$/, '');
  const deepScan = options.deepScan === true;

  if (deepScan) {
    await ensureFfmpegAvailable();
  }

  // 1. Get server identity (machineIdentifier for deep links)
  console.log('[Plex] Fetching server identity...');
  const identityRes = await axios.get(`${baseUrl}/`, { headers });
  const machineIdentifier = identityRes.data.MediaContainer.machineIdentifier || '';
  console.log(`[Plex] Machine identifier: ${machineIdentifier}`);

  // 2. Get all library sections
  console.log('[Plex] Fetching library sections...');
  const sectionsRes = await axios.get(`${baseUrl}/library/sections`, { headers });
  const sections = sectionsRes.data.MediaContainer.Directory || [];
  let movieSections = sections.filter((s) => s.type === 'movie');

  // 3. Filter to user-selected sections if configured
  if (selectedSectionKeys && selectedSectionKeys.length > 0) {
    const keySet = new Set(selectedSectionKeys.map(String));
    movieSections = movieSections.filter((s) => keySet.has(String(s.key)));
    console.log(`[Plex] Filtering to ${movieSections.length} selected section(s):`, movieSections.map((s) => s.title));
  } else {
    console.log(`[Plex] Found ${movieSections.length} movie library section(s):`, movieSections.map((s) => s.title));
  }

  if (movieSections.length === 0) {
    throw new Error('No matching movie libraries found in Plex. Check your library selection in Settings.');
  }

  const movies = [];
  let deepScanFallbacks = 0;
  let deepScanMetadataLookups = 0;
  let deepScanScanned = 0;

  for (const section of movieSections) {
    console.log(`[Plex] Fetching movies from section "${section.title}" (key=${section.key})...`);
    const moviesRes = await axios.get(
      `${baseUrl}/library/sections/${section.key}/all`,
      // includeGuids=1 is required to get TMDB/IMDB IDs in the response
      { headers, params: { includeGuids: 1 } }
    );
    const items = moviesRes.data.MediaContainer.Metadata || [];
    console.log(`[Plex] Section "${section.title}": ${items.length} items`);

    let scanItems = items;
    if (deepScan) {
      const batchResult = await deepScanPlexVideoItems(items, { baseUrl, plexToken, headers });
      scanItems = batchResult.items;
      deepScanFallbacks += batchResult.stats.fallbacks;
      deepScanMetadataLookups += batchResult.stats.metadataLookups;
      deepScanScanned += batchResult.stats.scanned;
    }

    let withTmdb = 0;
    let withoutTmdb = 0;

    for (const item of scanItems) {
      const movie = mapMovieMetadata(item, section);
      if (movie.tmdbId) withTmdb++; else withoutTmdb++;
      movies.push(movie);
    }

    console.log(`[Plex] Section "${section.title}": ${withTmdb} with TMDB ID, ${withoutTmdb} without`);
  }

  if (deepScan) {
    console.log(`[Plex] Deep scan completed: ${deepScanScanned} ffmpeg decode(s), ${deepScanMetadataLookups} metadata lookup(s), ${deepScanFallbacks} fallback item(s)`);
  }

  console.log(`[Plex] Total movies fetched: ${movies.length}`);
  return { movies, machineIdentifier, deepScan, deepScanFallbacks, deepScanMetadataLookups, deepScanScanned };
}

/**
 * Fetches all TV show episodes from Plex TV libraries.
 * If selectedSectionKeys is a non-empty array, only scans those sections (still filtered to type=show).
 * Returns { episodes, machineIdentifier } where each episode includes tvdbId from its parent show.
 */
async function fetchPlexTvEpisodes(plexUrl, plexToken, selectedSectionKeys = null, options = {}) {
  const headers = { 'X-Plex-Token': plexToken, Accept: 'application/json' };
  const baseUrl = plexUrl.replace(/\/$/, '');
  const deepScan = options.deepScan === true;

  if (deepScan) {
    await ensureFfmpegAvailable();
  }

  // 1. Get server identity (machineIdentifier for deep links)
  console.log('[Plex] Fetching server identity...');
  const identityRes = await axios.get(`${baseUrl}/`, { headers });
  const machineIdentifier = identityRes.data.MediaContainer.machineIdentifier || '';

  // 2. Get all library sections
  console.log('[Plex] Fetching library sections...');
  const sectionsRes = await axios.get(`${baseUrl}/library/sections`, { headers });
  const sections = sectionsRes.data.MediaContainer.Directory || [];
  let tvSections = sections.filter((s) => s.type === 'show');

  // 3. Filter to user-selected sections if configured
  if (selectedSectionKeys && selectedSectionKeys.length > 0) {
    const keySet = new Set(selectedSectionKeys.map(String));
    tvSections = tvSections.filter((s) => keySet.has(String(s.key)));
    console.log(`[Plex] Filtering to ${tvSections.length} selected TV section(s):`, tvSections.map((s) => s.title));
  } else {
    console.log(`[Plex] Found ${tvSections.length} TV library section(s):`, tvSections.map((s) => s.title));
  }

  if (tvSections.length === 0) {
    throw new Error('No matching TV show libraries found in Plex. Check your library selection in Settings.');
  }

  const episodes = [];
  let deepScanFallbacks = 0;
  let deepScanMetadataLookups = 0;
  let deepScanScanned = 0;

  for (const section of tvSections) {
    console.log(`[Plex] Fetching shows from section "${section.title}" (key=${section.key})...`);

    // Fetch all shows with GUIDs to get TVDB IDs
    const showsRes = await axios.get(
      `${baseUrl}/library/sections/${section.key}/all`,
      { headers, params: { includeGuids: 1 } }
    );
    const showItems = showsRes.data.MediaContainer.Metadata || [];
    console.log(`[Plex] Section "${section.title}": ${showItems.length} shows`);

    // Build ratingKey -> { tvdbId, title, year } map from shows
    const showMap = new Map();
    for (const show of showItems) {
      let tvdbId = null;
      if (show.Guid && Array.isArray(show.Guid)) {
        const tvdbGuid = show.Guid.find((g) => g.id && g.id.startsWith('tvdb://'));
        if (tvdbGuid) {
          tvdbId = parseInt(tvdbGuid.id.replace('tvdb://', ''), 10);
        }
      }
      showMap.set(String(show.ratingKey), { tvdbId, title: show.title, year: show.year });
    }

    // Fetch all episodes (type=4) for this section
    console.log(`[Plex] Fetching episodes from section "${section.title}"...`);
    const episodesRes = await axios.get(
      `${baseUrl}/library/sections/${section.key}/all`,
      { headers, params: { type: 4 } }
    );
    const epItems = episodesRes.data.MediaContainer.Metadata || [];
    console.log(`[Plex] Section "${section.title}": ${epItems.length} episodes`);

    let scanItems = epItems;
    if (deepScan) {
      const batchResult = await deepScanPlexVideoItems(epItems, { baseUrl, plexToken, headers });
      scanItems = batchResult.items;
      deepScanFallbacks += batchResult.stats.fallbacks;
      deepScanMetadataLookups += batchResult.stats.metadataLookups;
      deepScanScanned += batchResult.stats.scanned;
    }

    for (const ep of scanItems) {
      const media = ep.Media && ep.Media[0];
      const durationMs = media ? media.duration : ep.duration;
      const showInfo = showMap.get(String(ep.grandparentRatingKey)) || {};

      episodes.push({
        ratingKey: ep.ratingKey,
        showTitle: ep.grandparentTitle || showInfo.title || '',
        showRatingKey: ep.grandparentRatingKey,
        showYear: showInfo.year || null,
        seasonNumber: ep.parentIndex,
        episodeNumber: ep.index,
        title: ep.title || '',
        tvdbId: showInfo.tvdbId || null,
        durationMs: durationMs || 0,
        durationMin: durationMs ? Math.round(durationMs / MS_PER_MINUTE) : 0,
        sectionKey: String(section.key),
      });
    }
  }

  if (deepScan) {
    console.log(`[Plex] Episode deep scan completed: ${deepScanScanned} ffmpeg decode(s), ${deepScanMetadataLookups} metadata lookup(s), ${deepScanFallbacks} fallback item(s)`);
  }

  console.log(`[Plex] Total TV episodes fetched: ${episodes.length}`);
  return { episodes, machineIdentifier, deepScan, deepScanFallbacks, deepScanMetadataLookups, deepScanScanned };
}

module.exports = {
  fetchPlexMovies,
  fetchPlexLibraries,
  fetchPlexTvEpisodes,
  __test: {
    buildPlexPartStreamUrl,
    deepScanPlexVideoItem,
    deepScanPlexVideoItems,
    ensureFfmpegAvailable,
    mergeDeepScannedMedia,
    parseFfmpegStreamMetadata,
    resolveDeepScanSourceItem,
    runFfmpegDeepScan,
  },
};
