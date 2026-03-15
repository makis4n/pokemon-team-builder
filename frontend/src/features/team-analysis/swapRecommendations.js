import { analyseTeamWeaknesses, categoriseProfile, computeWeightedTypeSummary, getDefensiveProfile } from './typeAnalysis'

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

function getTypeEntryMap(summaryEntries) {
  return summaryEntries.reduce((accumulator, entry) => {
    accumulator[entry.type] = entry
    return accumulator
  }, {})
}

function getTeamQuadRiskCount(team) {
  let quadRiskCount = 0

  for (const pokemon of team) {
    const profile = getDefensiveProfile(pokemon.types)
    const categories = categoriseProfile(profile)

    if (categories.quadWeakness.length > 0) {
      quadRiskCount += 1
    }
  }

  return quadRiskCount
}

function getTeamMetrics(team) {
  const summaryEntries = analyseTeamWeaknesses(team)
  const byType = getTypeEntryMap(summaryEntries)
  const weightedTotal = computeWeightedTypeSummary(team).reduce((sum, entry) => sum + entry.weightedScore, 0)

  const criticalTypes = summaryEntries
    .filter((entry) => (entry.weak2x + entry.weak4x) / Math.max(team.length, 1) >= WEAKNESS_RATIO_THRESHOLD)
    .map((entry) => entry.type)

  const uncoveredTypes = summaryEntries
    .filter((entry) => entry.resist05x + entry.resist025x + entry.immune === 0)
    .map((entry) => entry.type)

  return {
    byType,
    criticalTypes,
    uncoveredTypes,
    quadRiskCount: getTeamQuadRiskCount(team),
    weightedTotal,
  }
}

function getExposureValue(typeEntry) {
  return typeEntry.weak2x + typeEntry.weak4x * 1.5
}

function buildImprovedTypes(baselineMetrics, nextMetrics) {
  return Object.keys(baselineMetrics.byType)
    .map((type) => {
      const baseline = baselineMetrics.byType[type]
      const next = nextMetrics.byType[type]
      const delta = getExposureValue(baseline) - getExposureValue(next)

      return { type, delta }
    })
    .filter((entry) => entry.delta > 0)
    .sort((left, right) => {
      if (left.delta !== right.delta) {
        return right.delta - left.delta
      }

      return left.type.localeCompare(right.type)
    })
}

function buildNewCoverageTypes(baselineMetrics, nextMetrics) {
  return baselineMetrics.uncoveredTypes.filter((type) => {
    const nextEntry = nextMetrics.byType[type]
    return nextEntry.resist05x + nextEntry.resist025x + nextEntry.immune > 0
  })
}

function buildRecommendationReason(parts) {
  if (parts.length === 0) {
    return 'Provides a minor defensive reshuffle.'
  }

  return parts.join(' ')
}

function scoreSwap(baselineMetrics, nextMetrics, improvedTypes, newCoverageTypes) {
  const criticalReduction = baselineMetrics.criticalTypes.length - nextMetrics.criticalTypes.length
  const uncoveredReduction = baselineMetrics.uncoveredTypes.length - nextMetrics.uncoveredTypes.length
  const quadReduction = baselineMetrics.quadRiskCount - nextMetrics.quadRiskCount
  const weightedReduction = baselineMetrics.weightedTotal - nextMetrics.weightedTotal
  const exposureReduction = improvedTypes.reduce((sum, entry) => sum + entry.delta, 0)

  return (
    criticalReduction * 35 +
    uncoveredReduction * 24 +
    quadReduction * 20 +
    weightedReduction * 2 +
    exposureReduction * 6 +
    newCoverageTypes.length * 8
  )
}

function buildRecommendation(outgoingPokemon, incomingPokemon, baselineMetrics, nextMetrics) {
  const improvedTypes = buildImprovedTypes(baselineMetrics, nextMetrics)
  const newCoverageTypes = buildNewCoverageTypes(baselineMetrics, nextMetrics)
  const score = scoreSwap(baselineMetrics, nextMetrics, improvedTypes, newCoverageTypes)

  if (score <= 0) {
    return null
  }

  const criticalReduction = baselineMetrics.criticalTypes.length - nextMetrics.criticalTypes.length
  const uncoveredReduction = baselineMetrics.uncoveredTypes.length - nextMetrics.uncoveredTypes.length
  const quadReduction = baselineMetrics.quadRiskCount - nextMetrics.quadRiskCount

  const reasonParts = []

  if (criticalReduction > 0) {
    reasonParts.push(
      `Severe shared weaknesses drop from ${baselineMetrics.criticalTypes.length} to ${nextMetrics.criticalTypes.length}.`,
    )
  }

  if (uncoveredReduction > 0) {
    reasonParts.push(
      `Uncovered attack types drop from ${baselineMetrics.uncoveredTypes.length} to ${nextMetrics.uncoveredTypes.length}.`,
    )
  }

  if (quadReduction > 0) {
    reasonParts.push(`4x-risk members drop from ${baselineMetrics.quadRiskCount} to ${nextMetrics.quadRiskCount}.`)
  }

  if (newCoverageTypes.length > 0) {
    const coveredTypes = newCoverageTypes.slice(0, 3).map(toDisplayTypeName).join(', ')
    reasonParts.push(`Adds first resist/immunity into ${coveredTypes}.`)
  }

  if (improvedTypes.length > 0) {
    const topTypes = improvedTypes.slice(0, 2).map((entry) => toDisplayTypeName(entry.type)).join(', ')
    reasonParts.push(`Most improved pressure: ${topTypes}.`)
  }

  return {
    score,
    outgoingPokemon,
    incomingPokemon,
    reason: buildRecommendationReason(reasonParts),
  }
}

export function recommendDefensiveSwaps(team, candidatePool, options = {}) {
  if (team.length === 0 || candidatePool.length === 0) {
    return []
  }

  const topK = options.topK ?? 5
  const maxCandidates = options.maxCandidates ?? 120
  const teamIds = new Set(team.map((pokemon) => pokemon.id))
  const baselineMetrics = getTeamMetrics(team)

  const eligibleCandidates = candidatePool
    .filter((candidate) => !teamIds.has(candidate.id))
    .filter((candidate) => Array.isArray(candidate.types) && candidate.types.length > 0)
    .slice(0, maxCandidates)

  const recommendations = []

  for (let outgoingIndex = 0; outgoingIndex < team.length; outgoingIndex += 1) {
    const outgoingPokemon = team[outgoingIndex]

    for (const incomingPokemon of eligibleCandidates) {
      const nextTeam = team.slice()
      nextTeam[outgoingIndex] = incomingPokemon

      const nextMetrics = getTeamMetrics(nextTeam)
      const recommendation = buildRecommendation(outgoingPokemon, incomingPokemon, baselineMetrics, nextMetrics)

      if (recommendation) {
        recommendations.push(recommendation)
      }
    }
  }

  return recommendations
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score
      }

      if (left.incomingPokemon.name !== right.incomingPokemon.name) {
        return left.incomingPokemon.name.localeCompare(right.incomingPokemon.name)
      }

      return left.outgoingPokemon.name.localeCompare(right.outgoingPokemon.name)
    })
    .slice(0, topK)
    .map((entry) => ({
      score: Math.round(entry.score),
      outgoingPokemonName: toDisplayPokemonName(entry.outgoingPokemon.name),
      incomingPokemonName: toDisplayPokemonName(entry.incomingPokemon.name),
      incomingPokemonId: entry.incomingPokemon.id,
      reason: entry.reason,
    }))
}