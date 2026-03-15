function AnalysisOverviewPanel({
  activeRadarConfig,
  radarData,
  radarMode,
  onRadarModeChange,
  teamLength,
  typeSummary,
  defensiveInsights,
  swapRecommendations,
  isRecommendationsLoading,
  recommendationsError,
}) {
  function splitReasonParts(reason) {
    if (!reason) {
      return []
    }

    const parts = reason
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)

    const coverageGapPart = parts.find((part) => part.toLowerCase().startsWith('coverage gaps'))
    const addsCoverPart = parts.find((part) => part.toLowerCase().startsWith('adds cover'))
    const mergedCoveragePart = [coverageGapPart, addsCoverPart].filter(Boolean).join(' | ')

    const normalizedParts = []

    for (const part of parts) {
      const normalizedPart = part.toLowerCase()

      if (normalizedPart.startsWith('coverage gaps') || normalizedPart.startsWith('adds cover')) {
        continue
      }

      normalizedParts.push(part)
    }

    if (mergedCoveragePart) {
      normalizedParts.push(mergedCoveragePart)
    }

    return normalizedParts
  }

  function getReasonTone(part) {
    const normalizedPart = part.toLowerCase()

    if (normalizedPart.startsWith('severe weak')) {
      return 'severe'
    }

    if (normalizedPart.startsWith('coverage gaps')) {
      return 'coverage-gaps'
    }

    if (normalizedPart.startsWith('adds cover')) {
      return 'adds-cover'
    }

    if (normalizedPart.startsWith('pressure relief')) {
      return 'pressure-relief'
    }

    return 'default'
  }

  return (
    <section className="pixel-panel">
      <div className="radar-header">
        <h2>{activeRadarConfig.title}</h2>
        <div className="radar-toggle" role="group" aria-label="Radar mode toggle">
          <button
            type="button"
            className={`radar-toggle-button${radarMode === 'stats' ? ' active' : ''}`}
            onClick={() => onRadarModeChange('stats')}
            aria-pressed={radarMode === 'stats'}
          >
            Stats
          </button>
          <button
            type="button"
            className={`radar-toggle-button${radarMode === 'roles' ? ' active' : ''}`}
            onClick={() => onRadarModeChange('roles')}
            aria-pressed={radarMode === 'roles'}
          >
            Roles
          </button>
        </div>
      </div>

      {teamLength === 0 && <p className="state-text">{activeRadarConfig.emptyMessage}</p>}

      {teamLength > 0 && (
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
                const total = Math.max(teamLength, 1)
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
                          <img src={recommendation.incomingPokemonSprite} alt="" className="swap-recommendation-sprite-image" />
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
                        <div className="swap-recommendation-reason-tags" aria-label="Recommendation summary">
                          {splitReasonParts(recommendation.reason).map((part) => (
                            <span
                              key={`${recommendation.incomingPokemonId}-${part}`}
                              className={`swap-reason-tag ${getReasonTone(part)}`}
                            >
                              {part}
                            </span>
                          ))}
                        </div>
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
  )
}

export default AnalysisOverviewPanel
