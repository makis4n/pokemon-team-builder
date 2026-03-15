const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';

async function fetchFromPokeApi(path) {
  const response = await fetch(`${POKEAPI_BASE_URL}${path}`);

  if (!response.ok) {
    const error = new Error(`PokeAPI request failed with status ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return response.json();
}

function normalizePokemonSummary(pokemonResult) {
  const idFromUrl = pokemonResult.url
    ? Number(pokemonResult.url.split('/').filter(Boolean).pop())
    : null;

  return {
    id: idFromUrl,
    name: pokemonResult.name,
  };
}

function normalizePokemonDetail(pokemon) {
  return {
    id: pokemon.id,
    name: pokemon.name,
    types: pokemon.types
      .map((entry) => entry.type.name)
      .sort((a, b) => a.localeCompare(b)),
    stats: pokemon.stats.map((entry) => ({
      name: entry.stat.name,
      baseStat: entry.base_stat,
    })),
    abilities: pokemon.abilities.map((entry) => entry.ability.name),
    sprite: pokemon.sprites.front_default,
  };
}

async function listPokemon({ search, limit = 20, offset = 0 }) {
  if (search) {
    const pokemon = await fetchFromPokeApi(`/pokemon/${encodeURIComponent(search.toLowerCase())}`);
    return [normalizePokemonDetail(pokemon)];
  }

  const listResponse = await fetchFromPokeApi(`/pokemon?limit=${limit}&offset=${offset}`);
  return listResponse.results.map(normalizePokemonSummary);
}

async function getPokemonByNameOrId(nameOrId) {
  const pokemon = await fetchFromPokeApi(`/pokemon/${encodeURIComponent(String(nameOrId).toLowerCase())}`);
  return normalizePokemonDetail(pokemon);
}

module.exports = {
  listPokemon,
  getPokemonByNameOrId,
};
