export async function fetchJson(url, options = {}) {
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

  return response.json()
}

export function fetchPokemonList(limit = 1025, offset = 0) {
  return fetchJson(`/api/pokemon?limit=${limit}&offset=${offset}`)
}

export function fetchPokemonDetail(nameOrId) {
  return fetchJson(`/api/pokemon/${encodeURIComponent(nameOrId)}`)
}

export function fetchDefensiveCandidates({ weakTypes = [], excludeIds = [], limit = 90, scanLimit = 240 }) {
  const params = new URLSearchParams({
    weakTypes: weakTypes.join(','),
    excludeIds: excludeIds.join(','),
    limit: String(limit),
    scanLimit: String(scanLimit),
  })

  return fetchJson(`/api/pokemon/defensive-candidates?${params.toString()}`)
}

export function fetchDefensiveSwapRecommendations({ team, topK = 5, candidateLimit = 90, scanLimit = 240 }) {
  return fetchJson('/api/pokemon/defensive-swaps', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      team,
      topK,
      candidateLimit,
      scanLimit,
    }),
  })
}
