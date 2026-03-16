export const TEAM_LIMIT = 6
export const TEAM_STORAGE_KEY = 'pokemon-team-builder:team'
export const SWAP_RECOMMENDATIONS_STORAGE_KEY = 'pokemon-team-builder:swap-recommendations:v1'
export const GAME_FILTER_STORAGE_KEY = 'pokemon-team-builder:game-filter:v1'
export const DEFAULT_GAME_FILTER_KEY = 'all'

export const GAME_FILTER_OPTIONS = [
  {
    key: 'all',
    label: 'All Supported Games',
  },
  {
    key: 'gen1-rby-yellow',
    label: 'Red / Blue / Yellow',
  },
  {
    key: 'gen2-gsc',
    label: 'Gold / Silver / Crystal',
  },
  {
    key: 'gen3-rse-frlg',
    label: 'Ruby / Sapphire / Emerald / FireRed / LeafGreen',
  },
  {
    key: 'gen4-dppt-hgss',
    label: 'Diamond / Pearl / Platinum / HeartGold / SoulSilver',
  },
  {
    key: 'gen5-bw-b2w2',
    label: 'Black / White / Black 2 / White 2',
  },
  {
    key: 'gen6-xy-oras',
    label: 'X / Y / Omega Ruby / Alpha Sapphire',
  },
  {
    key: 'gen7-sm-usum-lgpe',
    label: 'Sun / Moon / Ultra Sun / Ultra Moon / Let\'s Go Pikachu / Let\'s Go Eevee',
  },
  {
    key: 'gen8-swsh-bdsp-la',
    label: 'Sword / Shield / Brilliant Diamond / Shining Pearl / Legends Arceus',
  },
  {
    key: 'gen9-sv',
    label: 'Scarlet / Violet',
  },
]

export const GAME_FILTER_OPTION_BY_KEY = Object.fromEntries(
  GAME_FILTER_OPTIONS.map((option) => [option.key, option]),
)

export const statLabels = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  'special-attack': 'SP.ATK',
  'special-defense': 'SP.DEF',
  speed: 'SPD',
}
