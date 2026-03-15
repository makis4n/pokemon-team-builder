import { useEffect, useMemo, useState } from 'react'
import './App.css'

const TEAM_LIMIT = 6

const statLabels = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  'special-attack': 'SP.ATK',
  'special-defense': 'SP.DEF',
  speed: 'SPD',
}

function formatAbilityList(abilities) {
  return abilities
    .map((ability) => (typeof ability === 'string' ? ability : ability.name))
    .join(', ')
}

async function fetchJson(url) {
  const response = await fetch(url)

  if (!response.ok) {
    const fallbackMessage = `Request failed with status ${response.status}`
    let message = fallbackMessage

    try {
      const payload = await response.json()
      if (payload?.error?.message) {
        message = payload.error.message
      }
    } catch {
      message = fallbackMessage
    }

    throw new Error(message)
  }

  return response.json()
}

function App() {
  const [allPokemon, setAllPokemon] = useState([])
  const [query, setQuery] = useState('')
  const [selectedPokemon, setSelectedPokemon] = useState(null)
  const [team, setTeam] = useState([])
  const [isListLoading, setIsListLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [detailError, setDetailError] = useState('')

  useEffect(() => {
    let isActive = true

    async function loadPokemonList() {
      setIsListLoading(true)
      setListError('')

      try {
        /* Limit to 9999 so that no special forms are shown */
        const payload = await fetchJson('/api/pokemon?limit=1025')
        if (!isActive) {
          return
        }
        setAllPokemon(payload.data ?? [])
      } catch (error) {
        if (!isActive) {
          return
        }
        setListError(error.message)
      } finally {
        if (isActive) {
          setIsListLoading(false)
        }
      }
    }

    loadPokemonList()

    return () => {
      isActive = false
    }
  }, [])

  const filteredPokemon = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return allPokemon.slice(0, 50)
    }

    return allPokemon
      .filter((pokemon) => pokemon.name.startsWith(normalizedQuery))
      .slice(0, 50)
  }, [allPokemon, query])

  const teamIds = useMemo(() => new Set(team.map((pokemon) => pokemon.id)), [team])

  async function loadPokemonDetail(nameOrId) {
    if (!nameOrId) {
      return
    }

    setIsDetailLoading(true)
    setDetailError('')

    try {
      const payload = await fetchJson(`/api/pokemon/${encodeURIComponent(nameOrId)}`)
      setSelectedPokemon(payload.data)
    } catch (error) {
      setDetailError(error.message)
    } finally {
      setIsDetailLoading(false)
    }
  }

  function handleAddToTeam() {
    if (!selectedPokemon) {
      return
    }

    if (team.length >= TEAM_LIMIT) {
      setDetailError('Your team is full. Remove one Pokemon first.')
      return
    }

    if (teamIds.has(selectedPokemon.id)) {
      setDetailError('This Pokemon is already in your team.')
      return
    }

    setTeam((currentTeam) => [...currentTeam, selectedPokemon])
    setDetailError('')
  }

  function handleRemoveFromTeam(pokemonId) {
    setTeam((currentTeam) => currentTeam.filter((pokemon) => pokemon.id !== pokemonId))
  }

  function handleExactSearch(event) {
    event.preventDefault()
    loadPokemonDetail(query.trim().toLowerCase())
  }

  return (
    <main className="app-shell">
      <header className="top-banner">
        <h1>Pokemon Team Builder</h1>
      </header>

      <section className="panel-grid">
        <section className="pixel-panel">
          <h2>Search or Select Pokemon</h2>

          <form className="search-form" onSubmit={handleExactSearch}>
            <input
              type="text"
              placeholder="e.g. pikachu"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit">Search</button>
          </form>

          {isListLoading && <p className="state-text">Loading Pokemon list...</p>}
          {listError && <p className="state-text error">{listError}</p>}

          {!isListLoading && !listError && (
            <ul className="pokemon-list">
              {filteredPokemon.length === 0 && (
                <li className="state-text">No Pokemon matched your search.</li>
              )}

              {filteredPokemon.map((pokemon) => (
                <li key={pokemon.id}>
                  <button
                    type="button"
                    className="pokemon-row"
                    onClick={() => loadPokemonDetail(pokemon.name)}
                  >
                    <span>#{String(pokemon.id).padStart(3, '0')}</span>
                    <strong>{pokemon.name}</strong>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pixel-panel">
          <h2>Pokemon Info</h2>

          {isDetailLoading && <p className="state-text">Loading details...</p>}
          {!isDetailLoading && detailError && <p className="state-text error">{detailError}</p>}

          {!isDetailLoading && !selectedPokemon && !detailError && (
            <p className="state-text">Choose a Pokemon from the left panel to inspect details.</p>
          )}

          {selectedPokemon && !isDetailLoading && (
            <article className="pokemon-card">
              <div className="pokemon-card-head">
                <img
                  src={selectedPokemon.sprite}
                  alt={selectedPokemon.name}
                  width="96"
                  height="96"
                />
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
                onClick={handleAddToTeam}
                disabled={team.length >= TEAM_LIMIT || teamIds.has(selectedPokemon.id)}
              >
                Add To Team
              </button>
            </article>
          )}
        </section>

        <section className="pixel-panel">
          <h2>Team Builder ({team.length}/{TEAM_LIMIT})</h2>

          {team.length === 0 && <p className="state-text">Your team is empty.</p>}

          <ul className="team-grid">
            {team.map((pokemon) => (
              <li key={pokemon.id} className="team-entry">
                <div className="team-entry-sprite">
                  <img src={pokemon.sprite} alt={pokemon.name} width="56" height="56" />
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
                <button type="button" className="remove-button inline" onClick={() => handleRemoveFromTeam(pokemon.id)}>
                  X
                </button>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  )
}

export default App
