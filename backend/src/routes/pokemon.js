const express = require('express');
const { listPokemon, getPokemonByNameOrId, listDefensiveCandidates } = require('../services/pokeapi');
const { getPriorityWeakTypes, recommendDefensiveSwaps } = require('../services/defensiveRecommendations');

const pokemonRouter = express.Router();

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
