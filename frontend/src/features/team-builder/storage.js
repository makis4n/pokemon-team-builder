import {
  DEFAULT_GAME_FILTER_KEY,
  GAME_FILTER_OPTION_BY_KEY,
  GAME_FILTER_STORAGE_KEY,
  SWAP_RECOMMENDATIONS_STORAGE_KEY,
  TEAM_STORAGE_KEY,
} from './constants'

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

export function getSelectedGameFilterFromSession() {
  try {
    const rawValue = sessionStorage.getItem(GAME_FILTER_STORAGE_KEY)
    if (!rawValue) {
      return DEFAULT_GAME_FILTER_KEY
    }

    const normalized = String(rawValue)
    return GAME_FILTER_OPTION_BY_KEY[normalized] ? normalized : DEFAULT_GAME_FILTER_KEY
  } catch {
    return DEFAULT_GAME_FILTER_KEY
  }
}

export function saveSelectedGameFilterToSession(gameFilterKey) {
  const normalized = String(gameFilterKey)
  if (!GAME_FILTER_OPTION_BY_KEY[normalized]) {
    sessionStorage.setItem(GAME_FILTER_STORAGE_KEY, DEFAULT_GAME_FILTER_KEY)
    return
  }

  sessionStorage.setItem(GAME_FILTER_STORAGE_KEY, normalized)
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
