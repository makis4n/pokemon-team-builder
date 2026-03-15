import { Link } from 'react-router-dom'
import { statLabels } from '../../team-builder/constants'

function AnalysisCurrentTeamPanel({ team, teamLimit, teamSlots, roleByPokemonId }) {
  return (
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
  )
}

export default AnalysisCurrentTeamPanel
