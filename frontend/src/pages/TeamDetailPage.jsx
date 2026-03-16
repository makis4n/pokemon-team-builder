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
    }
  }, [selectedPokemonId, team])

  useEffect(() => {
    if (!isFilterSelected) {
      setDetailData(null)
      setDetailError('')
      setIsLoading(false)
      return
    }

    if (!selectedPokemonId) {
      return
    }

    const selectedPokemon = team.find((pokemon) => pokemon.id === selectedPokemonId)
    if (!selectedPokemon) {
      return
    }

    let isActive = true

    async function loadDetail() {
      setIsLoading(true)
      setDetailError('')

      try {
        const payload = await fetchPokemonTeamDetail(selectedPokemon.id, selectedGameFilterKey)

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
  }, [isFilterSelected, selectedGameFilterKey, selectedPokemonId, team])

  const selectedPokemon = useMemo(
    () => team.find((pokemon) => pokemon.id === selectedPokemonId) ?? null,
    [selectedPokemonId, team],
  )

  return (
    <main className="app-shell">
      <header className="top-banner">
        <h1>Team Details</h1>
        <p>{selectedGameFilter.label}</p>
      </header>

      <section className="analysis-grid team-detail-grid">
        <TeamPokemonDetailPanel
          isFilterSelected={isFilterSelected}
          selectedPokemon={selectedPokemon}
          detailData={detailData}
          isLoading={isLoading}
          error={detailError}
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
