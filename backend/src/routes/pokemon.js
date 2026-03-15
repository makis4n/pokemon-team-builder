const express = require('express');
const { listPokemon, getPokemonByNameOrId, listDefensiveCandidates } = require('../services/pokeapi');
const {
  getPriorityWeakTypes,
  computeWeightedTypeSummary,
  generateDefensiveInsights,
  recommendDefensiveSwaps,
} = require('../services/defensiveRecommendations');

const pokemonRouter = express.Router();
const DEFENSIVE_ANALYSIS_CACHE_TTL_MS = 3 * 60 * 1000;
const DEFENSIVE_SWAPS_CACHE_TTL_MS = 3 * 60 * 1000;
const defensiveAnalysisCache = new Map();
const defensiveSwapsCache = new Map();

function readRouteCache(cache, key) {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.payload;
}

function writeRouteCache(cache, key, payload, ttlMs) {
  cache.set(key, {
    payload,
    expiresAt: Date.now() + ttlMs,
  });
}

pokemonRouter.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const limit = Number(req.query.limit || 20);
    const offset = Number(req.query.offset || 0);

    const data = await listPokemon({ search, limit, offset });
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

pokemonRouter.get('/defensive-candidates', async (req, res, next) => {
  try {
    const weakTypes = String(req.query.weakTypes || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const excludeIds = String(req.query.excludeIds || '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));

    const limit = Number(req.query.limit || 90);
    const scanLimit = Number(req.query.scanLimit || 240);

    const data = await listDefensiveCandidates({
      weakTypes,
      excludeIds,
      limit,
      scanLimit,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

pokemonRouter.post('/defensive-swaps', async (req, res, next) => {
  try {
    const team = Array.isArray(req.body?.team) ? req.body.team : [];
    const topK = Number(req.body?.topK || 5);
    const candidateLimit = Number(req.body?.candidateLimit || 90);
    const scanLimit = Number(req.body?.scanLimit || 240);

    if (team.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }

    const teamSignature = team
      .map((pokemon) => Number(pokemon?.id))
      .filter((id) => Number.isFinite(id))
      .sort((left, right) => left - right)
      .join(',');
    const cacheKey = `${teamSignature}|k=${topK}|limit=${candidateLimit}|scan=${scanLimit}`;

    const cachedResponse = readRouteCache(defensiveSwapsCache, cacheKey);
    if (cachedResponse) {
      res.status(200).json({ data: cachedResponse });
      return;
    }

    const weakTypes = getPriorityWeakTypes(team);
    const excludeIds = team
      .map((pokemon) => Number(pokemon?.id))
      .filter((id) => Number.isFinite(id));

    const candidatePool = await listDefensiveCandidates({
      weakTypes,
      excludeIds,
      limit: candidateLimit,
      scanLimit,
    });

    const data = recommendDefensiveSwaps(team, candidatePool, {
      topK,
      maxCandidates: candidateLimit,
    });

    writeRouteCache(defensiveSwapsCache, cacheKey, data, DEFENSIVE_SWAPS_CACHE_TTL_MS);

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

pokemonRouter.post('/team-defense-analysis', async (req, res, next) => {
  try {
    const team = Array.isArray(req.body?.team) ? req.body.team : [];

    if (team.length === 0) {
      res.status(200).json({ data: { typeSummary: [], defensiveInsights: [] } });
      return;
    }

    const teamSignature = team
      .map((pokemon) => Number(pokemon?.id))
      .filter((id) => Number.isFinite(id))
      .sort((left, right) => left - right)
      .join(',');

    const cachedResponse = readRouteCache(defensiveAnalysisCache, teamSignature);
    if (cachedResponse) {
      res.status(200).json({ data: cachedResponse });
      return;
    }

    const data = {
      typeSummary: computeWeightedTypeSummary(team),
      defensiveInsights: generateDefensiveInsights(team),
    };

    writeRouteCache(defensiveAnalysisCache, teamSignature, data, DEFENSIVE_ANALYSIS_CACHE_TTL_MS);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

pokemonRouter.get('/:nameOrId', async (req, res, next) => {
  try {
    const pokemon = await getPokemonByNameOrId(req.params.nameOrId);
    res.status(200).json({ data: pokemon });
  } catch (error) {
    next(error);
  }
});

module.exports = pokemonRouter;
