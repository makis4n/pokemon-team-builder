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
  return (
    <section className="pixel-panel">
      <h2>Select Pokemon</h2>

      <div className="game-filter-wrap">
        <label htmlFor="game-filter-select" className="game-filter-label">Game Filter</label>
        <select
          id="game-filter-select"
          className="game-filter-select"
          value={selectedGameFilterKey}
          onChange={(event) => onGameFilterChange(event.target.value)}
        >
          {gameFilterOptions.map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
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
