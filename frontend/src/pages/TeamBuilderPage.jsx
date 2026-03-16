import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPokemonDetail, fetchPokemonList } from '../features/team-builder/api'
import {
  DEFAULT_GAME_FILTER_KEY,
  GAME_FILTER_OPTIONS,
  statLabels,
} from '../features/team-builder/constants'
import {
  getSelectedGameFilterFromSession,
  saveSelectedGameFilterToSession,
} from '../features/team-builder/storage'
import CurrentTeamPanel from '../features/team-builder/components/CurrentTeamPanel'
import PokemonInfoPanel from '../features/team-builder/components/PokemonInfoPanel'
import PokemonSelectorPanel from '../features/team-builder/components/PokemonSelectorPanel'

const DETAIL_PREFETCH_HOVER_DELAY_MS = 180
const MAX_DETAIL_PREFETCH_CONCURRENCY = 2

function TeamBuilderPage({ team, teamLimit, onAddPokemonToTeam, onRemovePokemonFromTeam }) {
  const [allPokemon, setAllPokemon] = useState([])
  const [selectedGameFilterKey, setSelectedGameFilterKey] = useState(() => getSelectedGameFilterFromSession())
  const [query, setQuery] = useState('')
  const [selectedPokemon, setSelectedPokemon] = useState(null)
  const [isListLoading, setIsListLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [loadingTargetLabel, setLoadingTargetLabel] = useState('')
  const prefetchedDetailKeysRef = useRef(new Set())
  const hoverPrefetchTimersRef = useRef(new Map())
  const queuedPrefetchKeysRef = useRef(new Set())
  const queuedPrefetchTasksRef = useRef([])
  const inFlightPrefetchKeysRef = useRef(new Set())
  const inFlightPrefetchCountRef = useRef(0)

  function toDisplayName(value) {
    return String(value || '')
      .split('-')
      .map((chunk) => (chunk ? chunk[0].toUpperCase() + chunk.slice(1) : chunk))
      .join(' ')
  }

  useEffect(() => {
    saveSelectedGameFilterToSession(selectedGameFilterKey)
  }, [selectedGameFilterKey])

  useEffect(() => {
    prefetchedDetailKeysRef.current = new Set()
    hoverPrefetchTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    hoverPrefetchTimersRef.current.clear()
    queuedPrefetchKeysRef.current.clear()
    queuedPrefetchTasksRef.current = []
    inFlightPrefetchKeysRef.current.clear()
    inFlightPrefetchCountRef.current = 0
  }, [selectedGameFilterKey])

  useEffect(() => () => {
    hoverPrefetchTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    hoverPrefetchTimersRef.current.clear()
  }, [])

  useEffect(() => {
    let isActive = true

    async function loadPokemonList() {
      setIsListLoading(true)
      setListError('')

      try {
        /* Limit to 9999 so that no special forms are shown */
        const payload = await fetchPokemonList(1025, 0, selectedGameFilterKey)

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
  }, [selectedGameFilterKey])

  const filteredPokemon = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const queryFilteredPokemon = normalizedQuery
      ? allPokemon.filter((pokemon) => pokemon.name.startsWith(normalizedQuery))
      : allPokemon

    if (selectedGameFilterKey === DEFAULT_GAME_FILTER_KEY) {
      return queryFilteredPokemon.slice(0, 50)
    }

    return queryFilteredPokemon
  }, [allPokemon, query, selectedGameFilterKey])

  const teamIds = useMemo(() => new Set(team.map((pokemon) => pokemon.id)), [team])

  async function loadPokemonDetail(nameOrId) {
    if (!nameOrId) {
      return
    }

    setIsDetailLoading(true)
    setDetailError('')
    setLoadingTargetLabel(toDisplayName(nameOrId))

    try {
      const payload = await fetchPokemonDetail(nameOrId)
      const nextPokemon = payload.data

      setSelectedPokemon(nextPokemon)
    } catch (error) {
      setDetailError(error.message)
    } finally {
      setIsDetailLoading(false)
      setLoadingTargetLabel('')
    }
  }

  function pumpPrefetchQueue() {
    while (
      inFlightPrefetchCountRef.current < MAX_DETAIL_PREFETCH_CONCURRENCY
      && queuedPrefetchTasksRef.current.length > 0
    ) {
      const nextTask = queuedPrefetchTasksRef.current.shift()
      if (!nextTask) {
        return
      }

      inFlightPrefetchCountRef.current += 1
      inFlightPrefetchKeysRef.current.add(nextTask.normalizedKey)

      void nextTask.run()
        .catch(() => {
          // Ignore prefetch failures and let explicit selection handle errors.
        })
        .finally(() => {
          inFlightPrefetchCountRef.current -= 1
          inFlightPrefetchKeysRef.current.delete(nextTask.normalizedKey)
          queuedPrefetchKeysRef.current.delete(nextTask.normalizedKey)
          pumpPrefetchQueue()
        })
    }
  }

  function enqueuePokemonDetailPrefetch(nameOrId) {
    const normalizedKey = String(nameOrId || '').trim().toLowerCase()
    if (
      !normalizedKey
      || prefetchedDetailKeysRef.current.has(normalizedKey)
      || queuedPrefetchKeysRef.current.has(normalizedKey)
      || inFlightPrefetchKeysRef.current.has(normalizedKey)
    ) {
      return
    }

    queuedPrefetchKeysRef.current.add(normalizedKey)
    queuedPrefetchTasksRef.current.push({
      normalizedKey,
      run: async () => {
        await fetchPokemonDetail(normalizedKey)
        prefetchedDetailKeysRef.current.add(normalizedKey)
      },
    })
    pumpPrefetchQueue()
  }

  function schedulePokemonDetailPreview(nameOrId) {
    const normalizedKey = String(nameOrId || '').trim().toLowerCase()
    if (!normalizedKey) {
      return
    }

    if (hoverPrefetchTimersRef.current.has(normalizedKey)) {
      return
    }

    const timerId = window.setTimeout(() => {
      hoverPrefetchTimersRef.current.delete(normalizedKey)
      enqueuePokemonDetailPrefetch(normalizedKey)
    }, DETAIL_PREFETCH_HOVER_DELAY_MS)

    hoverPrefetchTimersRef.current.set(normalizedKey, timerId)
  }

  function cancelPokemonDetailPreview(nameOrId) {
    const normalizedKey = String(nameOrId || '').trim().toLowerCase()
    const timerId = hoverPrefetchTimersRef.current.get(normalizedKey)
    if (!timerId) {
      return
    }

    window.clearTimeout(timerId)
    hoverPrefetchTimersRef.current.delete(normalizedKey)
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

  function handleGameFilterChange(nextGameFilterKey) {
    setSelectedGameFilterKey(nextGameFilterKey)
    setSelectedPokemon(null)
    setDetailError('')
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
          gameFilterOptions={GAME_FILTER_OPTIONS}
          selectedGameFilterKey={selectedGameFilterKey}
          onGameFilterChange={handleGameFilterChange}
          isListLoading={isListLoading}
          listError={listError}
          filteredPokemon={filteredPokemon}
          onPokemonSelect={loadPokemonDetail}
          onPokemonPreviewStart={schedulePokemonDetailPreview}
          onPokemonPreviewCancel={cancelPokemonDetailPreview}
        />

        <PokemonInfoPanel
          selectedPokemon={selectedPokemon}
          isDetailLoading={isDetailLoading}
          loadingTargetLabel={loadingTargetLabel}
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
          canOpenTeamDetails={selectedGameFilterKey !== DEFAULT_GAME_FILTER_KEY}
        />
      </section>
    </main>
  )
}

export default TeamBuilderPage
