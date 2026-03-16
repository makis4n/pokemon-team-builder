function TeamPokemonDetailPanel({
  isFilterSelected,
  selectedPokemon,
  detailData,
  isLoading,
  error,
  canGoBack,
  onGoBack,
  onInspectPokemon,
}) {
  if (!selectedPokemon) {
    return (
      <section className="pixel-panel">
        <h2>Pokemon Details</h2>
        <p className="state-text">Select a Pokemon from your current team to view detailed info.</p>
      </section>
    )
  }

  const filterPromptText = 'Select a filter to view Pokemon details.'
  const pokedexDescription = detailData?.pokedexDescription
    || (isFilterSelected
      ? 'No Pokedex description available for this Pokemon.'
      : 'Select a filter to view this Pokemon\'s Pokedex description.')
  const abilityEffectsByName = detailData?.abilityEffectsByName || {}

  function formatDisplayName(value) {
    return String(value || '')
      .split('-')
      .map((chunk) => (chunk ? chunk[0].toUpperCase() + chunk.slice(1) : chunk))
      .join(' ')
  }

  return (
    <section className="pixel-panel">
      <h2>Pokemon Details</h2>

      {isFilterSelected && isLoading && <p className="state-text">Loading detailed info...</p>}
      {isFilterSelected && !isLoading && error && <p className="state-text error">{error}</p>}

      {(!isFilterSelected || (!isLoading && !error && detailData)) && (
        <>
          <article className="pokemon-card team-detail-hero-card">
            <div className="pokemon-card-head team-detail-hero-head">
              <div className="pokemon-card-sprite team-detail-hero-sprite">
                <img
                  src={selectedPokemon.sprite}
                  alt={selectedPokemon.name}
                  className="pokemon-card-sprite-image"
                />
              </div>
              <div className="team-detail-hero-info">
                <p className="team-detail-hero-title">
                  <span className="team-detail-hero-prefix">No.</span>
                  <span className="team-detail-hero-id">{String(selectedPokemon.id).padStart(4, '0')}</span>
                  <span className="team-detail-hero-name">{selectedPokemon.name}</span>
                </p>
                <p className="team-detail-abilities-line">
                  <span className="label">Abilities:</span>
                </p>
                <div className="team-ability-list" aria-label="Pokemon abilities">
                  {(selectedPokemon.abilities || []).map((abilityName) => {
                    const effectText = abilityEffectsByName[abilityName]
                    const tooltipText = effectText
                      || (isFilterSelected
                        ? 'No ability effect description available.'
                        : 'Select a filter to load ability effect details.')

                    return (
                      <span
                        key={`${selectedPokemon.id}-ability-${abilityName}`}
                        className="team-ability-chip"
                        tabIndex={0}
                        aria-label={`${formatDisplayName(abilityName)}: ${tooltipText}`}
                      >
                        {formatDisplayName(abilityName)}
                        <span className="team-ability-tooltip" role="tooltip">{tooltipText}</span>
                      </span>
                    )
                  })}
                </div>
                <p className="team-pokedex-entry">{pokedexDescription}</p>
              </div>
            </div>
          </article>

          <section className="team-detail-section">
            <h3>Evolution Info</h3>
            {!isFilterSelected && <p className="team-filter-alert">{filterPromptText}</p>}

            {isFilterSelected && canGoBack && (
              <button
                type="button"
                className="analysis-nav-button team-detail-back-button"
                onClick={onGoBack}
              >
                Back
              </button>
            )}

            {isFilterSelected && !detailData.evolution?.from && (!detailData.evolution?.to || detailData.evolution.to.length === 0) && (
              <p className="state-text">No evolution data available.</p>
            )}

            {isFilterSelected && detailData.evolution?.from && (
              <ul className="team-detail-list team-static-list">
                <li>
                  <button
                    type="button"
                    className="team-static-entry-button"
                    onClick={() => onInspectPokemon(detailData.evolution.from.speciesId || detailData.evolution.from.speciesName)}
                  >
                    <strong>Evolves from:</strong> {detailData.evolution.from.speciesName} ({detailData.evolution.from.condition})
                  </button>
                </li>
              </ul>
            )}

            {isFilterSelected && detailData.evolution?.to?.length > 0 && (
              <ul className="team-detail-list team-static-list">
                {detailData.evolution.to.map((entry) => (
                  <li key={`${selectedPokemon.id}-to-${entry.speciesName}`}>
                    <button
                      type="button"
                      className="team-static-entry-button"
                      onClick={() => onInspectPokemon(entry.speciesId || entry.speciesName)}
                    >
                      <strong>Evolves to:</strong> {entry.speciesName} ({entry.condition})
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="team-detail-section">
            <h3>Move Info</h3>
            {!isFilterSelected && <p className="team-filter-alert">{filterPromptText}</p>}

            {isFilterSelected && detailData.levelUpMoves?.length === 0 && (
              <p className="state-text">No moves available for the selected game filter.</p>
            )}

            {isFilterSelected && detailData.levelUpMoves?.length > 0 && (
              <ul className="team-detail-list team-move-list">
                {detailData.levelUpMoves.map((move) => (
                  <li key={`${selectedPokemon.id}-move-${move.moveName}`} className="team-move-entry">
                    <details className="team-move-dropdown">
                      <summary className="team-move-row">
                        <span>
                          <strong>Lv {move.level}:</strong> {move.moveName}
                          <span className="team-detail-meta"> ({move.versionGroupName})</span>
                        </span>
                        <span className="team-move-summary-right">
                          <span className="team-move-arrow" aria-hidden="true" />
                          <span className={`type-badge type-${move.moveType || 'unknown'}`}>
                            {move.moveType || 'unknown'}
                          </span>
                        </span>
                      </summary>
                      <div className="team-move-expanded">
                        <section className="team-move-panel" aria-label="Move effect panel">
                          <p className="team-move-panel-title">Effect</p>
                          <ul className="team-move-meta-list" aria-label="Move stats">
                            <li><span>Category</span><strong>{move.category || 'Unknown'}</strong></li>
                            <li><span>Power</span><strong>{move.basePower ?? 'N/A'}</strong></li>
                            <li><span>Accuracy</span><strong>{move.accuracy ?? 'N/A'}</strong></li>
                            <li><span>PP</span><strong>{move.pp ?? 'N/A'}</strong></li>
                          </ul>
                        </section>

                        <section className="team-move-panel team-move-description-panel" aria-label="Move description panel">
                          <p className="team-move-panel-title">Description</p>
                          <p className="team-move-flavor">{move.flavorText || 'No flavor text available.'}</p>
                          <p className="team-move-effect">{move.effectText || 'No move effect description available.'}</p>
                        </section>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="team-detail-section">
            <h3>Encounter Locations</h3>
            {!isFilterSelected && <p className="team-filter-alert">{filterPromptText}</p>}

            {isFilterSelected && detailData.encounters?.length === 0 && (
              <p className="state-text">No encounter location data for the selected game filter.</p>
            )}

            {isFilterSelected && detailData.encounters?.length > 0 && (
              <ul className="team-detail-list compact team-static-list">
                {detailData.encounters.map((encounter) => (
                  <li key={`${selectedPokemon.id}-encounter-${encounter.locationName}`}>
                    <strong>{encounter.locationName}:</strong>
                    <span className="team-detail-meta"> {encounter.methods.join(', ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  )
}

export default TeamPokemonDetailPanel
