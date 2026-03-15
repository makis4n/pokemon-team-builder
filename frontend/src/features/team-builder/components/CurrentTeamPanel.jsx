import { Link } from 'react-router-dom'

function CurrentTeamPanel({ team, teamLimit, statLabels, onRemoveFromTeam }) {
  const teamSlots = Array.from({ length: teamLimit }, (_, index) => team[index] ?? null)

  return (
    <section className="pixel-panel">
      <h2>Current Team ({team.length}/{teamLimit})</h2>

      <ul className="team-grid">
        {teamSlots.map((pokemon, index) => (
          pokemon ? (
            <li key={pokemon.id} className="team-entry">
              <div className="team-entry-sprite">
                <img src={pokemon.sprite} alt={pokemon.name} className="team-entry-sprite-image" />
              </div>
              <div className="team-entry-details">
                <div className="team-entry-head">
                  <h3>{pokemon.name}</h3>
                </div>

                <div className="type-badges compact" aria-label={`${pokemon.name} types`}>
                  {pokemon.types.map((type) => (
                    <span key={`${pokemon.id}-${type}`} className={`type-badge type-${type}`}>
                      {type}
                    </span>
                  ))}
                </div>

                <ul className="team-stats-inline">
                  {pokemon.stats.map((stat) => (
                    <li key={`${pokemon.id}-${stat.name}`}>
                      <span>{statLabels[stat.name] ?? stat.name}</span>
                      <strong>{stat.baseStat}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                className="remove-button inline"
                onClick={() => onRemoveFromTeam(pokemon.id)}
              >
                X
              </button>
            </li>
          ) : (
            <li key={`empty-slot-${index}`} className="team-entry placeholder">
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

      <Link
        to="/analysis"
        className={`analysis-nav-button ${team.length === 0 ? 'disabled' : ''}`}
        onClick={(event) => {
          if (team.length === 0) {
            event.preventDefault()
          }
        }}
      >
        Analyse Team
      </Link>
    </section>
  )
}

export default CurrentTeamPanel
