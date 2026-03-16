import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPokemonTeamDetail } from '../features/team-builder/api'
import {
  DEFAULT_GAME_FILTER_KEY,
  GAME_FILTER_OPTION_BY_KEY,
} from '../features/team-builder/constants'
import { getSelectedGameFilterFromSession } from '../features/team-builder/storage'
import TeamPokemonDetailPanel from '../features/team-detail/components/TeamPokemonDetailPanel'
import TeamDetailCurrentTeamPanel from '../features/team-detail/components/TeamDetailCurrentTeamPanel'

const EVOLUTION_PREFETCH_HOVER_DELAY_MS = 180
const MAX_EVOLUTION_PREFETCH_CONCURRENCY = 2

function TeamDetailPage({ team, teamLimit }) {
  const [selectedPokemonId, setSelectedPokemonId] = useState(null)
  const [activePokemonQuery, setActivePokemonQuery] = useState(null)
  const [navigationStack, setNavigationStack] = useState([])
  const [detailData, setDetailData] = useState(null)
  const [detailDataQuery, setDetailDataQuery] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const prefetchedDetailKeysRef = useRef(new Set())
  const evolutionHoverTimersRef = useRef(new Map())
  const evolutionQueuedPrefetchKeysRef = useRef(new Set())
  const evolutionQueuedPrefetchTasksRef = useRef([])
  const evolutionInFlightPrefetchKeysRef = useRef(new Set())
  const evolutionInFlightPrefetchCountRef = useRef(0)

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
    evolutionHoverTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    evolutionHoverTimersRef.current.clear()
    evolutionQueuedPrefetchKeysRef.current.clear()
    evolutionQueuedPrefetchTasksRef.current = []
    evolutionInFlightPrefetchKeysRef.current.clear()
    evolutionInFlightPrefetchCountRef.current = 0
  }, [selectedGameFilterKey])

  useEffect(() => () => {
    evolutionHoverTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    evolutionHoverTimersRef.current.clear()
  }, [])

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

  const displayedPokemon = useMemo(() => {
    if (detailDataQuery === String(activePokemonQuery)) {
      return detailData?.pokemon ?? selectedPokemon
    }

    // Preserve the last successful card when an inspect target fails (e.g., unavailable in filter).
    if (detailError && detailData?.pokemon) {
      return detailData.pokemon
    }

    return selectedPokemon
  }, [activePokemonQuery, detailData, detailDataQuery, detailError, selectedPokemon])

  const activeDetailData = useMemo(() => {
    if (detailDataQuery === String(activePokemonQuery)) {
      return detailData
    }

    if (detailError && detailData) {
      return detailData
    }

    return null
  }, [activePokemonQuery, detailData, detailDataQuery, detailError])

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

  function pumpEvolutionPrefetchQueue() {
    while (
      evolutionInFlightPrefetchCountRef.current < MAX_EVOLUTION_PREFETCH_CONCURRENCY
      && evolutionQueuedPrefetchTasksRef.current.length > 0
    ) {
      const nextTask = evolutionQueuedPrefetchTasksRef.current.shift()
      if (!nextTask) {
        return
      }

      evolutionInFlightPrefetchCountRef.current += 1
      evolutionInFlightPrefetchKeysRef.current.add(nextTask.prefetchKey)

      void nextTask.run()
        .catch(() => {
          // Ignore evolution hover prefetch failures; explicit click handles errors.
        })
        .finally(() => {
          evolutionInFlightPrefetchCountRef.current -= 1
          evolutionInFlightPrefetchKeysRef.current.delete(nextTask.prefetchKey)
          evolutionQueuedPrefetchKeysRef.current.delete(nextTask.prefetchKey)
          pumpEvolutionPrefetchQueue()
        })
    }
  }

  function enqueueEvolutionPreviewPrefetch(nextPokemonIdOrName) {
    const normalizedQuery = String(nextPokemonIdOrName || '').trim().toLowerCase()
    if (!normalizedQuery || !isFilterSelected) {
      return
    }

    const prefetchKey = `${selectedGameFilterKey}:${normalizedQuery}`
    if (
      prefetchedDetailKeysRef.current.has(prefetchKey)
      || evolutionQueuedPrefetchKeysRef.current.has(prefetchKey)
      || evolutionInFlightPrefetchKeysRef.current.has(prefetchKey)
    ) {
      return
    }

    evolutionQueuedPrefetchKeysRef.current.add(prefetchKey)
    evolutionQueuedPrefetchTasksRef.current.push({
      prefetchKey,
      run: async () => {
        await fetchPokemonTeamDetail(nextPokemonIdOrName, selectedGameFilterKey, {
          includeMoveDetails: false,
        })
        prefetchedDetailKeysRef.current.add(prefetchKey)
      },
    })
    pumpEvolutionPrefetchQueue()
  }

  function handleEvolutionPreviewStart(nextPokemonIdOrName) {
    const normalizedQuery = String(nextPokemonIdOrName || '').trim().toLowerCase()
    if (!normalizedQuery) {
      return
    }

    if (evolutionHoverTimersRef.current.has(normalizedQuery)) {
      return
    }

    const timerId = window.setTimeout(() => {
      evolutionHoverTimersRef.current.delete(normalizedQuery)
      enqueueEvolutionPreviewPrefetch(nextPokemonIdOrName)
    }, EVOLUTION_PREFETCH_HOVER_DELAY_MS)

    evolutionHoverTimersRef.current.set(normalizedQuery, timerId)
  }

  function handleEvolutionPreviewCancel(nextPokemonIdOrName) {
    const normalizedQuery = String(nextPokemonIdOrName || '').trim().toLowerCase()
    const timerId = evolutionHoverTimersRef.current.get(normalizedQuery)
    if (!timerId) {
      return
    }

    window.clearTimeout(timerId)
    evolutionHoverTimersRef.current.delete(normalizedQuery)
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
          onEvolutionPreviewStart={handleEvolutionPreviewStart}
          onEvolutionPreviewCancel={handleEvolutionPreviewCancel}
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
