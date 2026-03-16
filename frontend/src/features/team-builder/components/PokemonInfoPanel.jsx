import { formatAbilityList } from '../formatters'

function PokemonInfoPanel({
  selectedPokemon,
  isDetailLoading,
  loadingTargetLabel,
  detailError,
  onAddToTeam,
  teamCount,
  teamLimit,
  isInTeam,
  statLabels,
}) {
  return (
    <section className="pixel-panel">
      <h2>Pokemon Info</h2>

      {isDetailLoading && (
        <p className="state-text">
          {loadingTargetLabel
            ? `Loading ${loadingTargetLabel}...`
            : 'Loading details...'}
        </p>
      )}
      {!isDetailLoading && detailError && <p className="state-text error">{detailError}</p>}

      {!isDetailLoading && !selectedPokemon && !detailError && (
        <p className="state-text">Choose a Pokemon from the left panel to inspect details.</p>
      )}

      {selectedPokemon && (
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
              <p>#{String(selectedPokemon.id).padStart(3, '0')}</p>
            </div>
          </div>

          <p>
            <span className="label">Types:</span>
          </p>
          <div className="type-badges" aria-label="Pokemon types">
            {selectedPokemon.types.map((type) => (
              <span key={type} className={`type-badge type-${type}`}>
                {type}
              </span>
            ))}
          </div>
          <p>
            <span className="label">Abilities:</span> {formatAbilityList(selectedPokemon.abilities)}
          </p>

          <h4>Base Stats</h4>
          <ul className="stats-list">
            {selectedPokemon.stats.map((stat) => (
              <li key={stat.name}>
                <span>{statLabels[stat.name] ?? stat.name}</span>
                <strong>{stat.baseStat}</strong>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="add-button"
            onClick={onAddToTeam}
            disabled={teamCount >= teamLimit || isInTeam}
          >
            Add To Team
          </button>
        </article>
      )}
    </section>
  )
}

export default PokemonInfoPanel
