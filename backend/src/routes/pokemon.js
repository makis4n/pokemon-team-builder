const express = require('express');
const {
  listPokemon,
  getPokemonByNameOrId,
  getPokemonTeamDetail,
  getMoveDetail,
  listDefensiveCandidates,
  isPokemonAvailableInGameFilter,
} = require('../services/pokeapi');
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

function toDisplayPokemonName(name) {
  return String(name || '')
    .split('-')
    .map((chunk) => chunk[0]?.toUpperCase() + chunk.slice(1))
    .join('-');
}

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
    const gameFilterKey = String(req.query.gameFilterKey || 'all');

    const data = await listPokemon({ search, limit, offset, gameFilterKey });
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
    const gameFilterKey = String(req.query.gameFilterKey || 'all');

    const data = await listDefensiveCandidates({
      weakTypes,
      excludeIds,
      limit,
      scanLimit,
      gameFilterKey,
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
    const teamSizeTarget = Number(req.body?.teamSizeTarget || 6);
    const generationFilter = req.body?.generationFilter || {};
    const gameFilterKey = String(generationFilter?.gameFilterKey || 'all');
    const gameFilterEnabled = gameFilterKey !== 'all' && Boolean(generationFilter?.enabled ?? true);

    if (team.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }

    const teamSignature = team
      .map((pokemon) => Number(pokemon?.id))
      .filter((id) => Number.isFinite(id))
      .sort((left, right) => left - right)
      .join(',');
    const filterSignature = gameFilterEnabled ? `filter=${gameFilterKey}` : 'filter=all';
    const cacheKey = `${teamSignature}|${filterSignature}|size=${teamSizeTarget}|k=${topK}|limit=${candidateLimit}|scan=${scanLimit}`;

    const cachedResponse = readRouteCache(defensiveSwapsCache, cacheKey);
    if (cachedResponse) {
      res.status(200).json({ data: cachedResponse });
      return;
    }

    const weakTypes = getPriorityWeakTypes(team);
    const excludeIds = team
      .map((pokemon) => Number(pokemon?.id))
      .filter((id) => Number.isFinite(id));

    if (gameFilterEnabled) {
      const teamAvailabilityResults = await Promise.all(
        team.map(async (pokemon) => {
          const pokemonId = Number(pokemon?.id || 0);
          const pokemonName = String(pokemon?.name || 'Unknown Pokemon');

          if (!Number.isFinite(pokemonId) || pokemonId <= 0) {
            return {
              isAvailable: false,
              name: pokemonName,
            };
          }

          const isAvailable = await isPokemonAvailableInGameFilter(pokemonId, gameFilterKey);
          return {
            isAvailable,
            name: pokemonName,
          };
        }),
      );

      const unavailableEntries = teamAvailabilityResults.filter((entry) => !entry.isAvailable);

      if (unavailableEntries.length > 0) {
        const names = unavailableEntries
          .map((entry) => toDisplayPokemonName(entry.name))
          .filter(Boolean)
          .join(', ');
        const message = names
          ? `Current team has Pokemon not available in the selected game filter: ${names}. Update your team or change the game filter.`
          : 'Current team contains Pokemon not available in the selected game filter. Update your team or change the game filter.';

        const error = new Error(message);
        error.statusCode = 400;
        throw error;
      }
    }

    const candidatePool = await listDefensiveCandidates({
      weakTypes,
      excludeIds,
      limit: candidateLimit,
      scanLimit,
      gameFilterKey: gameFilterEnabled ? gameFilterKey : 'all',
    });

    const data = recommendDefensiveSwaps(team, candidatePool, {
      topK,
      maxCandidates: candidateLimit,
      teamSizeTarget,
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

pokemonRouter.get('/moves/:moveName', async (req, res, next) => {
  try {
    const moveName = String(req.params.moveName || '').trim();
    const data = await getMoveDetail(moveName);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

pokemonRouter.get('/:nameOrId/team-detail', async (req, res, next) => {
  try {
    const gameFilterKey = String(req.query.gameFilterKey || 'all');
    const includeMoveDetails = String(req.query.includeMoveDetails || 'true').toLowerCase() !== 'false';
    const data = await getPokemonTeamDetail(req.params.nameOrId, {
      gameFilterKey,
      includeMoveDetails,
    });
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
