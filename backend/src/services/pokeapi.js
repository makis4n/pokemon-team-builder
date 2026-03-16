const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';
const LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFENSIVE_CANDIDATE_CACHE_TTL_MS = 5 * 60 * 1000;
const SPECIES_CACHE_TTL_MS = 30 * 60 * 1000;
const EVOLUTION_CHAIN_CACHE_TTL_MS = 30 * 60 * 1000;
const GENERATION_SUMMARY_CACHE_TTL_MS = 30 * 60 * 1000;
const TEAM_DETAIL_CACHE_TTL_MS = 15 * 60 * 1000;
const MOVE_DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;
const ABILITY_DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_SCAN_LIMIT = 240;
const DETAIL_BATCH_SIZE = 16;

const listCache = new Map();
const detailCache = new Map();
const defensiveCandidateCache = new Map();
const speciesCache = new Map();
const evolutionChainCache = new Map();
const generationSummaryCache = new Map();
const teamDetailCache = new Map();
const moveTypeCache = new Map();
const abilityDetailCache = new Map();
const inFlightPokeApiRequests = new Map();

const GAME_FILTER_VERSION_GROUPS = {
  all: null,
  'gen1-rby-yellow': new Set(['red-blue', 'yellow']),
  'gen2-gsc': new Set(['gold-silver', 'crystal']),
  'gen3-rse-frlg': new Set(['ruby-sapphire', 'emerald', 'firered-leafgreen']),
  'gen4-dppt-hgss': new Set(['diamond-pearl', 'platinum', 'heartgold-soulsilver']),
  'gen5-bw-b2w2': new Set(['black-white', 'black-2-white-2']),
  'gen6-xy-oras': new Set(['x-y', 'omega-ruby-alpha-sapphire']),
  'gen7-sm-usum-lgpe': new Set(['sun-moon', 'ultra-sun-ultra-moon', 'lets-go-pikachu-lets-go-eevee']),
  'gen8-swsh-bdsp-la': new Set(['sword-shield', 'brilliant-diamond-and-shining-pearl', 'legends-arceus']),
  'gen9-sv': new Set(['scarlet-violet']),
};

const GAME_FILTER_VERSIONS = {
  all: null,
  'gen1-rby-yellow': new Set(['red', 'blue', 'yellow']),
  'gen2-gsc': new Set(['gold', 'silver', 'crystal']),
  'gen3-rse-frlg': new Set(['ruby', 'sapphire', 'emerald', 'firered', 'leafgreen']),
  'gen4-dppt-hgss': new Set(['diamond', 'pearl', 'platinum', 'heartgold', 'soulsilver']),
  'gen5-bw-b2w2': new Set(['black', 'white', 'black-2', 'white-2']),
  'gen6-xy-oras': new Set(['x', 'y', 'omega-ruby', 'alpha-sapphire']),
  'gen7-sm-usum-lgpe': new Set(['sun', 'moon', 'ultra-sun', 'ultra-moon', 'lets-go-pikachu', 'lets-go-eevee']),
  'gen8-swsh-bdsp-la': new Set(['sword', 'shield', 'brilliant-diamond', 'shining-pearl', 'legends-arceus']),
  'gen9-sv': new Set(['scarlet', 'violet']),
};

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

function toDisplayName(value) {
  return String(value || '')
    .split('-')
    .map((chunk) => (chunk ? chunk[0].toUpperCase() + chunk.slice(1) : chunk))
    .join(' ');
}

function getGameFilterScope(gameFilterKey) {
  const key = GAME_FILTER_VERSION_GROUPS[gameFilterKey] ? gameFilterKey : 'all';
  return {
    versionGroups: GAME_FILTER_VERSION_GROUPS[key],
    versions: GAME_FILTER_VERSIONS[key],
  };
}

