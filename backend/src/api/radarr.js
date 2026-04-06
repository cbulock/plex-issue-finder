const axios = require('axios');

/**
 * Fetches all movies from Radarr.
 * Returns a Map of tmdbId -> { title, year, runtimeMinutes }
 */
async function fetchRadarrMovies(radarrUrl, apiKey) {
  const baseUrl = radarrUrl.replace(/\/$/, '');
  console.log(`[Radarr] Fetching all movies from ${baseUrl}...`);

  const res = await axios.get(`${baseUrl}/api/v3/movie`, {
    headers: { 'X-Api-Key': apiKey },
  });

  const movieMap = new Map();
  let noTmdb = 0;

  for (const movie of res.data) {
    if (movie.tmdbId) {
      movieMap.set(movie.tmdbId, {
        title: movie.title,
        year: movie.year,
        runtimeMinutes: movie.runtime || 0,
        titleSlug: movie.titleSlug || '',
        radarrId: movie.id,
      });
    } else {
      noTmdb++;
    }
  }

  console.log(`[Radarr] ${movieMap.size} movies with TMDB ID, ${noTmdb} without. Total: ${res.data.length}`);
  return movieMap;
}

module.exports = { fetchRadarrMovies };
