function TeamPokemonDetailPanel({
  isFilterSelected,
  selectedPokemon,
  detailData,
  isLoading,
  error,
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
  const shouldShowPrompt = !isFilterSelected

  return (
    <section className="pixel-panel">
      <h2>Pokemon Details</h2>

      {isFilterSelected && isLoading && <p className="state-text">Loading detailed info...</p>}
      {isFilterSelected && !isLoading && error && <p className="state-text error">{error}</p>}

      {(!isFilterSelected || (!isLoading && !error && detailData)) && (
        <>
          <article className="pokemon-card">
            <div className="pokemon-card-head">
              <div className="pokemon-card-sprite">
                <img
                  src={selectedPokemon.sprite}
                  alt={selectedPokemon.name}
                  className="pokemon-card-sprite-image"
                />
              </div>
              <div>
                <h3>{selectedPokemon.name}</h3>
                <p>#{String(selectedPokemon.id).padStart(4, '0')}</p>
              </div>
            </div>

            <p>
              <span className="label">Types:</span>
            </p>
            <div className="type-badges" aria-label="Pokemon types">
              {selectedPokemon.types.map((type) => (
                <span key={`${selectedPokemon.id}-detail-${type}`} className={`type-badge type-${type}`}>
                  {type}
                </span>
              ))}
            </div>
          </article>

          <section className="team-detail-section">
            <h3>Evolution Info</h3>
            {!isFilterSelected && <p className="team-filter-alert">{filterPromptText}</p>}

            {isFilterSelected && !detailData.evolution?.from && (!detailData.evolution?.to || detailData.evolution.to.length === 0) && (
              <p className="state-text">No evolution data available.</p>
            )}

            {isFilterSelected && detailData.evolution?.from && (
              <p className="team-detail-line">
                <strong>Evolves from:</strong> {detailData.evolution.from.speciesName} ({detailData.evolution.from.condition})
              </p>
            )}

            {isFilterSelected && detailData.evolution?.to?.length > 0 && (
              <ul className="team-detail-list">
                {detailData.evolution.to.map((entry) => (
                  <li key={`${selectedPokemon.id}-to-${entry.speciesName}`}>
                    <strong>Evolves to:</strong> {entry.speciesName} ({entry.condition})
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="team-detail-section">
            <h3>Level-Up Moves</h3>
            {!isFilterSelected && <p className="team-filter-alert">{filterPromptText}</p>}

            {isFilterSelected && detailData.levelUpMoves?.length === 0 && (
              <p className="state-text">No level-up moves available for the selected game filter.</p>
            )}

            {isFilterSelected && detailData.levelUpMoves?.length > 0 && (
              <ul className="team-detail-list compact">
                {detailData.levelUpMoves.map((move) => (
                  <li key={`${selectedPokemon.id}-move-${move.moveName}`}>
                    <strong>Lv {move.level}:</strong> {move.moveName}
                    <span className="team-detail-meta"> ({move.versionGroupName})</span>
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
              <ul className="team-detail-list compact">
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
