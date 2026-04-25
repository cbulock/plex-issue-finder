const axios = require('axios');

const MS_PER_MINUTE = 60000;

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
async function fetchPlexMovies(plexUrl, plexToken, selectedSectionKeys = null) {
  const headers = { 'X-Plex-Token': plexToken, Accept: 'application/json' };
  const baseUrl = plexUrl.replace(/\/$/, '');

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

  for (const section of movieSections) {
    console.log(`[Plex] Fetching movies from section "${section.title}" (key=${section.key})...`);
    const moviesRes = await axios.get(
      `${baseUrl}/library/sections/${section.key}/all`,
      // includeGuids=1 is required to get TMDB/IMDB IDs in the response
      { headers, params: { includeGuids: 1 } }
    );
    const items = moviesRes.data.MediaContainer.Metadata || [];
    console.log(`[Plex] Section "${section.title}": ${items.length} items`);

    let withTmdb = 0;
    let withoutTmdb = 0;

    for (const item of items) {
      // Extract duration from the first media item
      const media = item.Media && item.Media[0];
      const durationMs = media ? media.duration : item.duration;

      // Extract TMDB id from Guids — requires includeGuids=1 on the request
      let tmdbId = null;
      if (item.Guid && Array.isArray(item.Guid)) {
        const tmdbGuid = item.Guid.find((g) => g.id && g.id.startsWith('tmdb://'));
        if (tmdbGuid) {
          tmdbId = parseInt(tmdbGuid.id.replace('tmdb://', ''), 10);
        }
      }

      if (tmdbId) withTmdb++; else withoutTmdb++;

      movies.push({
        title: item.title,
        year: item.year,
        tmdbId,
        ratingKey: item.ratingKey,
        sectionKey: String(section.key),
        sectionTitle: section.title,
        durationMs: durationMs || 0,
        durationMin: durationMs ? Math.round(durationMs / MS_PER_MINUTE) : 0,
        videoResolution: (media && media.videoResolution) || '',
        videoCodec: (media && media.videoCodec) || '',
        audioCodec: (media && media.audioCodec) || '',
        audioChannels: (media && media.audioChannels) || 0,
      });
    }

    console.log(`[Plex] Section "${section.title}": ${withTmdb} with TMDB ID, ${withoutTmdb} without`);
  }

  console.log(`[Plex] Total movies fetched: ${movies.length}`);
  return { movies, machineIdentifier };
}

/**
 * Fetches all TV show episodes from Plex TV libraries.
 * If selectedSectionKeys is a non-empty array, only scans those sections (still filtered to type=show).
 * Returns { episodes, machineIdentifier } where each episode includes tvdbId from its parent show.
 */
async function fetchPlexTvEpisodes(plexUrl, plexToken, selectedSectionKeys = null) {
  const headers = { 'X-Plex-Token': plexToken, Accept: 'application/json' };
  const baseUrl = plexUrl.replace(/\/$/, '');

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

    for (const ep of epItems) {
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

  console.log(`[Plex] Total TV episodes fetched: ${episodes.length}`);
  return { episodes, machineIdentifier };
}

module.exports = { fetchPlexMovies, fetchPlexLibraries, fetchPlexTvEpisodes };
