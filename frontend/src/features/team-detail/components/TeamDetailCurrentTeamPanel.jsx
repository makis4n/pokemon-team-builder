import { Link } from 'react-router-dom'
import { statLabels } from '../../team-builder/constants'

function TeamDetailCurrentTeamPanel({
  team,
  teamLimit,
  selectedPokemonId,
  onSelectPokemon,
}) {
  const teamSlots = Array.from({ length: teamLimit }, (_, index) => team[index] ?? null)

  return (
    <section className="pixel-panel">
      <h2>Current Team ({team.length}/{teamLimit})</h2>

      <ul className="team-grid">
        {teamSlots.map((pokemon, index) => (
          pokemon ? (
            <li
              key={pokemon.id}
              className={`team-entry selectable ${selectedPokemonId === pokemon.id ? 'selected' : ''}`}
            >
              <button
                type="button"
                className="team-entry-select-button"
                onClick={() => onSelectPokemon(pokemon.id)}
              >
                <div className="team-entry-sprite">
                  <img src={pokemon.sprite} alt={pokemon.name} className="team-entry-sprite-image" />
                </div>
                <div className="team-entry-details">
                  <div className="team-entry-head">
                    <h3>{pokemon.name}</h3>
                  </div>

                  <div className="type-badges compact" aria-label={`${pokemon.name} types`}>
                    {pokemon.types.map((type) => (
                      <span key={`${pokemon.id}-team-detail-${type}`} className={`type-badge type-${type}`}>
                        {type}
                      </span>
                    ))}
                  </div>

                  <ul className="team-stats-inline">
                    {pokemon.stats.map((stat) => (
                      <li key={`${pokemon.id}-team-detail-${stat.name}`}>
                        <span>{statLabels[stat.name] ?? stat.name}</span>
                        <strong>{stat.baseStat}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            </li>
          ) : (
            <li key={`team-detail-empty-${index}`} className="team-entry placeholder">
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

      <div className="team-detail-nav-row">
        <Link to="/analysis" className="analysis-nav-button">Team Analysis</Link>
        <Link to="/" className="analysis-nav-button">Team Builder</Link>
      </div>
    </section>
  )
}

export default TeamDetailCurrentTeamPanel
