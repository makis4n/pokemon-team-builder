const express = require('express');
const { listPokemon, getPokemonByNameOrId } = require('../services/pokeapi');

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

pokemonRouter.get('/:nameOrId', async (req, res, next) => {
  try {
    const pokemon = await getPokemonByNameOrId(req.params.nameOrId);
    res.status(200).json({ data: pokemon });
  } catch (error) {
    next(error);
  }
});

module.exports = pokemonRouter;
