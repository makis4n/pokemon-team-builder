import { ROLE_NAMES } from './constants'

const ROLE_RADAR_COUNT_WEIGHT = 0.85
const ROLE_RADAR_SCORE_WEIGHT = 0.15
const ROLE_RADAR_BASELINE = 0.06

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

  // useful derived values
  const offensePeak = Math.max(attack, specialAttack)
  const mixedOffense = (attack + specialAttack) / 2
  const mixedBulk = (defense + specialDefense) / 2
  const physicalBias = attack - specialAttack // positive = physical leaning
  const specialBias = specialAttack - attack // positive = special leaning

  const rawScores = {
    // PHYSICAL SWEEPER
    // Needs: high attack to hit hard, high speed to move first
    // Contradicted by: high defenses (means it's bulky, not a sweeper)
    // Speed is slightly more important than attack - a slow hard hitter is a wallbreaker
    'Physical Sweeper':
      (
        attack * 0.80 + // primary - hitting hard physically is the whole point
        speed * 0.70 + // nearly as important - speed defines a sweeper vs wallbreaker
        physicalBias * 0.30 - // reward leaning physical over special - pure physical sweeper
        specialDefense * 0.25 - // high spdef = bulky = not a sweeper
        defense * 0.20 - // high def = bulky = not a sweeper
        hp * 0.10 // minor penalty - high hp leans tank territory
      ) / 100,

    // SPECIAL SWEEPER
    // Mirror of physical sweeper but for special attack
    // Special sweepers tend to have slightly lower speed than physical
    // so speed weight is the same but special attack weight slightly higher
    'Special Sweeper':
      (
        specialAttack * 0.85 + // primary - higher weight than physical sweeper attack
        speed * 0.70 + // equally important - must move first
        specialBias * 0.30 - // reward leaning special over physical
        defense * 0.25 - // high def = bulky
        specialDefense * 0.20 - // high spdef = bulky
        hp * 0.10 // minor penalty
      ) / 100,

    // PHYSICAL WALL
    // Needs: very high defense to tank hits, high hp to sustain
    // Completely contradicted by offensive stats - walls don't attack
    // Speed is irrelevant - walls are expected to be slow
    'Physical Wall':
      (
        defense * 0.90 + // primary - this is the whole role
        hp * 0.65 + // nearly as important - bulk needs hp to matter
        specialDefense * 0.15 - // mild reward - mixed bulk is nice but not the focus
        attack * 0.40 - // strong penalty - high attack = not a wall
        specialAttack * 0.40 - // strong penalty - same
        speed * 0.05 // tiny penalty - speed is just irrelevant here
      ) / 100,

    // SPECIAL WALL
    // Mirror of physical wall for special defense
    // Special walls tend to have higher hp (e.g. Blissey) so hp weight is higher
    'Special Wall':
      (
        specialDefense * 0.90 + // primary
        hp * 0.75 + // slightly higher than physical wall - specially defensive pokemon often have massive hp
        defense * 0.10 - // mild - mixed bulk is secondary
        attack * 0.40 - // strong penalty
        specialAttack * 0.40 - // strong penalty
        speed * 0.05 // tiny penalty
      ) / 100,

    // TANK
    // Needs: high hp above all else, good bulk on BOTH sides
    // The defining trait is being hard to take down from ANY angle
    // Completely contradicted by high speed - fast pokemon are not tanks
    // Mildly contradicted by one-sided offense
    Tank:
      (
        hp * 0.80 + // primary - tanks live on hp
        defense * 0.50 + // both defensive stats equally important
        specialDefense * 0.50 + // must handle both physical and special
        attack * 0.10 - // mild penalty - some tanks hit decently
        specialAttack * 0.10 - // mild penalty
        speed * 0.60 // strong penalty - fast = not a tank
      ) / 100,

    // WALLBREAKER
    // Needs: very high offense (either physical or special), some bulk to survive
    // Key distinction from sweeper: slower but hits even harder
    // Speed is actively penalised - if it's fast AND hits hard it's a sweeper
    // Mixed offense is better here than pure offense - wallbreakers often run both
    Wallbreaker:
      (
        offensePeak * 0.85 + // primary - raw offensive power is everything
        mixedOffense * 0.35 + // reward having both attack stats decent
        hp * 0.30 + // some bulk to survive a hit before attacking
        mixedBulk * 0.20 - // mild reward for bulk but dont over-reward
        speed * 0.55 // strong penalty - fast hard hitter = sweeper not wallbreaker
      ) / 100,

    // FAST SUPPORT
    // Needs: high speed above all else to move first and apply utility
    // Supporting stats: hp to survive long enough to be useful
    // Strongly contradicted by either attack stat - support means not attacking
    // Also contradicted by defensive stats - support relies on speed not bulk
    'Fast Support':
      (
        speed * 0.95 + // primary - speed is the entire point
        hp * 0.25 + // secondary - needs to survive to be useful
        mixedBulk * 0.10 - // mild - some bulk is ok but not the focus
        attack * 0.55 - // strong penalty - high attack = attacker not supporter
        specialAttack * 0.55 - // strong penalty - same
        defense * 0.10 - // mild penalty - high defense = wall not support
        specialDefense * 0.10 // mild penalty - same
      ) / 100,
  }

  const clampedScores = Object.fromEntries(
    Object.entries(rawScores).map(([role, score]) => [role, Math.max(0, score)]),
  )

  const totalScore = Object.values(clampedScores).reduce(
    (sum, score) => sum + score,
    0,
  )

  if (totalScore <= 0) {
    return clampedScores
  }

  return Object.fromEntries(
    Object.entries(clampedScores).map(([role, score]) => [role, score / totalScore]),
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

  const blendedScores = ROLE_NAMES.reduce((accumulator, role) => {
    accumulator[role] = 0
    return accumulator
  }, {})

  const roleCounts = ROLE_NAMES.reduce((accumulator, role) => {
    accumulator[role] = 0
    return accumulator
  }, {})

  const assignments = team.map(classifyPokemonRole)

  if (assignments.length > 0) {
    for (const assignment of assignments) {
      roleCounts[assignment.role] += 1

      for (const role of ROLE_NAMES) {
        averageScores[role] += assignment.scores[role]
      }
    }

    for (const role of ROLE_NAMES) {
      averageScores[role] /= assignments.length

      const countShare = roleCounts[role] / assignments.length
      const scoreShare = averageScores[role]

      // Role radar is count-first: distribution of assigned roles on the team.
      // Score share adds a small soft signal so nearby secondary roles still show nuance.
      const weightedScore =
        countShare * ROLE_RADAR_COUNT_WEIGHT +
        scoreShare * ROLE_RADAR_SCORE_WEIGHT

      // Keep a small floor so low-share roles remain visible on the polygon.
      blendedScores[role] =
        ROLE_RADAR_BASELINE + weightedScore * (1 - ROLE_RADAR_BASELINE)
    }
  }

  return {
    averageScores,
    blendedScores,
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
