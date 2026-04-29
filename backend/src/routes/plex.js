const express = require('express');
const router = express.Router();
const { fetchPlexLibraries } = require('../api/plex');
const { getSetting } = require('../db');

// GET /api/plex/libraries — returns all Plex library sections using saved credentials
router.get('/libraries', async (req, res) => {
  const plexUrl = getSetting('plex_url');
  const plexToken = getSetting('plex_token');

  if (!plexUrl || !plexToken) {
    return res.status(400).json({ error: 'Plex URL and token must be configured in Settings before loading libraries.' });
  }

  try {
    const libraries = await fetchPlexLibraries(plexUrl, plexToken);
    console.log(`[Plex] Libraries endpoint returned ${libraries.length} sections`);
    res.json(libraries);
  } catch (err) {
    console.error('[Plex] Failed to fetch libraries:', err.message);
    res.status(502).json({ error: `Failed to connect to Plex: ${err.message}` });
  }
});

// POST /api/plex/libraries — returns all Plex library sections, accepting optional credentials
// in the request body to override saved settings. This allows fetching libraries with unsaved
// form values (e.g. before saving for the first time) without exposing credentials in the URL.
router.post('/libraries', async (req, res) => {
  const plexUrl = req.body.plex_url || getSetting('plex_url');
  const plexToken = req.body.plex_token || getSetting('plex_token');

  if (!plexUrl || !plexToken) {
    return res.status(400).json({ error: 'Plex URL and token are required. Enter them in the form or save them in Settings first.' });
  }

  try {
    const libraries = await fetchPlexLibraries(plexUrl, plexToken);
    console.log(`[Plex] Libraries endpoint returned ${libraries.length} sections`);
    res.json(libraries);
  } catch (err) {
    console.error('[Plex] Failed to fetch libraries:', err.message);
    res.status(502).json({ error: `Failed to connect to Plex: ${err.message}` });
  }
});

module.exports = router;
