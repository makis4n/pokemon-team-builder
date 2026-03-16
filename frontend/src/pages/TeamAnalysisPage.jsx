import { useEffect, useMemo, useState } from 'react'
import { ROLE_NAMES } from '../features/team-analysis/constants'
import { buildRadarData } from '../features/team-analysis/radar'
import {
  buildRoleBreakdown,
  buildRoleByPokemonId,
} from '../features/team-analysis/roleAnalysis'
import { fetchDefensiveSwapRecommendations, fetchTeamDefenseAnalysis } from '../features/team-builder/api'
import {
  DEFAULT_GAME_FILTER_KEY,
  GAME_FILTER_OPTION_BY_KEY,
  statLabels,
} from '../features/team-builder/constants'
import {
  getSelectedGameFilterFromSession,
  getSwapRecommendationsFromSession,
  saveSwapRecommendationsToSession,
} from '../features/team-builder/storage'
import AnalysisCurrentTeamPanel from '../features/team-analysis/components/AnalysisCurrentTeamPanel'
import AnalysisOverviewPanel from '../features/team-analysis/components/AnalysisOverviewPanel'

const RADAR_STAT_ORDER = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed']
const RECOMMENDATION_CANDIDATE_LIMIT = 90
const RECOMMENDATION_SOURCE_MAX_SCAN = 240

function getRecommendationCacheKey(team, gameFilterKey) {
  const teamIdSignature = team
    .map((pokemon) => pokemon.id)
    .filter(Boolean)
    .sort((left, right) => left - right)
    .join(',')

  return `${teamIdSignature}::${gameFilterKey}::swap-v3`
}

