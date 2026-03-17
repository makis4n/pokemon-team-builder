const express = require('express');
const cors = require('cors');
const path = require('path');
const pokemonRouter = require('./src/routes/pokemon');
const { warmGameFilterAvailabilityCache } = require('./src/services/pokeapi');

const app = express();
const PORT = process.env.PORT || 4000;
const publicDir = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'pokemon-team-builder-backend',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ping', (_req, res) => {
  res.status(200).json({ message: 'API is reachable' });
});

app.use('/api/pokemon', pokemonRouter);

app.use(express.static(publicDir));

app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    return next();
  }

  return res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : error.message;

  res.status(statusCode).json({
    error: {
      message,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Backend server is running at http://localhost:${PORT}`);

  void warmGameFilterAvailabilityCache()
    .then(({ warmedFilters, failedFilters }) => {
      console.log(`Availability cache warmup complete: ${warmedFilters} warmed, ${failedFilters} failed.`);
    })
    .catch((error) => {
      console.warn(`Availability cache warmup failed: ${error.message}`);
    });
});