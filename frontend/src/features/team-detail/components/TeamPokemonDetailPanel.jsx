import { useEffect, useState } from 'react'
import { fetchMoveDetail } from '../../team-builder/api'

function TeamPokemonDetailPanel({
  isFilterSelected,
  selectedPokemon,
  detailData,
  isLoading,
  loadingTargetLabel,
  error,
  canGoBack,
  onGoBack,
  onInspectPokemon,
}) {
  const filterPromptText = 'Select a filter to view Pokemon details.'
  const isAvailabilityError = String(error || '').toLowerCase().includes('not available in the selected game filter')
  const pokedexDescription = detailData?.pokedexDescription
    || (isFilterSelected
      ? 'No Pokedex description available for this Pokemon.'
      : 'Select a filter to view this Pokemon\'s Pokedex description.')
  const abilityEffectsByName = detailData?.abilityEffectsByName || {}
  const detailPayload = detailData || {}
  const shouldRenderContent = !isFilterSelected || Boolean(detailData) || isLoading || !error
  const [moveDetailByRawName, setMoveDetailByRawName] = useState({})
  const [moveDetailsLoadingByRawName, setMoveDetailsLoadingByRawName] = useState({})

  useEffect(() => {
    setMoveDetailByRawName({})
    setMoveDetailsLoadingByRawName({})
  }, [selectedPokemon?.id, detailData])

  if (!selectedPokemon) {
    return (
      <section className="pixel-panel">
        <h2>Pokemon Details</h2>
        <p className="state-text">Select a Pokemon from your current team to view detailed info.</p>
      </section>
    )
  }

  function formatDisplayName(value) {
    return String(value || '')
      .split('-')
      .map((chunk) => (chunk ? chunk[0].toUpperCase() + chunk.slice(1) : chunk))
      .join(' ')
  }

  function getMoveRawName(move) {
    if (move?.moveRawName) {
      return String(move.moveRawName).toLowerCase()
    }

    return String(move?.moveName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
  }

  async function ensureMoveDetailLoaded(move) {
    const moveRawName = getMoveRawName(move)
    if (!moveRawName) {
      return
    }

    if (moveDetailByRawName[moveRawName] || moveDetailsLoadingByRawName[moveRawName]) {
      return
    }

    setMoveDetailsLoadingByRawName((current) => ({
      ...current,
      [moveRawName]: true,
    }))

    try {
      const payload = await fetchMoveDetail(moveRawName)
      setMoveDetailByRawName((current) => ({
        ...current,
        [moveRawName]: payload?.data ?? null,
      }))
    } catch {
      setMoveDetailByRawName((current) => ({
        ...current,
        [moveRawName]: null,
      }))
    } finally {
      setMoveDetailsLoadingByRawName((current) => ({
        ...current,
        [moveRawName]: false,
      }))
    }
  }

  return (
    <section className="pixel-panel">
      <h2>Pokemon Details</h2>

      {isFilterSelected && isLoading && (
        <p className="state-text">
          {loadingTargetLabel
            ? `Loading ${loadingTargetLabel}...`
            : 'Loading detailed info...'}
        </p>
      )}
      {isFilterSelected && !isLoading && error && (
        <p className="state-text error">
          {isAvailabilityError
            ? `Pokemon unavailable for this filter: ${error}`
            : error}
        </p>
      )}

      {shouldRenderContent && (
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

            {isFilterSelected && !detailPayload.evolution?.from && (!detailPayload.evolution?.to || detailPayload.evolution.to.length === 0) && (
              <p className="state-text">No evolution data available.</p>
            )}

            {isFilterSelected && detailPayload.evolution?.from && (
              <ul className="team-detail-list team-static-list">
                <li>
                  <button
                    type="button"
                    className="team-static-entry-button"
                    onClick={() => onInspectPokemon(detailPayload.evolution.from.speciesId || detailPayload.evolution.from.speciesName)}
                  >
                    <strong>Evolves from:</strong> {detailPayload.evolution.from.speciesName} ({detailPayload.evolution.from.condition})
                  </button>
                </li>
              </ul>
            )}

            {isFilterSelected && detailPayload.evolution?.to?.length > 0 && (
              <ul className="team-detail-list team-static-list">
                {detailPayload.evolution.to.map((entry) => (
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

            {isFilterSelected && detailPayload.levelUpMoves?.length === 0 && (
              <p className="state-text">No moves available for the selected game filter.</p>
            )}

            {isFilterSelected && detailPayload.levelUpMoves?.length > 0 && (
              <ul className="team-detail-list team-move-list">
                {detailPayload.levelUpMoves.map((move) => {
                  const moveRawName = getMoveRawName(move)
                  const lazyMoveDetail = moveDetailByRawName[moveRawName]
                  const isMoveDetailLoading = Boolean(moveDetailsLoadingByRawName[moveRawName])
                  const resolvedMove = {
                    ...move,
                    moveType: move.moveType ?? lazyMoveDetail?.moveType ?? null,
                    category: move.category ?? lazyMoveDetail?.category ?? null,
                    basePower: move.basePower ?? lazyMoveDetail?.basePower ?? null,
                    accuracy: move.accuracy ?? lazyMoveDetail?.accuracy ?? null,
                    pp: move.pp ?? lazyMoveDetail?.pp ?? null,
                    flavorText: move.flavorText ?? lazyMoveDetail?.flavorText ?? null,
                    effectText: move.effectText ?? lazyMoveDetail?.effectText ?? null,
                  }

                  return (
                    <li key={`${selectedPokemon.id}-move-${move.moveName}`} className="team-move-entry">
                      <details
                        className="team-move-dropdown"
                        onToggle={(event) => {
                          if (event.currentTarget.open) {
                            void ensureMoveDetailLoaded(move)
                          }
                        }}
                      >
                        <summary className="team-move-row">
                          <span>
                            <strong>Lv {resolvedMove.level}:</strong> {resolvedMove.moveName}
                          </span>
                          <span className="team-move-summary-right">
                            <span className="team-move-arrow" aria-hidden="true" />
                          </span>
                        </summary>
                        <div className="team-move-expanded">
                          <section className="team-move-panel" aria-label="Move effect panel">
                            <div className="team-move-panel-title-row">
                              <p className="team-move-panel-title">Effect</p>
                              {resolvedMove.moveType && (
                                <span className={`type-badge team-move-panel-type-badge type-${resolvedMove.moveType}`}>
                                  {resolvedMove.moveType}
                                </span>
                              )}
                            </div>
                            {isMoveDetailLoading && <p className="team-detail-meta">Loading move details...</p>}
                            <ul className="team-move-meta-list" aria-label="Move stats">
                              <li><span>Category</span><strong>{resolvedMove.category || 'Unknown'}</strong></li>
                              <li><span>Power</span><strong>{resolvedMove.basePower ?? 'N/A'}</strong></li>
                              <li><span>Accuracy</span><strong>{resolvedMove.accuracy ?? 'N/A'}</strong></li>
                              <li><span>PP</span><strong>{resolvedMove.pp ?? 'N/A'}</strong></li>
                            </ul>
                          </section>

                          <section className="team-move-panel team-move-description-panel" aria-label="Move description panel">
                            <p className="team-move-panel-title">Description</p>
                            <p className="team-move-flavor">{resolvedMove.flavorText || 'No flavor text available.'}</p>
                            <p className="team-move-effect">{resolvedMove.effectText || 'No move effect description available.'}</p>
                          </section>
                        </div>
                      </details>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="team-detail-section">
            <h3>Encounter Locations</h3>
            {!isFilterSelected && <p className="team-filter-alert">{filterPromptText}</p>}

            {isFilterSelected && detailPayload.encounters?.length === 0 && (
              <p className="state-text">No encounter location data for the selected game filter.</p>
            )}

            {isFilterSelected && detailPayload.encounters?.length > 0 && (
              <ul className="team-detail-list compact team-static-list">
                {detailPayload.encounters.map((encounter) => (
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
