import { ROLE_NAMES } from './constants'

export function getStatValue(stats, statName) {
  const match = stats.find((stat) => stat.name === statName)
  return match ? match.baseStat : 0
}

export function getRoleScores(stats) {
  const hp = getStatValue(stats, 'hp')
  const attack = getStatValue(stats, 'attack')
  const defense = getStatValue(stats, 'defense')
  const specialAttack = getStatValue(stats, 'special-attack')
  const specialDefense = getStatValue(stats, 'special-defense')
  const speed = getStatValue(stats, 'speed')

  const bulkAverage = (hp + defense + specialDefense) / 3
  const offensePeak = Math.max(attack, specialAttack)
  const offenseAverage = (attack + specialAttack) / 2
  const offenseGap = Math.abs(attack - specialAttack)

  const rawScores = {
    'Physical Sweeper':
      (attack * 0.62 + speed * 0.58 - specialAttack * 0.22 - bulkAverage * 0.18) / 100,
    'Special Sweeper':
      (specialAttack * 0.62 + speed * 0.58 - attack * 0.22 - bulkAverage * 0.18) / 100,
    'Physical Wall':
      (hp * 0.5 + defense * 0.62 + specialDefense * 0.18 - speed * 0.22 - offenseAverage * 0.15) / 100,
    'Special Wall':
      (hp * 0.5 + specialDefense * 0.62 + defense * 0.18 - speed * 0.22 - offenseAverage * 0.15) / 100,
    Tank:
      (hp * 0.42 + defense * 0.3 + specialDefense * 0.3 + offensePeak * 0.12 - speed * 0.16) / 100,
    Wallbreaker:
      (offensePeak * 0.62 + offenseAverage * 0.28 + offenseGap * 0.18 - speed * 0.38 - bulkAverage * 0.14) / 100,
    'Fast Support':
      (speed * 0.62 + bulkAverage * 0.26 - offensePeak * 0.28 + Math.min(defense, specialDefense) * 0.08) / 100,
  }

  return Object.fromEntries(
    Object.entries(rawScores).map(([role, score]) => [role, Math.max(0, score)]),
  )
}

export function classifyPokemonRole(pokemon) {
  const scores = getRoleScores(pokemon.stats)
  let bestRole = ROLE_NAMES[0]
  let bestScore = Number.NEGATIVE_INFINITY

  for (const role of ROLE_NAMES) {
    const score = scores[role]
    if (score > bestScore) {
      bestScore = score
      bestRole = role
    }
  }

  return {
    pokemonId: pokemon.id,
    pokemonName: pokemon.name,
    role: bestRole,
    topScore: bestScore,
    scores,
  }
}

export function buildRoleBreakdown(team) {
  const averageScores = ROLE_NAMES.reduce((accumulator, role) => {
    accumulator[role] = 0
    return accumulator
  }, {})

  const assignments = team.map(classifyPokemonRole)

  if (assignments.length > 0) {
    for (const assignment of assignments) {
      for (const role of ROLE_NAMES) {
        averageScores[role] += assignment.scores[role]
      }
    }

    for (const role of ROLE_NAMES) {
      averageScores[role] /= assignments.length
    }
  }

  return {
    averageScores,
    assignments,
  }
}

export function buildRoleByPokemonId(assignments) {
  const map = {}

  for (const assignment of assignments) {
    map[assignment.pokemonId] = assignment.role
  }

  return map
}
