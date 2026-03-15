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

  return {
    'Physical Sweeper': attack / 100 + speed / 100 - defense / 200,
    'Special Sweeper': specialAttack / 100 + speed / 100 - specialDefense / 200,
    'Physical Wall': defense / 100 + hp / 100 - speed / 200,
    'Special Wall': specialDefense / 100 + hp / 100 - speed / 200,
    Tank: hp / 100 + defense / 200 + specialDefense / 200,
    Wallbreaker: attack / 100 + specialAttack / 100 - speed / 200,
    'Fast Support': speed / 100 - attack / 200 - specialAttack / 200,
  }
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
