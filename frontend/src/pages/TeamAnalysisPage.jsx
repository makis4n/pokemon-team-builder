import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { ROLE_NAMES } from '../features/team-analysis/constants'
import { buildRadarData } from '../features/team-analysis/radar'
import {
  buildRoleBreakdown,
  buildRoleByPokemonId,
} from '../features/team-analysis/roleAnalysis'
import { fetchDefensiveSwapRecommendations, fetchTeamDefenseAnalysis } from '../features/team-builder/api'
import { statLabels } from '../features/team-builder/constants'
import {
  getSwapRecommendationsFromSession,
  saveSwapRecommendationsToSession,
} from '../features/team-builder/storage'

const RADAR_STAT_ORDER = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed']
const RECOMMENDATION_CANDIDATE_LIMIT = 90
const RECOMMENDATION_SOURCE_MAX_SCAN = 240

function getRecommendationCacheKey(team) {
  const teamIdSignature = team
    .map((pokemon) => pokemon.id)
    .filter(Boolean)
    .sort((left, right) => left - right)
    .join(',')

  return `${teamIdSignature}::swap-v1`
}

function TeamAnalysisPage({ team, teamLimit }) {
  const [radarMode, setRadarMode] = useState('stats')
  const [typeSummary, setTypeSummary] = useState([])
  const [defensiveInsights, setDefensiveInsights] = useState([])
  const [swapRecommendations, setSwapRecommendations] = useState([])
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState('')

  useEffect(() => {
    if (team.length === 0) {
      setTypeSummary([])
      setDefensiveInsights([])
      return undefined
    }

    let isActive = true

    async function loadTeamDefenseAnalysis() {
      try {
        const payload = await fetchTeamDefenseAnalysis(team)

        if (!isActive) {
          return
        }

        setTypeSummary(payload.data?.typeSummary ?? [])
        setDefensiveInsights(payload.data?.defensiveInsights ?? [])
      } catch {
        if (!isActive) {
          return
        }

        setTypeSummary([])
        setDefensiveInsights([])
      }
    }

    loadTeamDefenseAnalysis()

    return () => {
      isActive = false
    }
  }, [team])

  useEffect(() => {
    if (team.length === 0) {
      setSwapRecommendations([])
      setIsRecommendationsLoading(false)
      setRecommendationsError('')
      return undefined
    }

    let isActive = true
    const recommendationCacheKey = getRecommendationCacheKey(team)

    async function loadSwapRecommendations() {
      setIsRecommendationsLoading(true)
      setRecommendationsError('')

      try {
        const cachedRecommendations = getSwapRecommendationsFromSession(recommendationCacheKey)
        if (cachedRecommendations.length > 0) {
          if (!isActive) {
            return
          }

          setSwapRecommendations(cachedRecommendations)
          return
        }

        const payload = await fetchDefensiveSwapRecommendations({
          team,
          topK: 5,
          candidateLimit: RECOMMENDATION_CANDIDATE_LIMIT,
          scanLimit: RECOMMENDATION_SOURCE_MAX_SCAN,
        })
        const recommendations = payload.data ?? []

        if (!isActive) {
          return
        }

        setSwapRecommendations(recommendations)
        saveSwapRecommendationsToSession(recommendationCacheKey, recommendations)
      } catch (error) {
        if (!isActive) {
          return
        }

        setRecommendationsError(error.message)
      } finally {
        if (isActive) {
          setIsRecommendationsLoading(false)
        }
      }
    }

    loadSwapRecommendations()

    return () => {
      isActive = false
    }
  }, [team])

  const roleBreakdown = useMemo(() => buildRoleBreakdown(team), [team])
  const teamSlots = useMemo(
    () => Array.from({ length: teamLimit }, (_, index) => team[index] ?? null),
    [team, teamLimit],
  )

  const roleByPokemonId = useMemo(
    () => buildRoleByPokemonId(roleBreakdown.assignments),
    [roleBreakdown.assignments],
  )

  const averageStats = useMemo(() => {
    const totals = RADAR_STAT_ORDER.reduce((accumulator, statName) => {
      accumulator[statName] = 0
      return accumulator
    }, {})

    if (team.length === 0) {
      return totals
    }

    for (const pokemon of team) {
      for (const stat of pokemon.stats) {
        if (stat.name in totals) {
          totals[stat.name] += stat.baseStat
        }
      }
    }

    for (const statName of RADAR_STAT_ORDER) {
      totals[statName] /= team.length
    }

    return totals
  }, [team])

  const radarAxisLabels = useMemo(
    () => RADAR_STAT_ORDER.map((statName) => statLabels[statName] ?? statName),
    [],
  )

  const radarValues = useMemo(() => {
    const values = {}

    for (const statName of RADAR_STAT_ORDER) {
      const label = statLabels[statName] ?? statName
      values[label] = averageStats[statName]
    }

    return values
  }, [averageStats])

  const roleRadarValues = useMemo(() => roleBreakdown.blendedScores, [roleBreakdown.blendedScores])

  const activeRadarConfig = useMemo(() => {
    if (radarMode === 'roles') {
      return {
        title: 'Role Radar',
        emptyMessage: 'Add Pokemon to generate a team role profile.',
        sectionAria: 'Team role radar chart',
        chartAria: 'Pokemon team role distribution radar chart',
        axisLabels: ROLE_NAMES,
        values: roleRadarValues,
        fixedMinValue: 0,
        fixedMaxValue: 0.5,
      }
    }

    return {
      title: 'Stat Radar',
      emptyMessage: 'Add Pokemon to generate a team stat profile.',
      sectionAria: 'Team base stat radar chart',
      chartAria: 'Pokemon team base stat distribution radar chart',
      axisLabels: radarAxisLabels,
      values: radarValues,
      fixedMinValue: 55,
      fixedMaxValue: 115,
    }
  }, [radarAxisLabels, radarMode, radarValues, roleRadarValues])

  const radarData = useMemo(
    () =>
      buildRadarData(activeRadarConfig.values, activeRadarConfig.axisLabels, {
        fixedMinValue: activeRadarConfig.fixedMinValue,
        fixedMaxValue: activeRadarConfig.fixedMaxValue,
      }),
    [activeRadarConfig],
  )

  return (
    <main className="app-shell">
      <header className="top-banner">
        <h1>Team Analysis</h1>
      </header>

      <section className="analysis-grid">
        <section className="pixel-panel">
          <div className="radar-header">
            <h2>{activeRadarConfig.title}</h2>
            <div className="radar-toggle" role="group" aria-label="Radar mode toggle">
              <button
                type="button"
                className={`radar-toggle-button${radarMode === 'stats' ? ' active' : ''}`}
                onClick={() => setRadarMode('stats')}
                aria-pressed={radarMode === 'stats'}
              >
                Stats
              </button>
              <button
                type="button"
                className={`radar-toggle-button${radarMode === 'roles' ? ' active' : ''}`}
                onClick={() => setRadarMode('roles')}
                aria-pressed={radarMode === 'roles'}
              >
                Roles
              </button>
            </div>
          </div>
          {team.length === 0 && <p className="state-text">{activeRadarConfig.emptyMessage}</p>}
          {team.length > 0 && (
            <>
              <section className="role-radar-wrap" aria-label={activeRadarConfig.sectionAria}>
                <svg viewBox="0 14 240 212" className="role-radar-chart" role="img" aria-label={activeRadarConfig.chartAria}>
                  {radarData.rings.map((ringPoints, index) => (
                    <polygon key={`ring-${index}`} points={ringPoints} className="radar-ring" />
                  ))}

                  {radarData.axes.map((axis) => (
                    <line
                      key={`axis-${axis.axisName}`}
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
                      key={`label-${axis.axisName}`}
                      x={axis.label.x + axis.placement.dx}
                      y={axis.label.y + axis.placement.dy}
                      textAnchor={axis.placement.textAnchor}
                      dominantBaseline="middle"
                      className="radar-label"
                    >
                      {axis.labelLines.map((line, lineIndex) => (
                        <tspan
                          key={`${axis.axisName}-${lineIndex}`}
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
                <h3>Type Weakness Summary</h3>
                <ul className="type-summary-list">
                  {typeSummary.map((entry) => {
                    const total = Math.max(team.length, 1)
                    const weak4Width = (entry.weak4x / total) * 100
                    const weak2Width = (entry.weak2x / total) * 100
                    const resistLightWidth = (entry.resist05x / total) * 100
                    const resistDarkWidth = (entry.resist025x / total) * 100
                    const immuneWidth = (entry.immune / total) * 100

                    return (
                      <li key={`summary-${entry.type}`}>
                        <span className={`type-badge type-${entry.type} summary-type-badge`}>{entry.type}</span>
                        <div className="summary-bar-track" aria-hidden="true">
                          <span className="summary-bar-weak4" style={{ width: `${weak4Width}%`, left: 0 }} />
                          <span className="summary-bar-weak2" style={{ width: `${weak2Width}%`, left: `${weak4Width}%` }} />
                          <span className="summary-bar-immune" style={{ width: `${immuneWidth}%`, right: 0 }} />
                          <span className="summary-bar-resist-dark" style={{ width: `${resistDarkWidth}%`, right: `${immuneWidth}%` }} />
                          <span
                            className="summary-bar-resist-light"
                            style={{ width: `${resistLightWidth}%`, right: `${immuneWidth + resistDarkWidth}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>

                <div className="type-summary-legend" aria-label="Type weakness summary legend">
                  <span><i className="legend-swatch weak4" aria-hidden="true" />4x weakness</span>
                  <span><i className="legend-swatch weak2" aria-hidden="true" />2x weakness</span>
                  <span><i className="legend-swatch resist05" aria-hidden="true" />0.5x resist</span>
                  <span><i className="legend-swatch resist025" aria-hidden="true" />0.25x resist</span>
                  <span><i className="legend-swatch immune" aria-hidden="true" />immune (0x)</span>
                </div>

                {defensiveInsights.length > 0 && (
                  <section className="defensive-insights-wrap" aria-label="Defensive insights">
                    <h3>Defensive Insights</h3>
                    <ul className="defensive-insights-list">
                      {defensiveInsights.map((insight) => (
                        <li className="defensive-insight-warning" key={`defensive-insight-${insight.key}`}>
                          {insight.message}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="swap-recommendations-wrap" aria-label="Defensive swap recommendations">
                  <h3>Recommended Swaps</h3>

                  {isRecommendationsLoading && (
                    <p className="swap-recommendations-state">Scanning candidate pool for defensive upgrades...</p>
                  )}

                  {!isRecommendationsLoading && recommendationsError && (
                    <p className="swap-recommendations-state error">Could not generate recommendations: {recommendationsError}</p>
                  )}

                  {!isRecommendationsLoading && !recommendationsError && swapRecommendations.length === 0 && (
                    <p className="swap-recommendations-state">No positive defensive swap found from the current candidate pool.</p>
                  )}

                  {!isRecommendationsLoading && !recommendationsError && swapRecommendations.length > 0 && (
                    <ul className="swap-recommendations-list">
                      {swapRecommendations.map((recommendation) => (
                        <li className="swap-recommendation-card" key={`${recommendation.outgoingPokemonName}-${recommendation.incomingPokemonId}`}>
                          <div className="swap-recommendation-sprite" aria-hidden="true">
                            {recommendation.incomingPokemonSprite ? (
                              <img src={recommendation.incomingPokemonSprite} alt="" width="56" height="56" />
                            ) : (
                              <span className="swap-recommendation-sprite-fallback" />
                            )}
                          </div>
                          <div className="swap-recommendation-content">
                            <p className="swap-recommendation-head">
                              <strong>{recommendation.outgoingPokemonName}</strong>
                              <span aria-hidden="true">{' -> '}</span>
                              <strong>{recommendation.incomingPokemonName}</strong>
                              <em>Score +{recommendation.score}</em>
                            </p>
                            <p className="swap-recommendation-reason">{recommendation.reason}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </section>
            </>
          )}
        </section>

        <section className="pixel-panel">
          <h2>Current Team ({team.length}/{teamLimit})</h2>
          <ul className="team-grid">
            {teamSlots.map((pokemon, index) => (
              pokemon ? (
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
              ) : (
                <li key={`analysis-empty-slot-${index}`} className="team-entry placeholder">
                  <div className="team-entry-sprite placeholder" aria-hidden="true" />
                  <div className="team-entry-details">
                    <div className="team-entry-head">
                      <h3>Empty</h3>
                    </div>
                    <p className="team-entry-placeholder-text">Add another Pokemon!</p>
                  </div>
                  <span className="team-entry-action-spacer" aria-hidden="true" />
                </li>
              )
            ))}
          </ul>

          <Link to="/" className="analysis-nav-button">Team Builder</Link>
        </section>
      </section>
    </main>
  )
}

export default TeamAnalysisPage
