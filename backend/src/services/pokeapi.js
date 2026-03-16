const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';
const LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFENSIVE_CANDIDATE_CACHE_TTL_MS = 5 * 60 * 1000;
const SPECIES_CACHE_TTL_MS = 30 * 60 * 1000;
const EVOLUTION_CHAIN_CACHE_TTL_MS = 30 * 60 * 1000;
const GENERATION_SUMMARY_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_SCAN_LIMIT = 240;
const DETAIL_BATCH_SIZE = 16;

const listCache = new Map();
const detailCache = new Map();
const defensiveCandidateCache = new Map();
const speciesCache = new Map();
const evolutionChainCache = new Map();
const generationSummaryCache = new Map();
const inFlightPokeApiRequests = new Map();

async function fetchFromPokeApi(path) {
  const inFlightRequest = inFlightPokeApiRequests.get(path);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const requestPromise = (async () => {
    const response = await fetch(`${POKEAPI_BASE_URL}${path}`);

    if (!response.ok) {
      const error = new Error(`PokeAPI request failed with status ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }

    return response.json();
  })();

  inFlightPokeApiRequests.set(path, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightPokeApiRequests.delete(path);
  }
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
  const speciesId = extractIdFromUrl(pokemon.species?.url);

  return {
    id: pokemon.id,
    name: pokemon.name,
    speciesId,
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

function extractIdFromUrl(url) {
  if (!url) {
    return null;
  }

  const match = String(url).match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

function walkEvolutionChain(node, stage, stageBySpeciesId) {
  if (!node) {
    return;
  }

  const speciesId = extractIdFromUrl(node.species?.url);
  if (speciesId) {
    const currentStage = stageBySpeciesId.get(speciesId);
    if (!currentStage || stage > currentStage) {
      stageBySpeciesId.set(speciesId, stage);
    }
  }

  for (const child of node.evolves_to || []) {
    walkEvolutionChain(child, stage + 1, stageBySpeciesId);
  }
}

async function getSpeciesData(speciesId) {
  const cacheKey = String(speciesId);
  const cachedSpecies = readCache(speciesCache, cacheKey);
  if (cachedSpecies) {
    return cachedSpecies;
  }

  const species = await fetchFromPokeApi(`/pokemon-species/${encodeURIComponent(speciesId)}`);
  writeCache(speciesCache, cacheKey, species, SPECIES_CACHE_TTL_MS);
  return species;
}

async function getEvolutionStagesByLineId(evolutionLineId) {
  const cacheKey = String(evolutionLineId);
  const cachedStages = readCache(evolutionChainCache, cacheKey);
  if (cachedStages) {
    return cachedStages;
  }

  const chainPayload = await fetchFromPokeApi(`/evolution-chain/${encodeURIComponent(evolutionLineId)}`);
  const stageBySpeciesId = new Map();
  walkEvolutionChain(chainPayload.chain, 1, stageBySpeciesId);

  writeCache(evolutionChainCache, cacheKey, stageBySpeciesId, EVOLUTION_CHAIN_CACHE_TTL_MS);
  return stageBySpeciesId;
}

async function getEvolutionMetaForSpecies(speciesId) {
  if (!speciesId) {
    return {
      evolutionLineId: null,
      evolutionStage: 0,
    };
  }

  const species = await getSpeciesData(speciesId);
  const evolutionLineId = extractIdFromUrl(species?.evolution_chain?.url);

  if (!evolutionLineId) {
    return {
      evolutionLineId: null,
      evolutionStage: 0,
    };
  }

  const stageBySpeciesId = await getEvolutionStagesByLineId(evolutionLineId);
  const evolutionStage = stageBySpeciesId.get(speciesId) ?? 0;

  return {
    evolutionLineId,
    evolutionStage,
  };
}

function getGenerationNumberFromSpecies(species) {
  const generationFromUrl = extractIdFromUrl(species?.generation?.url);
  if (generationFromUrl) {
    return generationFromUrl;
  }

  const generationName = String(species?.generation?.name || '');
  const match = generationName.match(/generation-(\d+)/i);
  return match ? Number(match[1]) : null;
}

async function getPokemonSummariesForGeneration(generationNumber) {
  const normalizedGenerationNumber = Number(generationNumber);
  if (!Number.isFinite(normalizedGenerationNumber) || normalizedGenerationNumber <= 0) {
    return [];
  }

  const cacheKey = String(normalizedGenerationNumber);
  const cachedGenerationList = readCache(generationSummaryCache, cacheKey);
  if (cachedGenerationList) {
    return cachedGenerationList;
  }

  const generationPayload = await fetchFromPokeApi(`/generation/${encodeURIComponent(normalizedGenerationNumber)}`);
  const normalized = (generationPayload?.pokemon_species || [])
    .map((species) => ({
      id: extractIdFromUrl(species?.url),
      name: species?.name,
    }))
    .filter((entry) => entry.id && entry.name)
    .sort((left, right) => left.id - right.id);

  writeCache(generationSummaryCache, cacheKey, normalized, GENERATION_SUMMARY_CACHE_TTL_MS);
  return normalized;
}

async function listPokemon({ search, limit = 20, offset = 0, generationNumber = null }) {
  const normalizedGenerationNumber = Number(generationNumber) || null;

  if (search) {
    const pokemon = await getPokemonByNameOrId(search.toLowerCase());

    if (normalizedGenerationNumber && pokemon.generationNumber !== normalizedGenerationNumber) {
      const error = new Error(`Pokemon not found in Generation ${normalizedGenerationNumber}`);
      error.statusCode = 404;
      throw error;
    }

    return [pokemon];
  }

  const cacheKey = `gen=${normalizedGenerationNumber || 'all'}:${limit}:${offset}`;
  const cachedList = readCache(listCache, cacheKey);
  if (cachedList) {
    return cachedList;
  }

  let normalized = [];

  if (normalizedGenerationNumber) {
    const generationSummaries = await getPokemonSummariesForGeneration(normalizedGenerationNumber);
    normalized = generationSummaries.slice(offset, offset + limit);
  } else {
    const listResponse = await fetchFromPokeApi(`/pokemon?limit=${limit}&offset=${offset}`);
    normalized = listResponse.results.map(normalizePokemonSummary);
  }

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
  const species = normalized.speciesId ? await getSpeciesData(normalized.speciesId) : null;
  const generationNumber = species ? getGenerationNumberFromSpecies(species) : null;
  const detailWithGeneration = {
    ...normalized,
    generationNumber,
  };

  writeCache(detailCache, String(normalized.id), detailWithGeneration, DETAIL_CACHE_TTL_MS);
  writeCache(detailCache, key, detailWithGeneration, DETAIL_CACHE_TTL_MS);
  return detailWithGeneration;
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

async function listDefensiveCandidates({
  weakTypes = [],
  excludeIds = [],
  limit = 90,
  scanLimit = DEFAULT_SCAN_LIMIT,
  generationNumber = null,
}) {
  const cappedScanLimit = Math.min(Math.max(Number(scanLimit) || DEFAULT_SCAN_LIMIT, 40), 400);
  const cappedLimit = Math.min(Math.max(Number(limit) || 90, 1), 120);
  const normalizedGenerationNumber = Number(generationNumber) || null;
  const sortedWeakTypes = [...(weakTypes || [])].map((type) => String(type).toLowerCase()).sort((a, b) => a.localeCompare(b));
  const sortedExcludeIds = [...(excludeIds || [])]
    .map((value) => Number(value))
    .filter(Boolean)
    .sort((left, right) => left - right);

  const cacheKey = `weak=${sortedWeakTypes.join(',')}|exclude=${sortedExcludeIds.join(',')}|limit=${cappedLimit}|scan=${cappedScanLimit}|gen=${normalizedGenerationNumber || 'all'}`;
  const cachedCandidates = readCache(defensiveCandidateCache, cacheKey);
  if (cachedCandidates) {
    return cachedCandidates;
  }

  const idsToExclude = new Set(sortedExcludeIds);

  const summaries = await listPokemon({
    limit: cappedScanLimit,
    offset: 0,
    generationNumber: normalizedGenerationNumber,
  });
  const candidateIds = summaries
    .map((summary) => summary?.id)
    .filter((id) => id && !idsToExclude.has(id));

  const candidates = [];

  for (let index = 0; index < candidateIds.length; index += DETAIL_BATCH_SIZE) {
    const batchIds = candidateIds.slice(index, index + DETAIL_BATCH_SIZE);
    const batchDetails = await Promise.allSettled(batchIds.map((pokemonId) => getPokemonByNameOrId(pokemonId)));
    const fulfilledDetails = batchDetails
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    const batchEvolutionMeta = await Promise.allSettled(
      fulfilledDetails.map((detail) => getEvolutionMetaForSpecies(detail.speciesId)),
    );

    for (let detailIndex = 0; detailIndex < fulfilledDetails.length; detailIndex += 1) {
      const detail = fulfilledDetails[detailIndex];
      const evolutionMetaResult = batchEvolutionMeta[detailIndex];
      const evolutionMeta =
        evolutionMetaResult?.status === 'fulfilled'
          ? evolutionMetaResult.value
          : { evolutionLineId: null, evolutionStage: 0 };

      const defensiveFitScore = getDefensiveFitScore(detail, sortedWeakTypes);
      candidates.push({
        ...detail,
        defensiveFitScore,
        evolutionLineId: evolutionMeta.evolutionLineId,
        evolutionStage: evolutionMeta.evolutionStage,
      });
    }
  }

  const result = candidates
    .sort((left, right) => {
      if (left.defensiveFitScore !== right.defensiveFitScore) {
        return right.defensiveFitScore - left.defensiveFitScore;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, cappedLimit);

  writeCache(defensiveCandidateCache, cacheKey, result, DEFENSIVE_CANDIDATE_CACHE_TTL_MS);
  return result;
}

module.exports = {
  listPokemon,
  getPokemonByNameOrId,
  listDefensiveCandidates,
  TYPE_CHART,
};
