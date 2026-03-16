import { useEffect, useMemo, useRef, useState } from 'react'

function PokemonSelectorPanel({
  query,
  onQueryChange,
  onSearchSubmit,
  gameFilterOptions,
  selectedGameFilterKey,
  onGameFilterChange,
  isListLoading,
  listError,
  filteredPokemon,
  onPokemonSelect,
}) {
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const filterMenuRef = useRef(null)

  const selectedFilterLabel = useMemo(() => {
    const selectedOption = gameFilterOptions.find((option) => option.key === selectedGameFilterKey)
    return selectedOption?.label ?? gameFilterOptions[0]?.label ?? 'Select filter'
  }, [gameFilterOptions, selectedGameFilterKey])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!filterMenuRef.current?.contains(event.target)) {
        setIsFilterMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  function handleFilterSelect(nextFilterKey) {
    onGameFilterChange(nextFilterKey)
    setIsFilterMenuOpen(false)
  }

  return (
    <section className="pixel-panel">
      <h2>Select Pokemon</h2>

      <div className="game-filter-wrap">
        <span className="game-filter-label">Game Filter</span>
        <div className="game-filter-menu" ref={filterMenuRef}>
          <button
            type="button"
            className="game-filter-trigger"
            aria-haspopup="listbox"
            aria-expanded={isFilterMenuOpen}
            onClick={() => setIsFilterMenuOpen((value) => !value)}
          >
            <span className="game-filter-trigger-label">{selectedFilterLabel}</span>
            <span className="game-filter-trigger-arrow" aria-hidden="true">▾</span>
          </button>

          {isFilterMenuOpen && (
            <ul className="game-filter-options" role="listbox" aria-label="Game filter options">
              {gameFilterOptions.map((option) => (
                <li key={option.key} role="option" aria-selected={option.key === selectedGameFilterKey}>
                  <button
                    type="button"
                    className={`game-filter-option ${option.key === selectedGameFilterKey ? 'selected' : ''}`}
                    onClick={() => handleFilterSelect(option.key)}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <form className="search-form" onSubmit={onSearchSubmit}>
        <input
          type="text"
          placeholder="e.g. pikachu"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
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
                onClick={() => onPokemonSelect(pokemon.name)}
              >
                <span>#{String(pokemon.id).padStart(3, '0')}</span>
                <strong>{pokemon.name}</strong>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default PokemonSelectorPanel
