export async function fetchJson(url) {
  const response = await fetch(url)

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

export function fetchPokemonList(limit = 1025) {
  return fetchJson(`/api/pokemon?limit=${limit}`)
}

export function fetchPokemonDetail(nameOrId) {
  return fetchJson(`/api/pokemon/${encodeURIComponent(nameOrId)}`)
}