function getPokedexDescription(speciesPayload) {
  const englishEntry = (speciesPayload?.flavor_text_entries || []).find(
    (entry) => entry?.language?.name === 'en' && entry?.flavor_text,
  );

  if (!englishEntry?.flavor_text) {
    return null;
  }

  return String(englishEntry.flavor_text)
    .replace(/\f/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatEvolutionCondition(detail) {
  if (!detail) {
    return 'Unknown condition';
  }

  const fragments = [];
  const trigger = detail.trigger?.name;

  if (trigger === 'level-up') {
    if (detail.min_level) {
      fragments.push(`Level ${detail.min_level}+`);
    } else {
      fragments.push('Level up');
    }
  } else if (trigger === 'use-item' && detail.item?.name) {
    fragments.push(`Use ${toDisplayName(detail.item.name)}`);
  } else if (trigger === 'trade') {
    if (detail.trade_species?.name) {
      fragments.push(`Trade for ${toDisplayName(detail.trade_species.name)}`);
    } else {
      fragments.push('Trade');
    }
  } else if (trigger) {
    fragments.push(toDisplayName(trigger));
  }

  if (detail.time_of_day) {
    fragments.push(`(${detail.time_of_day})`);
  }
  if (detail.held_item?.name) {
    fragments.push(`holding ${toDisplayName(detail.held_item.name)}`);
  }
  if (detail.known_move?.name) {
    fragments.push(`knows ${toDisplayName(detail.known_move.name)}`);
  }
  if (detail.location?.name) {
    fragments.push(`at ${toDisplayName(detail.location.name)}`);
  }
  if (detail.min_happiness) {
    fragments.push(`happiness ${detail.min_happiness}+`);
  }
  if (detail.min_affection) {
    fragments.push(`affection ${detail.min_affection}+`);
  }
  if (detail.min_beauty) {
    fragments.push(`beauty ${detail.min_beauty}+`);
  }

  if (!fragments.length) {
    return 'Unknown condition';
  }

  return fragments.join(' ');
}

function buildEvolutionEntries(chainNode, targetSpeciesId, parentNode = null, collector = { from: null, to: [] }) {
  if (!chainNode) {
    return collector;
  }

  const currentSpeciesId = extractIdFromUrl(chainNode.species?.url);
  if (currentSpeciesId === targetSpeciesId) {
    if (parentNode) {
      const fromDetail = (chainNode.evolution_details || [])[0] || null;
      collector.from = {
        speciesId: extractIdFromUrl(parentNode.species?.url),
        speciesName: toDisplayName(parentNode.species?.name),
        condition: formatEvolutionCondition(fromDetail),
      };
    }

    collector.to = (chainNode.evolves_to || []).map((childNode) => ({
      speciesId: extractIdFromUrl(childNode.species?.url),
      speciesName: toDisplayName(childNode.species?.name),
      condition: formatEvolutionCondition((childNode.evolution_details || [])[0] || null),
    }));

    return collector;
  }

  for (const childNode of chainNode.evolves_to || []) {
    buildEvolutionEntries(childNode, targetSpeciesId, chainNode, collector);
    if (collector.from || collector.to.length > 0) {
      return collector;
    }
  }

  return collector;
}

function getMoveEffectText(movePayload) {
  const englishEntry = (movePayload?.effect_entries || []).find(
    (entry) => entry?.language?.name === 'en',
  );

  const rawEffectText = englishEntry?.short_effect || englishEntry?.effect || null;
  if (!rawEffectText) {
    return null;
  }

  const effectChance = movePayload?.effect_chance;
  return String(rawEffectText)
    .replace(/\$effect_chance/g, effectChance == null ? '' : String(effectChance))
    .replace(/\s+/g, ' ')
    .trim();
}

function getMoveFlavorText(movePayload) {
  const englishEntry = (movePayload?.flavor_text_entries || []).find(
    (entry) => entry?.language?.name === 'en' && entry?.flavor_text,
  );

  if (!englishEntry?.flavor_text) {
    return null;
  }

  return String(englishEntry.flavor_text)
    .replace(/\f/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAbilityEffectText(abilityPayload) {
  const englishEntry = (abilityPayload?.effect_entries || []).find(
    (entry) => entry?.language?.name === 'en' && entry?.short_effect,
  ) || (abilityPayload?.effect_entries || []).find(
    (entry) => entry?.language?.name === 'en' && entry?.effect,
  );

  const rawEffect = englishEntry?.short_effect || englishEntry?.effect || null;
  if (!rawEffect) {
    return null;
  }

  return String(rawEffect)
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getAbilityDetail(abilityName) {
  if (!abilityName) {
    return {
      name: null,
      effectText: null,
    };
  }

  const cacheKey = String(abilityName).toLowerCase();
  const cachedDetail = readCache(abilityDetailCache, cacheKey);
  if (cachedDetail) {
    return cachedDetail;
  }

  try {
    const abilityPayload = await fetchFromPokeApi(`/ability/${encodeURIComponent(cacheKey)}`);
    const abilityDetail = {
      name: abilityPayload?.name || cacheKey,
      effectText: getAbilityEffectText(abilityPayload),
    };

    writeCache(abilityDetailCache, cacheKey, abilityDetail, ABILITY_DETAIL_CACHE_TTL_MS);
    return abilityDetail;
  } catch {
    return {
      name: cacheKey,
      effectText: null,
    };
  }
}

async function getMoveDetail(moveName) {
  if (!moveName) {
    return {
      moveType: null,
      category: null,
      basePower: null,
      accuracy: null,
      pp: null,
      effectText: null,
      flavorText: null,
    };
  }

  const cacheKey = String(moveName).toLowerCase();
  const cachedDetail = readCache(moveTypeCache, cacheKey);
  if (cachedDetail) {
    return cachedDetail;
  }

  try {
    const movePayload = await fetchFromPokeApi(`/move/${encodeURIComponent(cacheKey)}`);
    const moveDetail = {
      moveType: movePayload?.type?.name || null,
      category: toDisplayName(movePayload?.damage_class?.name || ''),
      basePower: Number.isFinite(movePayload?.power) ? movePayload.power : null,
      accuracy: Number.isFinite(movePayload?.accuracy) ? movePayload.accuracy : null,
      pp: Number.isFinite(movePayload?.pp) ? movePayload.pp : null,
      effectText: getMoveEffectText(movePayload),
      flavorText: getMoveFlavorText(movePayload),
    };

    if (moveDetail.moveType || moveDetail.effectText || moveDetail.flavorText) {
      writeCache(moveTypeCache, cacheKey, moveDetail, MOVE_DETAIL_CACHE_TTL_MS);
    }

    return moveDetail;
  } catch {
    return {
      moveType: null,
      category: null,
      basePower: null,
      accuracy: null,
      pp: null,
      effectText: null,
      flavorText: null,
    };
  }
}

async function buildLevelUpMoves(pokemonPayload, versionGroupScope) {
  const bestByMove = new Map();

  for (const moveEntry of pokemonPayload?.moves || []) {
    const moveRawName = moveEntry.move?.name;
    const moveName = toDisplayName(moveRawName);
    if (!moveName) {
      continue;
    }

    for (const detail of moveEntry.version_group_details || []) {
      if (detail.move_learn_method?.name !== 'level-up') {
        continue;
      }

      const versionGroupName = detail.version_group?.name;
      if (versionGroupScope && !versionGroupScope.has(versionGroupName)) {
        continue;
      }

      const level = Number(detail.level_learned_at || 0);
      const existing = bestByMove.get(moveName);

      if (!existing || level < existing.level) {
        bestByMove.set(moveName, {
          moveRawName,
          moveName,
          level,
          versionGroupName: toDisplayName(versionGroupName),
        });
      }
    }
  }

  const moveEntries = Array.from(bestByMove.values());
  const moveDetailLookups = await Promise.allSettled(
    moveEntries.map((entry) => getMoveDetail(entry.moveRawName)),
  );

  const withTypes = moveEntries.map((entry, index) => {
    const lookup = moveDetailLookups[index];
    const moveDetail = lookup?.status === 'fulfilled'
      ? lookup.value
      : {
        moveType: null,
        category: null,
        basePower: null,
        accuracy: null,
        pp: null,
        effectText: null,
        flavorText: null,
      };

    return {
      moveName: entry.moveName,
      level: entry.level,
      versionGroupName: entry.versionGroupName,
      moveType: moveDetail.moveType,
      category: moveDetail.category,
      basePower: moveDetail.basePower,
      accuracy: moveDetail.accuracy,
      pp: moveDetail.pp,
      flavorText: moveDetail.flavorText,
      effectText: moveDetail.effectText,
    };
  });

  return withTypes
    .sort((left, right) => {
      if (left.level !== right.level) {
        return left.level - right.level;
      }
      return left.moveName.localeCompare(right.moveName);
    });
}

function buildEncounterLocations(encountersPayload, versionScope) {
  const byLocation = new Map();

  for (const encounterEntry of encountersPayload || []) {
    const locationName = toDisplayName(encounterEntry.location_area?.name);
    if (!locationName) {
      continue;
    }

    const versionDetails = (encounterEntry.version_details || []).filter((entry) => {
      if (!versionScope) {
        return true;
      }
      return versionScope.has(entry.version?.name);
    });

    if (!versionDetails.length) {
      continue;
    }

    const methods = new Set();
    const versions = new Set();

    for (const versionDetail of versionDetails) {
      versions.add(toDisplayName(versionDetail.version?.name));

      for (const encounterDetail of versionDetail.encounter_details || []) {
        methods.add(toDisplayName(encounterDetail.method?.name));
      }
    }

    const existing = byLocation.get(locationName) || {
      locationName,
      methods: new Set(),
      versions: new Set(),
    };

    for (const method of methods) {
      existing.methods.add(method);
    }
    for (const version of versions) {
      existing.versions.add(version);
    }

    byLocation.set(locationName, existing);
  }

  return Array.from(byLocation.values())
    .map((entry) => ({
      locationName: entry.locationName,
      methods: Array.from(entry.methods).sort((a, b) => a.localeCompare(b)),
      versions: Array.from(entry.versions).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((left, right) => left.locationName.localeCompare(right.locationName));
}

async function getPokemonTeamDetail(nameOrId, options = {}) {
  const gameFilterKey = options.gameFilterKey || 'all';
  const cacheKey = `${String(nameOrId).toLowerCase()}|detail|${gameFilterKey}`;
  const cached = readCache(teamDetailCache, cacheKey);

  if (cached) {
    return cached;
  }

  const pokemonDetail = await getPokemonByNameOrId(nameOrId);
  const species = pokemonDetail.speciesId ? await getSpeciesData(pokemonDetail.speciesId) : null;
  const evolutionLineId = extractIdFromUrl(species?.evolution_chain?.url);

  const scope = getGameFilterScope(gameFilterKey);
  const [pokemonPayload, encountersPayload, chainPayload] = await Promise.all([
    fetchFromPokeApi(`/pokemon/${encodeURIComponent(pokemonDetail.id)}`),
    fetchFromPokeApi(`/pokemon/${encodeURIComponent(pokemonDetail.id)}/encounters`),
    evolutionLineId
      ? fetchFromPokeApi(`/evolution-chain/${encodeURIComponent(evolutionLineId)}`)
      : Promise.resolve(null),
  ]);

  const evolutionEntries = buildEvolutionEntries(chainPayload?.chain, pokemonDetail.speciesId);
  const abilityDetailResults = await Promise.allSettled(
    (pokemonDetail.abilities || []).map((abilityName) => getAbilityDetail(abilityName)),
  );

  const abilityEffectsByName = {};
  for (let index = 0; index < abilityDetailResults.length; index += 1) {
    const result = abilityDetailResults[index];
    const fallbackName = pokemonDetail.abilities?.[index];

    if (result?.status === 'fulfilled' && result.value?.name) {
      abilityEffectsByName[result.value.name] = result.value.effectText;
    } else if (fallbackName) {
      abilityEffectsByName[fallbackName] = null;
    }
  }

  const payload = {
    pokemon: pokemonDetail,
    pokedexDescription: getPokedexDescription(species),
    abilityEffectsByName,
    evolution: {
      from: evolutionEntries.from,
      to: evolutionEntries.to,
    },
    levelUpMoves: await buildLevelUpMoves(pokemonPayload, scope.versionGroups),
    encounters: buildEncounterLocations(encountersPayload, scope.versions),
  };

  writeCache(teamDetailCache, cacheKey, payload, TEAM_DETAIL_CACHE_TTL_MS);
  return payload;
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
  getPokemonTeamDetail,
  listDefensiveCandidates,
  TYPE_CHART,
};
