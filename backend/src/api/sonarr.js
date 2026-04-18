const axios = require('axios');

/**
 * Fetches all series from Sonarr, including season monitoring info.
 * Returns array of series objects with seasons.
 */
async function fetchSonarrSeries(sonarrUrl, apiKey) {
  const baseUrl = sonarrUrl.replace(/\/$/, '');
  console.log(`[Sonarr] Fetching all series from ${baseUrl}...`);

  const res = await axios.get(`${baseUrl}/api/v3/series`, {
    headers: { 'X-Api-Key': apiKey },
  });

  console.log(`[Sonarr] ${res.data.length} series fetched`);
  return res.data;
}

/**
 * Fetches all episodes for a given series.
 */
async function fetchSonarrEpisodes(sonarrUrl, apiKey, seriesId) {
  const baseUrl = sonarrUrl.replace(/\/$/, '');

  const res = await axios.get(`${baseUrl}/api/v3/episode`, {
    headers: { 'X-Api-Key': apiKey },
    params: { seriesId },
  });

  return res.data;
}

/**
 * Sets monitoring status for a list of episode IDs.
 */
async function monitorEpisodes(sonarrUrl, apiKey, episodeIds, monitored) {
  const baseUrl = sonarrUrl.replace(/\/$/, '');

  await axios.put(
    `${baseUrl}/api/v3/episode/monitor`,
    { episodeIds, monitored },
    { headers: { 'X-Api-Key': apiKey } }
  );
}

/**
 * Updates a series in Sonarr (used to toggle season monitoring).
 * Requires the full series object with modified seasons array.
 */
async function updateSonarrSeries(sonarrUrl, apiKey, series) {
  const baseUrl = sonarrUrl.replace(/\/$/, '');

  const res = await axios.put(
    `${baseUrl}/api/v3/series/${series.id}`,
    series,
    { headers: { 'X-Api-Key': apiKey } }
  );

  return res.data;
}

module.exports = {
  fetchSonarrSeries,
  fetchSonarrEpisodes,
  monitorEpisodes,
  updateSonarrSeries,
};
