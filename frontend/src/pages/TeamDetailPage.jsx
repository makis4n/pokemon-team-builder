import { useEffect, useMemo, useState } from 'react'
import { fetchPokemonTeamDetail } from '../features/team-builder/api'
import {
  DEFAULT_GAME_FILTER_KEY,
  GAME_FILTER_OPTION_BY_KEY,
} from '../features/team-builder/constants'
import { getSelectedGameFilterFromSession } from '../features/team-builder/storage'
import TeamPokemonDetailPanel from '../features/team-detail/components/TeamPokemonDetailPanel'
import TeamDetailCurrentTeamPanel from '../features/team-detail/components/TeamDetailCurrentTeamPanel'

function TeamDetailPage({ team, teamLimit }) {
  const [selectedPokemonId, setSelectedPokemonId] = useState(null)
  const [activePokemonQuery, setActivePokemonQuery] = useState(null)
  const [navigationStack, setNavigationStack] = useState([])
  const [detailData, setDetailData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const selectedGameFilterKey = getSelectedGameFilterFromSession()
  const isFilterSelected = selectedGameFilterKey !== DEFAULT_GAME_FILTER_KEY
  const selectedGameFilter = GAME_FILTER_OPTION_BY_KEY[selectedGameFilterKey]
    ?? GAME_FILTER_OPTION_BY_KEY[DEFAULT_GAME_FILTER_KEY]

  useEffect(() => {
    if (team.length === 0) {
      setSelectedPokemonId(null)
      setDetailData(null)
      setDetailError('')
      setIsLoading(false)
      return
    }

    if (!selectedPokemonId || !team.some((pokemon) => pokemon.id === selectedPokemonId)) {
      setSelectedPokemonId(team[0].id)
      setActivePokemonQuery(team[0].id)
      setNavigationStack([])
    }
  }, [selectedPokemonId, team])

  useEffect(() => {
    if (!selectedPokemonId) {
      return
    }

    setActivePokemonQuery(selectedPokemonId)
    setNavigationStack([])
  }, [selectedPokemonId])

  useEffect(() => {
    if (!isFilterSelected) {
      setDetailData(null)
      setDetailError('')
      setIsLoading(false)
      return
    }

    if (!activePokemonQuery) {
      return
    }

    let isActive = true

    async function loadDetail() {
      setIsLoading(true)
      setDetailError('')

      try {
        const payload = await fetchPokemonTeamDetail(activePokemonQuery, selectedGameFilterKey)

        if (!isActive) {
          return
        }

        setDetailData(payload.data ?? null)
      } catch (error) {
        if (!isActive) {
          return
        }

        setDetailData(null)
        setDetailError(error.message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadDetail()

    return () => {
      isActive = false
    }
  }, [activePokemonQuery, isFilterSelected, selectedGameFilterKey, team])

  const selectedPokemon = useMemo(
    () => team.find((pokemon) => pokemon.id === selectedPokemonId) ?? null,
    [selectedPokemonId, team],
  )

  const displayedPokemon = useMemo(
    () => detailData?.pokemon ?? selectedPokemon,
    [detailData, selectedPokemon],
  )

  function handleInspectPokemon(nextPokemonIdOrName) {
    if (!nextPokemonIdOrName || !isFilterSelected) {
      return
    }

    setNavigationStack((current) => [...current, activePokemonQuery])
    setActivePokemonQuery(nextPokemonIdOrName)
  }

  function handleGoBack() {
    setNavigationStack((current) => {
      if (!current.length) {
        return current
      }

      const previousQuery = current[current.length - 1]
      setActivePokemonQuery(previousQuery)
      return current.slice(0, -1)
    })
  }

  return (
    <main className="app-shell">
      <header className="top-banner">
        <h1>Team Details</h1>
        <p>{selectedGameFilter.label}</p>
      </header>

      <section className="analysis-grid team-detail-grid">
        <TeamPokemonDetailPanel
          isFilterSelected={isFilterSelected}
          selectedPokemon={displayedPokemon}
          detailData={detailData}
          isLoading={isLoading}
          error={detailError}
          canGoBack={navigationStack.length > 0}
          onGoBack={handleGoBack}
          onInspectPokemon={handleInspectPokemon}
        />

        <TeamDetailCurrentTeamPanel
          team={team}
          teamLimit={teamLimit}
          selectedPokemonId={selectedPokemonId}
          onSelectPokemon={setSelectedPokemonId}
        />
      </section>
    </main>
  )
}

export default TeamDetailPage
