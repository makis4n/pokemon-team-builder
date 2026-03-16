export const TEAM_LIMIT = 6
export const TEAM_STORAGE_KEY = 'pokemon-team-builder:team'
export const SWAP_RECOMMENDATIONS_STORAGE_KEY = 'pokemon-team-builder:swap-recommendations:v1'
export const GAME_FILTER_STORAGE_KEY = 'pokemon-team-builder:game-filter:v1'
export const DEFAULT_GAME_FILTER_KEY = 'all'

export const GAME_FILTER_OPTIONS = [
  {
    key: 'all',
    label: 'All Games (No Generation Filter)',
    generationNumber: null,
  },
  {
    key: 'gen1-rby-yellow',
    label: 'Gen 1 - Red/Blue/Yellow',
    generationNumber: 1,
  },
  {
    key: 'gen2-gsc',
    label: 'Gen 2 - Gold/Silver/Crystal',
    generationNumber: 2,
  },
  {
    key: 'gen3-rse-frlg',
    label: 'Gen 3 - Ruby/Sapphire/Emerald/FRLG',
    generationNumber: 3,
  },
  {
    key: 'gen4-dppt-hgss',
    label: 'Gen 4 - Diamond/Pearl/Platinum/HGSS',
    generationNumber: 4,
  },
  {
    key: 'gen5-bw-b2w2',
    label: 'Gen 5 - Black/White/B2/W2',
    generationNumber: 5,
  },
  {
    key: 'gen6-xy-oras',
    label: 'Gen 6 - X/Y/ORAS',
    generationNumber: 6,
  },
  {
    key: 'gen7-sm-usum-lgpe',
    label: 'Gen 7 - Sun/Moon/USUM/LGPE',
    generationNumber: 7,
  },
  {
    key: 'gen8-swsh-bdsp-la',
    label: 'Gen 8 - Sword/Shield/BDSP/Legends Arceus',
    generationNumber: 8,
  },
  {
    key: 'gen9-sv',
    label: 'Gen 9 - Scarlet/Violet',
    generationNumber: 9,
  },
]

export const GAME_FILTER_OPTION_BY_KEY = Object.fromEntries(
  GAME_FILTER_OPTIONS.map((option) => [option.key, option]),
)

export const GENERATION_POKEDEX_RANGES = {
  1: { startId: 1, endId: 151 },
  2: { startId: 152, endId: 251 },
  3: { startId: 252, endId: 386 },
  4: { startId: 387, endId: 493 },
  5: { startId: 494, endId: 649 },
  6: { startId: 650, endId: 721 },
  7: { startId: 722, endId: 809 },
  8: { startId: 810, endId: 905 },
  9: { startId: 906, endId: 1025 },
}

export const statLabels = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  'special-attack': 'SP.ATK',
  'special-defense': 'SP.DEF',
  speed: 'SPD',
}
