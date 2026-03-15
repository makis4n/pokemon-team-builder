import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import TYPE_CHART from '../data/typeChart'

const statLabels = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  'special-attack': 'SP.ATK',
  'special-defense': 'SP.DEF',
  speed: 'SPD',
}

const ROLE_NAMES = [
  'Physical Sweeper',
  'Special Sweeper',
  'Physical Wall',
  'Special Wall',
  'Tank',
  'Wallbreaker',
  'Fast Support',
]

const ATTACKING_TYPES = Object.keys(TYPE_CHART)

const WEAKNESS_SCORES = {
  4: 8,
  2: 3,
  1: 0,
  0.5: -1,
  0.25: -2,
  0: -3,
}

function getStatValue(stats, statName) {
  const match = stats.find((stat) => stat.name === statName)
  return match ? match.baseStat : 0
}

function getRoleScores(stats) {
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
    'Tank': hp / 100 + defense / 200 + specialDefense / 200,
    'Wallbreaker': attack / 100 + specialAttack / 100 - speed / 200,
    'Fast Support': speed / 100 - attack / 200 - specialAttack / 200,
  }
}

function classifyPokemonRole(pokemon) {
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

function getDefensiveProfile(types) {
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

function categoriseProfile(profile) {
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

function analyseTeamWeaknesses(team) {
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

  const ranked = ATTACKING_TYPES.map((type) => ({ type, ...summaryByType[type] }))

  return ranked
}

function buildRoleBreakdown(team) {
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

function getRadarPoint(centerX, centerY, radius, angle) {
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  }
}

function getRadarLabelPlacement(angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const textAnchor = cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle'
  const dx = cos > 0.35 ? 5 : cos < -0.35 ? -5 : 0
  const dy = sin > 0.35 ? 7 : sin < -0.35 ? -7 : 3

  return {
    textAnchor,
    dx,
    dy,
  }
}

function splitRadarLabel(label) {
  const words = label.split(' ')
  if (words.length <= 1) {
    return [label]
  }

  if (words.length === 2) {
    return words
  }

  const midpoint = Math.ceil(words.length / 2)
  return [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')]
}

function TeamAnalysisPage({ team, teamLimit }) {
  const roleBreakdown = useMemo(() => buildRoleBreakdown(team), [team])
  const roleByPokemonId = useMemo(() => {
    const map = {}

    for (const assignment of roleBreakdown.assignments) {
      map[assignment.pokemonId] = assignment.role
    }

    return map
  }, [roleBreakdown.assignments])

  const typeSummary = useMemo(() => {
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
  }, [team])
  const maxRoleValue = useMemo(() => {
    const highest = Math.max(...Object.values(roleBreakdown.averageScores), 0)
    return highest > 0 ? highest : 1
  }, [roleBreakdown.averageScores])

  const radarData = useMemo(() => {
    const axisCount = ROLE_NAMES.length
    const centerX = 130
    const centerY = 130
    const radius = 70

    const axes = ROLE_NAMES.map((role, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / axisCount
      const end = getRadarPoint(centerX, centerY, radius, angle)
      const label = getRadarPoint(centerX, centerY, radius + 28, angle)
      const placement = getRadarLabelPlacement(angle)
      const labelLines = splitRadarLabel(role)

      return {
        role,
        angle,
        end,
        label,
        placement,
        labelLines,
      }
    })

    const rings = [0.25, 0.5, 0.75, 1].map((ratio) => {
      const points = axes.map((axis) => {
        const point = getRadarPoint(centerX, centerY, radius * ratio, axis.angle)
        return `${point.x},${point.y}`
      })

      return points.join(' ')
    })

    const dataPolygon = axes
      .map((axis) => {
        const value = roleBreakdown.averageScores[axis.role]
        const ratio = Math.max(value, 0) / maxRoleValue
        const point = getRadarPoint(centerX, centerY, radius * ratio, axis.angle)
        return `${point.x},${point.y}`
      })
      .join(' ')

    return {
      axes,
      rings,
      dataPolygon,
      centerX,
      centerY,
    }
  }, [roleBreakdown.averageScores, maxRoleValue])

  return (
    <main className="app-shell">
      <header className="top-banner">
        <h1>Team Analysis</h1>
      </header>

      <section className="analysis-grid">
        <section className="pixel-panel">
          <h2>Role Radar</h2>
          {team.length === 0 && <p className="state-text">Add Pokemon to generate role classification.</p>}
          {team.length > 0 && (
            <>
              <section className="role-radar-wrap" aria-label="Team role radar chart">
              <svg viewBox="0 0 260 260" className="role-radar-chart" role="img" aria-label="Pokemon team role distribution radar chart">
                {radarData.rings.map((ringPoints, index) => (
                  <polygon key={`ring-${index}`} points={ringPoints} className="radar-ring" />
                ))}

                {radarData.axes.map((axis) => (
                  <line
                    key={`axis-${axis.role}`}
                    x1={radarData.centerX}
                    y1={radarData.centerY}
                    x2={axis.end.x}
                    y2={axis.end.y}
                    className="radar-axis"
                  />
                ))}

                <polygon points={radarData.dataPolygon} className="radar-shape" />

                {radarData.axes.map((axis) => (
                  <text
                    key={`label-${axis.role}`}
                    x={axis.label.x + axis.placement.dx}
                    y={axis.label.y + axis.placement.dy}
                    textAnchor={axis.placement.textAnchor}
                    dominantBaseline="middle"
                    className="radar-label"
                  >
                    {axis.labelLines.map((line, lineIndex) => (
                      <tspan
                          key={`${axis.role}-${lineIndex}`}
                        x={axis.label.x + axis.placement.dx}
                        dy={lineIndex === 0 ? 0 : '1.05em'}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                ))}
              </svg>

              </section>

              <section className="type-summary-wrap" aria-label="Type weakness summary bars">
                <h3>Team Weakness Summary</h3>
                <ul className="type-summary-list">
                  {typeSummary.map((entry) => {
                    const total = Math.max(team.length, 1)
                    const weak4Width = (entry.weak4x / total) * 100
                    const weak2Width = (entry.weak2x / total) * 100
                    const resistLightWidth = (entry.resist05x / total) * 100
                    const resistDarkWidth = ((entry.resist025x + entry.immune) / total) * 100

                    return (
                      <li key={`summary-${entry.type}`}>
                        <span className={`type-badge type-${entry.type} summary-type-badge`}>{entry.type}</span>
                        <div className="summary-bar-track" aria-hidden="true">
                          <span className="summary-bar-weak4" style={{ width: `${weak4Width}%`, left: 0 }} />
                          <span className="summary-bar-weak2" style={{ width: `${weak2Width}%`, left: `${weak4Width}%` }} />
                          <span className="summary-bar-resist-dark" style={{ width: `${resistDarkWidth}%`, right: 0 }} />
                          <span className="summary-bar-resist-light" style={{ width: `${resistLightWidth}%`, right: `${resistDarkWidth}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </>
          )}
        </section>

        <section className="pixel-panel">
          <h2>Current Team ({team.length}/{teamLimit})</h2>
          {team.length === 0 && <p className="state-text">No team found for this session. Build one first.</p>}
          {team.length > 0 && (
            <ul className="team-grid">
              {team.map((pokemon) => (
                <li key={pokemon.id} className="team-entry">
                  <div className="team-entry-sprite">
                    <img src={pokemon.sprite} alt={pokemon.name} width="56" height="56" />
                  </div>
                  <div className="team-entry-details">
                    <div className="team-entry-head">
                      <h3>{pokemon.name}</h3>
                      <span>{roleByPokemonId[pokemon.id] ?? 'Unknown Role'}</span>
                    </div>
                    <div className="type-badges compact">
                      {pokemon.types.map((type) => (
                        <span key={`${pokemon.id}-analysis-${type}`} className={`type-badge type-${type}`}>
                          {type}
                        </span>
                      ))}
                    </div>
                    <ul className="team-stats-inline">
                      {pokemon.stats.map((stat) => (
                        <li key={`${pokemon.id}-analysis-${stat.name}`}>
                          <span>{statLabels[stat.name] ?? stat.name}</span>
                          <strong>{stat.baseStat}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <span className="team-entry-action-spacer" aria-hidden="true" />
                </li>
              ))}
            </ul>
          )}

          <Link to="/" className="analysis-nav-button">Team Builder</Link>
        </section>
      </section>
    </main>
  )
}

export default TeamAnalysisPage
