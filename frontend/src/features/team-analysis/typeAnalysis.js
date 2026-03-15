import TYPE_CHART from '../../data/typeChart'
import { WEAKNESS_SCORES } from './constants'

const ATTACKING_TYPES = Object.keys(TYPE_CHART)

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
