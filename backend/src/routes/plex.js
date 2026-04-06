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

module.exports = router;
