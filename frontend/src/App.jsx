import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { TEAM_LIMIT } from './features/team-builder/constants'
import { getSafeTeamFromSession, saveTeamToSession } from './features/team-builder/storage'
import TeamAnalysisPage from './pages/TeamAnalysisPage'
import TeamBuilderPage from './pages/TeamBuilderPage'

function App() {
  const [team, setTeam] = useState(() => getSafeTeamFromSession())

  const teamIds = useMemo(() => new Set(team.map((pokemon) => pokemon.id)), [team])

  useEffect(() => {
    saveTeamToSession(team)
  }, [team])

  function handleAddToTeam(selectedPokemon) {
    if (team.length >= TEAM_LIMIT) {
      return {
        ok: false,
        message: 'Your team is full. Remove one Pokemon first.',
      }
    }

    if (teamIds.has(selectedPokemon.id)) {
      return {
        ok: false,
        message: 'This Pokemon is already in your team.',
      }
    }

    setTeam((currentTeam) => [...currentTeam, selectedPokemon])
    return { ok: true }
  }

  function handleRemoveFromTeam(pokemonId) {
    setTeam((currentTeam) => currentTeam.filter((pokemon) => pokemon.id !== pokemonId))
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <TeamBuilderPage
            team={team}
            teamLimit={TEAM_LIMIT}
            onAddPokemonToTeam={handleAddToTeam}
            onRemovePokemonFromTeam={handleRemoveFromTeam}
          />
        }
      />

      <Route
        path="/analysis"
        element={
          <TeamAnalysisPage
            team={team}
            teamLimit={TEAM_LIMIT}
          />
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
