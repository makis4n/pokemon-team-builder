import { useEffect, useMemo, useState } from 'react'
import { fetchPokemonDetail, fetchPokemonList } from '../features/team-builder/api'
import { statLabels } from '../features/team-builder/constants'
import CurrentTeamPanel from '../features/team-builder/components/CurrentTeamPanel'
import PokemonInfoPanel from '../features/team-builder/components/PokemonInfoPanel'
import PokemonSelectorPanel from '../features/team-builder/components/PokemonSelectorPanel'

function TeamBuilderPage({ team, teamLimit, onAddPokemonToTeam, onRemovePokemonFromTeam }) {
  const [allPokemon, setAllPokemon] = useState([])
  const [query, setQuery] = useState('')
  const [selectedPokemon, setSelectedPokemon] = useState(null)
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
        const payload = await fetchPokemonList(1025)

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
      const payload = await fetchPokemonDetail(nameOrId)
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

    const result = onAddPokemonToTeam(selectedPokemon)

    if (result?.ok) {
      setDetailError('')
      return
    }

    setDetailError(result?.message ?? 'Could not add Pokemon to team.')
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
        <PokemonSelectorPanel
          query={query}
          onQueryChange={setQuery}
          onSearchSubmit={handleExactSearch}
          isListLoading={isListLoading}
          listError={listError}
          filteredPokemon={filteredPokemon}
          onPokemonSelect={loadPokemonDetail}
        />

        <PokemonInfoPanel
          selectedPokemon={selectedPokemon}
          isDetailLoading={isDetailLoading}
          detailError={detailError}
          onAddToTeam={handleAddToTeam}
          teamCount={team.length}
          teamLimit={teamLimit}
          isInTeam={selectedPokemon ? teamIds.has(selectedPokemon.id) : false}
          statLabels={statLabels}
        />

        <CurrentTeamPanel
          team={team}
          teamLimit={teamLimit}
          statLabels={statLabels}
          onRemoveFromTeam={onRemovePokemonFromTeam}
        />
      </section>
    </main>
  )
}

export default TeamBuilderPage
