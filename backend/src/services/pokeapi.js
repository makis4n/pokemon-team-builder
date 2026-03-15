const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';
const LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_SCAN_LIMIT = 240;
const DETAIL_BATCH_SIZE = 16;

const listCache = new Map();
const detailCache = new Map();

async function fetchFromPokeApi(path) {
  const response = await fetch(`${POKEAPI_BASE_URL}${path}`);

  if (!response.ok) {
    const error = new Error(`PokeAPI request failed with status ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return response.json();
}

function readCache(cache, key) {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function writeCache(cache, key, value, ttlMs) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
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

  const cacheKey = `${limit}:${offset}`;
  const cachedList = readCache(listCache, cacheKey);
  if (cachedList) {
    return cachedList;
  }

  const listResponse = await fetchFromPokeApi(`/pokemon?limit=${limit}&offset=${offset}`);
  const normalized = listResponse.results.map(normalizePokemonSummary);
  writeCache(listCache, cacheKey, normalized, LIST_CACHE_TTL_MS);
  return normalized;
}

async function getPokemonByNameOrId(nameOrId) {
  const key = String(nameOrId).toLowerCase();
  const cachedDetail = readCache(detailCache, key);
  if (cachedDetail) {
    return cachedDetail;
  }

  const pokemon = await fetchFromPokeApi(`/pokemon/${encodeURIComponent(key)}`);
  const normalized = normalizePokemonDetail(pokemon);
  writeCache(detailCache, key, normalized, DETAIL_CACHE_TTL_MS);
  writeCache(detailCache, String(normalized.id), normalized, DETAIL_CACHE_TTL_MS);
  return normalized;
}

function getDefensiveMultiplier(attackingType, defendingTypes) {
  let multiplier = 1;
  const attackChart = TYPE_CHART[attackingType] || {};

  for (const defendingType of defendingTypes) {
    multiplier *= attackChart[defendingType] ?? 1;
  }

  return multiplier;
}

function getDefensiveFitScore(candidate, weakTypes) {
  if (!weakTypes.length || !candidate?.types?.length) {
    return 0;
  }

  let score = 0;

  for (let index = 0; index < weakTypes.length; index += 1) {
    const attackingType = weakTypes[index];
    const weight = weakTypes.length - index;
    const multiplier = getDefensiveMultiplier(attackingType, candidate.types);

    if (multiplier === 0) {
      score += 3 * weight;
    } else if (multiplier <= 0.25) {
      score += 2.5 * weight;
    } else if (multiplier <= 0.5) {
      score += 2 * weight;
    } else if (multiplier >= 4) {
      score -= 3 * weight;
    } else if (multiplier > 1) {
      score -= 1.5 * weight;
    }
  }

  return score;
}

const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
    steel: 0.5,
  },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
    dark: 2,
    steel: 2,
    fairy: 0.5,
  },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
    dark: 2,
    steel: 0.5,
    fairy: 0.5,
  },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

async function listDefensiveCandidates({ weakTypes = [], excludeIds = [], limit = 90, scanLimit = DEFAULT_SCAN_LIMIT }) {
  const cappedScanLimit = Math.min(Math.max(Number(scanLimit) || DEFAULT_SCAN_LIMIT, 40), 400);
  const cappedLimit = Math.min(Math.max(Number(limit) || 90, 1), 120);
  const idsToExclude = new Set((excludeIds || []).map((value) => Number(value)).filter(Boolean));

  const summaries = await listPokemon({ limit: cappedScanLimit, offset: 0 });
  const candidateIds = summaries
    .map((summary) => summary?.id)
    .filter((id) => id && !idsToExclude.has(id));

  const candidates = [];

  for (let index = 0; index < candidateIds.length; index += DETAIL_BATCH_SIZE) {
    const batchIds = candidateIds.slice(index, index + DETAIL_BATCH_SIZE);
    const batchDetails = await Promise.allSettled(batchIds.map((pokemonId) => getPokemonByNameOrId(pokemonId)));

    for (const result of batchDetails) {
      if (result.status !== 'fulfilled') {
        continue;
      }

      const detail = result.value;
      const defensiveFitScore = getDefensiveFitScore(detail, weakTypes);
      candidates.push({
        ...detail,
        defensiveFitScore,
      });
    }
  }

  return candidates
    .sort((left, right) => {
      if (left.defensiveFitScore !== right.defensiveFitScore) {
        return right.defensiveFitScore - left.defensiveFitScore;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, cappedLimit);
}

module.exports = {
  listPokemon,
  getPokemonByNameOrId,
  listDefensiveCandidates,
  TYPE_CHART,
};
