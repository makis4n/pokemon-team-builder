const API_RESPONSE_CACHE_KEY = 'pokemon-team-builder:api-response-cache:v1'
const API_RESPONSE_CACHE_TTL_MS = 10 * 60 * 1000

const inMemoryApiCache = new Map()

function readCacheEntry(cacheKey) {
  const inMemoryEntry = inMemoryApiCache.get(cacheKey)
  if (inMemoryEntry && Date.now() <= inMemoryEntry.expiresAt) {
    return inMemoryEntry.payload
  }

  try {
    const raw = sessionStorage.getItem(API_RESPONSE_CACHE_KEY)
    if (!raw) {
      return null
    }

    const envelope = JSON.parse(raw)
    const entry = envelope?.[cacheKey]
    if (!entry) {
      return null
    }

    if (Date.now() > (entry.expiresAt ?? 0)) {
      delete envelope[cacheKey]
      sessionStorage.setItem(API_RESPONSE_CACHE_KEY, JSON.stringify(envelope))
      return null
    }

    inMemoryApiCache.set(cacheKey, entry)
    return entry.payload ?? null
  } catch {
    return null
  }
}

function writeCacheEntry(cacheKey, payload, ttlMs) {
  const entry = {
    payload,
    expiresAt: Date.now() + ttlMs,
  }

  inMemoryApiCache.set(cacheKey, entry)

  try {
    const raw = sessionStorage.getItem(API_RESPONSE_CACHE_KEY)
    const envelope = raw ? JSON.parse(raw) : {}
    envelope[cacheKey] = entry
    sessionStorage.setItem(API_RESPONSE_CACHE_KEY, JSON.stringify(envelope))
  } catch {
    // Ignore storage failures and keep the in-memory cache.
  }
}

function buildRequestCacheKey(url, options = {}, explicitCacheKey = '') {
  if (explicitCacheKey) {
    return explicitCacheKey
  }

  const method = (options.method ?? 'GET').toUpperCase()
  const body = options.body ?? ''
  return `${method}:${url}:${body}`
}

export async function fetchJson(url, options = {}, cacheConfig = {}) {
  const method = (options.method ?? 'GET').toUpperCase()
  const shouldCache = cacheConfig.enabled ?? method === 'GET'
  const cacheTtlMs = cacheConfig.ttlMs ?? API_RESPONSE_CACHE_TTL_MS
  const cacheKey = shouldCache
    ? buildRequestCacheKey(url, options, cacheConfig.cacheKey)
    : ''

  if (shouldCache) {
    const cachedPayload = readCacheEntry(cacheKey)
    if (cachedPayload) {
      return cachedPayload
    }
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const fallbackMessage = `Request failed with status ${response.status}`
    let message = fallbackMessage

    try {
      const payload = await response.json()
      if (payload?.error?.message) {
        message = payload.error.message
      }
    } catch {
      message = fallbackMessage
    }

    throw new Error(message)
  }

  const payload = await response.json()

  if (shouldCache) {
    writeCacheEntry(cacheKey, payload, cacheTtlMs)
  }

  return payload
}

export function fetchPokemonList(limit = 1025, offset = 0, generationNumber = null) {
  const generationPart = generationNumber ? `&generation=${generationNumber}` : ''
  return fetchJson(`/api/pokemon?limit=${limit}&offset=${offset}${generationPart}`)
}

export function fetchPokemonDetail(nameOrId) {
  return fetchJson(`/api/pokemon/${encodeURIComponent(nameOrId)}`)
}

export function fetchDefensiveSwapRecommendations({
  team,
  teamSizeTarget = 6,
  topK = 5,
  candidateLimit = 90,
  scanLimit = 240,
  generationFilter = {},
}) {
  const filterGenerationNumber = Number(generationFilter?.generationNumber) || 0
  const filterEnabled = Boolean(generationFilter?.enabled) && filterGenerationNumber > 0
  const cacheKey = [
    'defensive-swaps',
    ...team
      .map((pokemon) => pokemon?.id)
      .filter(Boolean)
      .sort((left, right) => left - right),
    `size${teamSizeTarget}`,
    filterEnabled ? `g${filterGenerationNumber}` : 'all-gen',
    topK,
    candidateLimit,
    scanLimit,
  ].join(':')

  return fetchJson('/api/pokemon/defensive-swaps', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      team,
      teamSizeTarget,
      topK,
      candidateLimit,
      scanLimit,
      generationFilter: {
        enabled: filterEnabled,
        generationNumber: filterEnabled ? filterGenerationNumber : null,
        gameFilterKey: generationFilter?.gameFilterKey ?? '',
        gameFilterLabel: generationFilter?.gameFilterLabel ?? '',
      },
    }),
  }, {
    enabled: true,
    cacheKey,
  })
}

export function fetchTeamDefenseAnalysis(team) {
  const cacheKey = [
    'team-defense-analysis',
    ...team
      .map((pokemon) => pokemon?.id)
      .filter(Boolean)
      .sort((left, right) => left - right),
  ].join(':')

  return fetchJson('/api/pokemon/team-defense-analysis', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ team }),
  }, {
    enabled: true,
    cacheKey,
  })
}
