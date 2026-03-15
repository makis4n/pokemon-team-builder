import { TEAM_STORAGE_KEY } from './constants'

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
