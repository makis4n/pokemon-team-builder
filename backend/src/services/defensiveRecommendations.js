const { TYPE_CHART } = require('./pokeapi');

const WEAKNESS_RATIO_THRESHOLD = 0.5;
const WEAKNESS_SCORES = {
  4: 8,
  2: 3,
  1: 0,
  0.5: -1,
  0.25: -2,
  0: -3,
};

const ATTACKING_TYPES = Object.keys(TYPE_CHART);

function toDisplayPokemonName(name) {
  return name
    .split('-')
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join('-');
}

function toDisplayTypeName(type) {
  return type[0].toUpperCase() + type.slice(1);
}

function getDefensiveProfile(types) {
  return ATTACKING_TYPES.reduce((profile, attackingType) => {
    let multiplier = 1;

    for (const defendingType of types) {
      const chart = TYPE_CHART[attackingType] || {};
      multiplier *= chart[defendingType] ?? 1;
    }

    profile[attackingType] = multiplier;
    return profile;
  }, {});
}

function categoriseProfile(profile) {
  const categories = {
    weakness: [],
    quadWeakness: [],
    resistance: [],
    doubleResist: [],
    immunities: [],
  };

  for (const attackingType of ATTACKING_TYPES) {
    const multiplier = profile[attackingType] ?? 1;

    if (multiplier === 0) {
      categories.immunities.push(attackingType);
    } else if (Math.abs(multiplier - 4) < 0.001) {
      categories.quadWeakness.push(attackingType);
    } else if (multiplier > 1) {
      categories.weakness.push(attackingType);
    } else if (Math.abs(multiplier - 0.25) < 0.001) {
      categories.doubleResist.push(attackingType);
    } else if (multiplier < 1) {
      categories.resistance.push(attackingType);
    }
  }

  return categories;
}

function analyseTeamWeaknesses(team) {
  const summaryByType = ATTACKING_TYPES.reduce((accumulator, type) => {
    accumulator[type] = {
      weak2x: 0,
      weak4x: 0,
      resist05x: 0,
      resist025x: 0,
      immune: 0,
    };
    return accumulator;
  }, {});

  for (const pokemon of team) {
    const profile = getDefensiveProfile(pokemon.types);
    const categories = categoriseProfile(profile);

    for (const type of categories.weakness) {
      summaryByType[type].weak2x += 1;
    }
    for (const type of categories.quadWeakness) {
      summaryByType[type].weak4x += 1;
    }
    for (const type of categories.resistance) {
      summaryByType[type].resist05x += 1;
    }
    for (const type of categories.doubleResist) {
      summaryByType[type].resist025x += 1;
    }
    for (const type of categories.immunities) {
      summaryByType[type].immune += 1;
    }
  }

  return ATTACKING_TYPES.map((type) => ({ type, ...summaryByType[type] }));
}

function computeWeightedTypeSummary(team) {
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
        return right.weightedScore - left.weightedScore;
      }

      if (left.immune !== right.immune) {
        return left.immune - right.immune;
      }

      return left.type.localeCompare(right.type);
    });
}

function getTypeEntryMap(summaryEntries) {
  return summaryEntries.reduce((accumulator, entry) => {
    accumulator[entry.type] = entry;
    return accumulator;
  }, {});
}

function getPriorityWeakTypes(team) {
  if (!team.length) {
    return [];
  }

  return analyseTeamWeaknesses(team)
    .map((entry) => ({
      type: entry.type,
      pressure: entry.weak2x + entry.weak4x * 2,
    }))
    .filter((entry) => entry.pressure > 0)
    .sort((left, right) => {
      if (left.pressure !== right.pressure) {
        return right.pressure - left.pressure;
      }

      return left.type.localeCompare(right.type);
    })
    .slice(0, 6)
    .map((entry) => entry.type);
}

function getTeamQuadRiskCount(team) {
  let quadRiskCount = 0;

  for (const pokemon of team) {
    const profile = getDefensiveProfile(pokemon.types);
    const categories = categoriseProfile(profile);

    if (categories.quadWeakness.length > 0) {
      quadRiskCount += 1;
    }
  }

  return quadRiskCount;
}

function getTeamMetrics(team) {
  const summaryEntries = analyseTeamWeaknesses(team);
  const byType = getTypeEntryMap(summaryEntries);
  const weightedTotal = computeWeightedTypeSummary(team).reduce((sum, entry) => sum + entry.weightedScore, 0);

  const criticalTypes = summaryEntries
    .filter((entry) => (entry.weak2x + entry.weak4x) / Math.max(team.length, 1) >= WEAKNESS_RATIO_THRESHOLD)
    .map((entry) => entry.type);

  const uncoveredTypes = summaryEntries
    .filter((entry) => entry.resist05x + entry.resist025x + entry.immune === 0)
    .map((entry) => entry.type);

  return {
    byType,
    criticalTypes,
    uncoveredTypes,
    quadRiskCount: getTeamQuadRiskCount(team),
    weightedTotal,
  };
}

function getExposureValue(typeEntry) {
  return typeEntry.weak2x + typeEntry.weak4x * 1.5;
}

function buildImprovedTypes(baselineMetrics, nextMetrics) {
  return Object.keys(baselineMetrics.byType)
    .map((type) => {
      const baseline = baselineMetrics.byType[type];
      const next = nextMetrics.byType[type];
      const delta = getExposureValue(baseline) - getExposureValue(next);

      return { type, delta };
    })
    .filter((entry) => entry.delta > 0)
    .sort((left, right) => {
      if (left.delta !== right.delta) {
        return right.delta - left.delta;
      }

      return left.type.localeCompare(right.type);
    });
}

