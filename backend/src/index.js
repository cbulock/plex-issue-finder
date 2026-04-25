require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/settings', require('./routes/settings'));
app.use('/api/movies', require('./routes/movies'));
app.use('/api/plex', require('./routes/plex'));
app.use('/api/quality', require('./routes/quality'));
app.use('/api/coverage', require('./routes/coverage'));
app.use('/api/sonarr', require('./routes/sonarr'));
app.use('/api/episode-duration', require('./routes/episodeDuration'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve Vue frontend (production build)
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Plex Issue Finder running on http://0.0.0.0:${PORT}`);
});
