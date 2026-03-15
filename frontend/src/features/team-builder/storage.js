import {
  RECOMMENDATION_CACHE_STORAGE_KEY,
  SWAP_RECOMMENDATIONS_STORAGE_KEY,
  TEAM_STORAGE_KEY,
} from './constants'

const RECOMMENDATION_CACHE_TTL_MS = 20 * 60 * 1000
const SWAP_RECOMMENDATIONS_TTL_MS = 10 * 60 * 1000

export function getSafeTeamFromSession() {
  try {
    const rawValue = sessionStorage.getItem(TEAM_STORAGE_KEY)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue)
    return Array.isArray(parsedValue) ? parsedValue : []
  } catch {
    return []
  }
}

export function saveTeamToSession(team) {
  sessionStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(team))
}

function getCacheEnvelope() {
  try {
    const rawValue = sessionStorage.getItem(RECOMMENDATION_CACHE_STORAGE_KEY)
    if (!rawValue) {
      return {}
    }

    const parsed = JSON.parse(rawValue)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function setCacheEnvelope(envelope) {
  sessionStorage.setItem(RECOMMENDATION_CACHE_STORAGE_KEY, JSON.stringify(envelope))
}

function getNamedCacheEnvelope(storageKey) {
  try {
    const rawValue = sessionStorage.getItem(storageKey)
    if (!rawValue) {
      return {}
    }

    const parsed = JSON.parse(rawValue)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function setNamedCacheEnvelope(storageKey, envelope) {
  sessionStorage.setItem(storageKey, JSON.stringify(envelope))
}

export function getRecommendationCandidatesFromSession(cacheKey) {
  const envelope = getCacheEnvelope()
  const record = envelope[cacheKey]

  if (!record || typeof record !== 'object') {
    return []
  }

  if (Date.now() > (record.expiresAt ?? 0)) {
    delete envelope[cacheKey]
    setCacheEnvelope(envelope)
    return []
  }

  return Array.isArray(record.candidates) ? record.candidates : []
}

export function saveRecommendationCandidatesToSession(cacheKey, candidates) {
  const envelope = getCacheEnvelope()
  envelope[cacheKey] = {
    candidates,
    expiresAt: Date.now() + RECOMMENDATION_CACHE_TTL_MS,
  }

  setCacheEnvelope(envelope)
}

export function getSwapRecommendationsFromSession(cacheKey) {
  const envelope = getNamedCacheEnvelope(SWAP_RECOMMENDATIONS_STORAGE_KEY)
  const record = envelope[cacheKey]

  if (!record || typeof record !== 'object') {
    return []
  }

  if (Date.now() > (record.expiresAt ?? 0)) {
    delete envelope[cacheKey]
    setNamedCacheEnvelope(SWAP_RECOMMENDATIONS_STORAGE_KEY, envelope)
    return []
  }

  return Array.isArray(record.recommendations) ? record.recommendations : []
}

export function saveSwapRecommendationsToSession(cacheKey, recommendations) {
  const envelope = getNamedCacheEnvelope(SWAP_RECOMMENDATIONS_STORAGE_KEY)
  envelope[cacheKey] = {
    recommendations,
    expiresAt: Date.now() + SWAP_RECOMMENDATIONS_TTL_MS,
  }

  setNamedCacheEnvelope(SWAP_RECOMMENDATIONS_STORAGE_KEY, envelope)
}
