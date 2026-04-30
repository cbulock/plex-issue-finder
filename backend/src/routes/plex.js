const express = require('express');
const router = express.Router();
const { fetchPlexLibraries } = require('../api/plex');
const { getSetting } = require('../db');

// Shared handler: fetch libraries using the provided credentials, falling back to saved settings.
async function handleLibrariesRequest(plexUrl, plexToken, res) {
  const url = plexUrl || getSetting('plex_url');
  const token = plexToken || getSetting('plex_token');

  if (!url || !token) {
    return res.status(400).json({ error: 'Plex URL and token are required. Enter them in the form or save them in Settings first.' });
  }

  try {
    const libraries = await fetchPlexLibraries(url, token);
    console.log(`[Plex] Libraries endpoint returned ${libraries.length} sections`);
    res.json(libraries);
  } catch (err) {
    console.error('[Plex] Failed to fetch libraries:', err.message);
    res.status(502).json({ error: `Failed to connect to Plex: ${err.message}` });
  }
}

// GET /api/plex/libraries — returns all Plex library sections using saved credentials
router.get('/libraries', async (req, res) => {
  return handleLibrariesRequest(null, null, res);
});

// POST /api/plex/libraries — returns all Plex library sections, accepting optional credentials
// in the request body to override saved settings. This allows fetching libraries with unsaved
// form values (e.g. before saving for the first time) without exposing credentials in the URL.
router.post('/libraries', async (req, res) => {
  const body = req.body || {};
  return handleLibrariesRequest(body.plex_url, body.plex_token, res);
});

module.exports = router;
