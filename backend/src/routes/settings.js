const express = require('express');
const router = express.Router();
const { getAllSettings, setSetting } = require('../db');

const ALLOWED_KEYS = ['plex_url', 'plex_token', 'radarr_url', 'radarr_api_key', 'leeway_percent', 'plex_library_ids', 'quality_thresholds'];

// GET /api/settings
router.get('/', (req, res) => {
  const settings = getAllSettings();
  // Mask sensitive values in response — send only non-empty flag for secrets
  res.json({
    plex_url: settings.plex_url || '',
    plex_token: settings.plex_token ? '***' : '',
    radarr_url: settings.radarr_url || '',
    radarr_api_key: settings.radarr_api_key ? '***' : '',
    leeway_percent: settings.leeway_percent || '5',
    plex_library_ids: settings.plex_library_ids || '',
    quality_thresholds: settings.quality_thresholds || '{}',
    plex_token_set: !!settings.plex_token,
    radarr_api_key_set: !!settings.radarr_api_key,
  });
});

// POST /api/settings
router.post('/', (req, res) => {
  const body = req.body || {};
  const errors = [];

  for (const key of ALLOWED_KEYS) {
    if (key in body) {
      const value = String(body[key]).trim();

      // Skip masked placeholder — don't overwrite with '***'
      if (value === '***') continue;

      if (key === 'leeway_percent') {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 100) {
          errors.push('leeway_percent must be a number between 0 and 100');
          continue;
        }
      }

      setSetting(key, value);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  res.json({ success: true });
});

module.exports = router;
