import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [detailDataQuery, setDetailDataQuery] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const prefetchedDetailKeysRef = useRef(new Set())

  const selectedGameFilterKey = getSelectedGameFilterFromSession()
  const isFilterSelected = selectedGameFilterKey !== DEFAULT_GAME_FILTER_KEY
  const selectedGameFilter = GAME_FILTER_OPTION_BY_KEY[selectedGameFilterKey]
    ?? GAME_FILTER_OPTION_BY_KEY[DEFAULT_GAME_FILTER_KEY]

  function toDisplayName(value) {
    return String(value || '')
      .split('-')
      .map((chunk) => (chunk ? chunk[0].toUpperCase() + chunk.slice(1) : chunk))
      .join(' ')
  }

  useEffect(() => {
    if (team.length === 0) {
      setSelectedPokemonId(null)
      setDetailData(null)
      setDetailDataQuery(null)
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
    prefetchedDetailKeysRef.current = new Set()
  }, [selectedGameFilterKey])

  useEffect(() => {
    if (!isFilterSelected) {
      setDetailData(null)
      setDetailDataQuery(null)
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
        const payload = await fetchPokemonTeamDetail(activePokemonQuery, selectedGameFilterKey, {
          includeMoveDetails: false,
        })

        if (!isActive) {
          return
        }

        const resolvedDetail = payload.data ?? null
        setDetailData(resolvedDetail)
        setDetailDataQuery(String(activePokemonQuery))

        if (resolvedDetail?.pokemon?.id) {
          prefetchedDetailKeysRef.current.add(`${selectedGameFilterKey}:${resolvedDetail.pokemon.id}`)
        }

        const teamPrefetchRequests = []
        for (const teammate of team) {
          const teammateId = Number(teammate?.id || 0)
          if (!Number.isFinite(teammateId) || teammateId <= 0) {
            continue
          }

          if (resolvedDetail?.pokemon?.id === teammateId) {
            continue
          }

          const teammateCacheKey = `${selectedGameFilterKey}:${teammateId}`
          if (prefetchedDetailKeysRef.current.has(teammateCacheKey)) {
            continue
          }

          prefetchedDetailKeysRef.current.add(teammateCacheKey)
          teamPrefetchRequests.push(fetchPokemonTeamDetail(teammateId, selectedGameFilterKey, {
            includeMoveDetails: false,
          }))
        }

        if (teamPrefetchRequests.length > 0) {
          void Promise.allSettled(teamPrefetchRequests)
        }
      } catch (error) {
        if (!isActive) {
          return
        }

        const isInspectingNonSelectedTarget = String(activePokemonQuery) !== String(selectedPokemonId)
        if (!isInspectingNonSelectedTarget) {
          setDetailData(null)
          setDetailDataQuery(null)
        }
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
  }, [activePokemonQuery, isFilterSelected, selectedGameFilterKey, selectedPokemonId, team])

  const selectedPokemon = useMemo(
    () => team.find((pokemon) => pokemon.id === selectedPokemonId) ?? null,
    [selectedPokemonId, team],
  )

  const displayedPokemon = useMemo(
    () => (detailDataQuery === String(activePokemonQuery) ? detailData?.pokemon : null) ?? selectedPokemon,
    [activePokemonQuery, detailData, detailDataQuery, selectedPokemon],
  )

  const activeDetailData = useMemo(
    () => (detailDataQuery === String(activePokemonQuery) ? detailData : null),
    [activePokemonQuery, detailData, detailDataQuery],
  )

  const loadingTargetLabel = useMemo(() => {
    if (!isLoading || !activePokemonQuery) {
      return ''
    }

    const activeQueryAsNumber = Number(activePokemonQuery)
    if (Number.isFinite(activeQueryAsNumber) && activeQueryAsNumber > 0) {
      const matchedTeamPokemon = team.find((pokemon) => pokemon.id === activeQueryAsNumber)
      if (matchedTeamPokemon?.name) {
        return toDisplayName(matchedTeamPokemon.name)
      }
    }

    return toDisplayName(activePokemonQuery)
  }, [activePokemonQuery, isLoading, team])

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
          detailData={activeDetailData}
          isLoading={isLoading}
          loadingTargetLabel={loadingTargetLabel}
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
