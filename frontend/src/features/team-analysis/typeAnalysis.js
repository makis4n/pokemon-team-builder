import TYPE_CHART from '../../data/typeChart'
import { WEAKNESS_SCORES } from './constants'

const ATTACKING_TYPES = Object.keys(TYPE_CHART)
const WEAKNESS_RATIO_THRESHOLD = 0.5

function toDisplayTypeName(type) {
  return type[0].toUpperCase() + type.slice(1)
}

function toDisplayPokemonName(name) {
  return name
    .split('-')
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join('-')
}

export function getDefensiveProfile(types) {
  return ATTACKING_TYPES.reduce((profile, attackingType) => {
    let multiplier = 1

    for (const defendingType of types) {
      const chart = TYPE_CHART[attackingType] || {}
      multiplier *= chart[defendingType] ?? 1
    }

    profile[attackingType] = multiplier
    return profile
  }, {})
}

export function categoriseProfile(profile) {
  const categories = {
    weakness: [],
    quadWeakness: [],
    resistance: [],
    doubleResist: [],
    immunities: [],
  }

  for (const attackingType of ATTACKING_TYPES) {
    const multiplier = profile[attackingType] ?? 1

    if (multiplier === 0) {
      categories.immunities.push(attackingType)
    } else if (Math.abs(multiplier - 4) < 0.001) {
      categories.quadWeakness.push(attackingType)
    } else if (multiplier > 1) {
      categories.weakness.push(attackingType)
    } else if (Math.abs(multiplier - 0.25) < 0.001) {
      categories.doubleResist.push(attackingType)
    } else if (multiplier < 1) {
      categories.resistance.push(attackingType)
    }
  }

  return categories
}

export function analyseTeamWeaknesses(team) {
  const summaryByType = ATTACKING_TYPES.reduce((accumulator, type) => {
    accumulator[type] = {
      weak2x: 0,
      weak4x: 0,
      resist05x: 0,
      resist025x: 0,
      immune: 0,
    }
    return accumulator
  }, {})

  for (const pokemon of team) {
    const profile = getDefensiveProfile(pokemon.types)
    const categories = categoriseProfile(profile)

    for (const type of categories.weakness) {
      summaryByType[type].weak2x += 1
    }
    for (const type of categories.quadWeakness) {
      summaryByType[type].weak4x += 1
    }
    for (const type of categories.resistance) {
      summaryByType[type].resist05x += 1
    }
    for (const type of categories.doubleResist) {
      summaryByType[type].resist025x += 1
    }
    for (const type of categories.immunities) {
      summaryByType[type].immune += 1
    }
  }

  return ATTACKING_TYPES.map((type) => ({ type, ...summaryByType[type] }))
}

export function computeWeightedTypeSummary(team) {
  return analyseTeamWeaknesses(team)
    .map((entry) => ({
      ...entry,
      weightedScore:
        entry.weak4x * WEAKNESS_SCORES[4] +
        entry.weak2x * WEAKNESS_SCORES[2] +
        entry.resist05x * WEAKNESS_SCORES[0.5] +
        entry.resist025x * WEAKNESS_SCORES[0.25] +
        entry.immune * WEAKNESS_SCORES[0],
    }))
    .sort((left, right) => {
      if (left.weightedScore !== right.weightedScore) {
        return right.weightedScore - left.weightedScore
      }

      if (left.immune !== right.immune) {
        return left.immune - right.immune
      }

      return left.type.localeCompare(right.type)
    })
}

function buildWeaknessInsight(weaknesses, teamSize) {
  const candidates = weaknesses
    .map((entry) => ({
      ...entry,
      weakCount: entry.weak2x + entry.weak4x,
    }))
    .filter((entry) => entry.weakCount / teamSize >= WEAKNESS_RATIO_THRESHOLD)
    .sort((left, right) => {
      if (left.weakCount !== right.weakCount) {
        return right.weakCount - left.weakCount
      }

      if (left.weak4x !== right.weak4x) {
        return right.weak4x - left.weak4x
      }

      return left.type.localeCompare(right.type)
    })

  if (candidates.length === 0) {
    return null
  }

  const topWeakCount = candidates[0].weakCount
  const tiedTypes = candidates
    .filter((entry) => entry.weakCount === topWeakCount)
    .map((entry) => toDisplayTypeName(entry.type))
    .sort((left, right) => left.localeCompare(right))

  const formattedTypes =
    tiedTypes.length === 1
      ? tiedTypes[0]
      : tiedTypes.length === 2
        ? `${tiedTypes[0]} and ${tiedTypes[1]}`
        : `${tiedTypes.slice(0, -1).join(', ')}, and ${tiedTypes[tiedTypes.length - 1]}`

  return {
    key: 'weakness',
    message: `Weakness: ${topWeakCount}/${teamSize} are weak to ${formattedTypes}.`,
  }
}

function buildCoverageInsight(weaknesses) {
  const uncoveredTypes = weaknesses
    .filter((entry) => entry.resist05x + entry.resist025x + entry.immune === 0)
    .map((entry) => toDisplayTypeName(entry.type))

  if (uncoveredTypes.length === 0) {
    return null
  }

  const listedTypes = uncoveredTypes.slice(0, 4).join(', ')
  const remainingCount = uncoveredTypes.length - 4
  const suffix = remainingCount > 0 ? `, +${remainingCount} more` : ''

  return {
    key: 'coverage',
    message: `Coverage: No resist or immunity to ${listedTypes}${suffix}.`,
  }
}

function buildQuadWeaknessInsight(team) {
  const entries = []

  for (const pokemon of team) {
    const profile = getDefensiveProfile(pokemon.types)
    const categories = categoriseProfile(profile)

    if (categories.quadWeakness.length === 0) {
      continue
    }

    const weakTypes = categories.quadWeakness.map(toDisplayTypeName).join('/')
    entries.push(`${toDisplayPokemonName(pokemon.name)} (${weakTypes})`)
  }

  if (entries.length === 0) {
    return null
  }

  const listedEntries = entries.slice(0, 3).join(', ')
  const remainingCount = entries.length - 3
  const suffix = remainingCount > 0 ? `, +${remainingCount} more` : ''

  return {
    key: 'quad-risk',
    message: `4x Risk: ${listedEntries}${suffix}.`,
  }
}

export function generateDefensiveInsights(team) {
  if (team.length === 0) {
    return []
  }

  const weaknesses = analyseTeamWeaknesses(team)
  const teamSize = team.length

  return [
    buildWeaknessInsight(weaknesses, teamSize),
    buildCoverageInsight(weaknesses),
    buildQuadWeaknessInsight(team),
  ].filter(Boolean)
}