function TeamAnalysisPage({ team, teamLimit }) {
  const [radarMode, setRadarMode] = useState('stats')
  const [typeSummary, setTypeSummary] = useState([])
  const [defensiveInsights, setDefensiveInsights] = useState([])
  const [swapRecommendations, setSwapRecommendations] = useState([])
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState('')
  const selectedGameFilterKey = getSelectedGameFilterFromSession()
  const selectedGameFilter = GAME_FILTER_OPTION_BY_KEY[selectedGameFilterKey]
    ?? GAME_FILTER_OPTION_BY_KEY[DEFAULT_GAME_FILTER_KEY]

  useEffect(() => {
    if (team.length === 0) {
      setTypeSummary([])
      setDefensiveInsights([])
      return undefined
    }

    let isActive = true

    async function loadTeamDefenseAnalysis() {
      try {
        const payload = await fetchTeamDefenseAnalysis(team)

        if (!isActive) {
          return
        }

        setTypeSummary(payload.data?.typeSummary ?? [])
        setDefensiveInsights(payload.data?.defensiveInsights ?? [])
      } catch {
        if (!isActive) {
          return
        }

        setTypeSummary([])
        setDefensiveInsights([])
      }
    }

    loadTeamDefenseAnalysis()

    return () => {
      isActive = false
    }
  }, [team])

  useEffect(() => {
    if (team.length === 0) {
      setSwapRecommendations([])
      setIsRecommendationsLoading(false)
      setRecommendationsError('')
      return undefined
    }

    let isActive = true
    const recommendationCacheKey = getRecommendationCacheKey(team, selectedGameFilterKey)

    async function loadSwapRecommendations() {
      setIsRecommendationsLoading(true)
      setRecommendationsError('')

      try {
        const cachedRecommendations = getSwapRecommendationsFromSession(recommendationCacheKey)
        if (cachedRecommendations.length > 0) {
          if (!isActive) {
            return
          }

          setSwapRecommendations(cachedRecommendations)
          return
        }

        const payload = await fetchDefensiveSwapRecommendations({
          team,
          teamSizeTarget: teamLimit,
          topK: 5,
          candidateLimit: RECOMMENDATION_CANDIDATE_LIMIT,
          scanLimit: RECOMMENDATION_SOURCE_MAX_SCAN,
          generationFilter: {
            enabled: Boolean(selectedGameFilter?.generationNumber),
            gameFilterKey: selectedGameFilterKey,
            gameFilterLabel: selectedGameFilter?.label ?? '',
            generationNumber: selectedGameFilter?.generationNumber ?? null,
          },
        })
        const recommendations = payload.data ?? []

        if (!isActive) {
          return
        }

        setSwapRecommendations(recommendations)
        saveSwapRecommendationsToSession(recommendationCacheKey, recommendations)
      } catch (error) {
        if (!isActive) {
          return
        }

        setSwapRecommendations([])
        setRecommendationsError(error.message)
      } finally {
        if (isActive) {
          setIsRecommendationsLoading(false)
        }
      }
    }

    loadSwapRecommendations()

    return () => {
      isActive = false
    }
  }, [selectedGameFilter, selectedGameFilterKey, team, teamLimit])

  const roleBreakdown = useMemo(() => buildRoleBreakdown(team), [team])
  const teamSlots = useMemo(
    () => Array.from({ length: teamLimit }, (_, index) => team[index] ?? null),
    [team, teamLimit],
  )

  const roleByPokemonId = useMemo(
    () => buildRoleByPokemonId(roleBreakdown.assignments),
    [roleBreakdown.assignments],
  )

  const averageStats = useMemo(() => {
    const totals = RADAR_STAT_ORDER.reduce((accumulator, statName) => {
      accumulator[statName] = 0
      return accumulator
    }, {})

    if (team.length === 0) {
      return totals
    }

    for (const pokemon of team) {
      for (const stat of pokemon.stats) {
        if (stat.name in totals) {
          totals[stat.name] += stat.baseStat
        }
      }
    }

    for (const statName of RADAR_STAT_ORDER) {
      totals[statName] /= team.length
    }

    return totals
  }, [team])

  const radarAxisLabels = useMemo(
    () => RADAR_STAT_ORDER.map((statName) => statLabels[statName] ?? statName),
    [],
  )

  const radarValues = useMemo(() => {
    const values = {}

    for (const statName of RADAR_STAT_ORDER) {
      const label = statLabels[statName] ?? statName
      values[label] = averageStats[statName]
    }

    return values
  }, [averageStats])

  const roleRadarValues = useMemo(() => roleBreakdown.blendedScores, [roleBreakdown.blendedScores])

  const activeRadarConfig = useMemo(() => {
    if (radarMode === 'roles') {
      return {
        title: 'Role Radar',
        emptyMessage: 'Add Pokemon to generate a team role profile.',
        sectionAria: 'Team role radar chart',
        chartAria: 'Pokemon team role distribution radar chart',
        axisLabels: ROLE_NAMES,
        values: roleRadarValues,
        fixedMinValue: 0,
        fixedMaxValue: 0.5,
      }
    }

    return {
      title: 'Stat Radar',
      emptyMessage: 'Add Pokemon to generate a team stat profile.',
      sectionAria: 'Team base stat radar chart',
      chartAria: 'Pokemon team base stat distribution radar chart',
      axisLabels: radarAxisLabels,
      values: radarValues,
      fixedMinValue: 55,
      fixedMaxValue: 115,
    }
  }, [radarAxisLabels, radarMode, radarValues, roleRadarValues])

  const radarData = useMemo(
    () =>
      buildRadarData(activeRadarConfig.values, activeRadarConfig.axisLabels, {
        fixedMinValue: activeRadarConfig.fixedMinValue,
        fixedMaxValue: activeRadarConfig.fixedMaxValue,
      }),
    [activeRadarConfig],
  )

  return (
    <main className="app-shell">
      <header className="top-banner">
        <h1>Team Analysis</h1>
      </header>

      <section className="analysis-grid">
        <AnalysisOverviewPanel
          activeRadarConfig={activeRadarConfig}
          radarData={radarData}
          radarMode={radarMode}
          onRadarModeChange={setRadarMode}
          teamLength={team.length}
          typeSummary={typeSummary}
          defensiveInsights={defensiveInsights}
          swapRecommendations={swapRecommendations}
          isRecommendationsLoading={isRecommendationsLoading}
          recommendationsError={recommendationsError}
        />

        <AnalysisCurrentTeamPanel
          team={team}
          teamLimit={teamLimit}
          teamSlots={teamSlots}
          roleByPokemonId={roleByPokemonId}
        />
      </section>
    </main>
  )
}

export default TeamAnalysisPage
