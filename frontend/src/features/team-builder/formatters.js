export function formatAbilityList(abilities) {
  return abilities
    .map((ability) => (typeof ability === 'string' ? ability : ability.name))
    .join(', ')
}
