export const statLabels = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  'special-attack': 'SP.ATK',
  'special-defense': 'SP.DEF',
  speed: 'SPD',
}

export const ROLE_NAMES = [
  'Physical Sweeper',
  'Special Sweeper',
  'Physical Wall',
  'Special Wall',
  'Tank',
  'Wallbreaker',
  'Fast Support',
]

export const WEAKNESS_SCORES = {
  4: 8,
  2: 3,
  1: 0,
  0.5: -1,
  0.25: -2,
  0: -3,
}

export const ROLE_BUCKETS = {
  offensive: new Set(['Physical Sweeper', 'Special Sweeper', 'Wallbreaker']),
  defensive: new Set(['Physical Wall', 'Special Wall', 'Tank']),
  supportPrimary: new Set(['Fast Support']),
  supportFallback: new Set(['Tank']),
}

export const ROLE_BALANCE_RULES = {
  minOffensive: 2,
  minDefensive: 2,
  minSupport: 1,
}

export const STAT_BALANCE_RULES = {
  skewRatioThreshold: 0.7,
  minBucketSizeForSkew: 2,
}
