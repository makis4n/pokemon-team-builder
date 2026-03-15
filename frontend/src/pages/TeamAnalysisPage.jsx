import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { ROLE_NAMES, statLabels } from '../features/team-analysis/constants'
import { buildRadarData } from '../features/team-analysis/radar'
import {
  buildRoleBreakdown,
  buildRoleByPokemonId,
} from '../features/team-analysis/roleAnalysis'
import { computeWeightedTypeSummary } from '../features/team-analysis/typeAnalysis'

function TeamAnalysisPage({ team, teamLimit }) {
  const roleBreakdown = useMemo(() => buildRoleBreakdown(team), [team])
  const teamSlots = useMemo(
    () => Array.from({ length: teamLimit }, (_, index) => team[index] ?? null),
    [team, teamLimit],
  )

  const roleByPokemonId = useMemo(
    () => buildRoleByPokemonId(roleBreakdown.assignments),
    [roleBreakdown.assignments],
  )

  const typeSummary = useMemo(() => computeWeightedTypeSummary(team), [team])

  const radarData = useMemo(
    () => buildRadarData(roleBreakdown.averageScores, ROLE_NAMES),
    [roleBreakdown.averageScores],
  )

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
                <svg viewBox="0 14 240 212" className="role-radar-chart" role="img" aria-label="Pokemon team role distribution radar chart">
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