function buildNewCoverageTypes(baselineMetrics, nextMetrics) {
  return baselineMetrics.uncoveredTypes.filter((type) => {
    const nextEntry = nextMetrics.byType[type];
    return nextEntry.resist05x + nextEntry.resist025x + nextEntry.immune > 0;
  });
}

function scoreSwap(baselineMetrics, nextMetrics, improvedTypes, newCoverageTypes) {
  const criticalReduction = baselineMetrics.criticalTypes.length - nextMetrics.criticalTypes.length;
  const uncoveredReduction = baselineMetrics.uncoveredTypes.length - nextMetrics.uncoveredTypes.length;
  const quadReduction = baselineMetrics.quadRiskCount - nextMetrics.quadRiskCount;
  const weightedReduction = baselineMetrics.weightedTotal - nextMetrics.weightedTotal;
  const exposureReduction = improvedTypes.reduce((sum, entry) => sum + entry.delta, 0);

  return (
    criticalReduction * 35 +
    uncoveredReduction * 24 +
    quadReduction * 20 +
    weightedReduction * 2 +
    exposureReduction * 6 +
    newCoverageTypes.length * 8
  );
}

function buildRecommendationReason(parts) {
  if (parts.length === 0) {
    return 'Small defensive improvement.';
  }

  return parts.join(' | ');
}

function buildRecommendation(outgoingPokemon, incomingPokemon, baselineMetrics, nextMetrics) {
  const improvedTypes = buildImprovedTypes(baselineMetrics, nextMetrics);
  const newCoverageTypes = buildNewCoverageTypes(baselineMetrics, nextMetrics);
  const score = scoreSwap(baselineMetrics, nextMetrics, improvedTypes, newCoverageTypes);

  if (score <= 0) {
    return null;
  }

  const criticalReduction = baselineMetrics.criticalTypes.length - nextMetrics.criticalTypes.length;
  const uncoveredReduction = baselineMetrics.uncoveredTypes.length - nextMetrics.uncoveredTypes.length;
  const quadReduction = baselineMetrics.quadRiskCount - nextMetrics.quadRiskCount;

  const reasonParts = [];

  if (criticalReduction > 0) {
    reasonParts.push(`Severe weak: ${baselineMetrics.criticalTypes.length} -> ${nextMetrics.criticalTypes.length}`);
  }

  if (uncoveredReduction > 0) {
    reasonParts.push(`Coverage gaps: ${baselineMetrics.uncoveredTypes.length} -> ${nextMetrics.uncoveredTypes.length}`);
  }

  if (quadReduction > 0) {
    reasonParts.push(`4x risk: ${baselineMetrics.quadRiskCount} -> ${nextMetrics.quadRiskCount}`);
  }

  if (newCoverageTypes.length > 0) {
    const coveredTypes = newCoverageTypes.slice(0, 3).map(toDisplayTypeName).join(', ');
    reasonParts.push(`Adds cover: ${coveredTypes}`);
  }

  if (improvedTypes.length > 0) {
    const topTypes = improvedTypes.slice(0, 2).map((entry) => toDisplayTypeName(entry.type)).join(', ');
    reasonParts.push(`Pressure relief: ${topTypes}`);
  }

  return {
    score,
    outgoingPokemon,
    incomingPokemon,
    reason: buildRecommendationReason(reasonParts),
  };
}

function recommendDefensiveSwaps(team, candidatePool, options = {}) {
  if (team.length === 0 || candidatePool.length === 0) {
    return [];
  }

  const topK = options.topK ?? 5;
  const maxCandidates = options.maxCandidates ?? 90;
  const teamIds = new Set(team.map((pokemon) => pokemon.id));
  const baselineMetrics = getTeamMetrics(team);

  const eligibleCandidates = candidatePool
    .filter((candidate) => !teamIds.has(candidate.id))
    .filter((candidate) => Array.isArray(candidate.types) && candidate.types.length > 0)
    .slice(0, maxCandidates);

  const recommendations = [];

  for (let outgoingIndex = 0; outgoingIndex < team.length; outgoingIndex += 1) {
    const outgoingPokemon = team[outgoingIndex];

    for (const incomingPokemon of eligibleCandidates) {
      const nextTeam = team.slice();
      nextTeam[outgoingIndex] = incomingPokemon;

      const nextMetrics = getTeamMetrics(nextTeam);
      const recommendation = buildRecommendation(outgoingPokemon, incomingPokemon, baselineMetrics, nextMetrics);

      if (recommendation) {
        recommendations.push(recommendation);
      }
    }
  }

  return recommendations
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      if (left.incomingPokemon.name !== right.incomingPokemon.name) {
        return left.incomingPokemon.name.localeCompare(right.incomingPokemon.name);
      }

      return left.outgoingPokemon.name.localeCompare(right.outgoingPokemon.name);
    })
    .slice(0, topK)
    .map((entry) => ({
      score: Math.round(entry.score),
      outgoingPokemonName: toDisplayPokemonName(entry.outgoingPokemon.name),
      incomingPokemonName: toDisplayPokemonName(entry.incomingPokemon.name),
      incomingPokemonId: entry.incomingPokemon.id,
      incomingPokemonSprite: entry.incomingPokemon.sprite,
      reason: entry.reason,
    }));
}

module.exports = {
  getPriorityWeakTypes,
  recommendDefensiveSwaps,
};
