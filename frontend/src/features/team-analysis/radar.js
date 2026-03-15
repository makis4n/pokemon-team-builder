export function getRadarPoint(centerX, centerY, radius, angle) {
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  }
}

export function getRadarLabelPlacement(angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const textAnchor = cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle'
  const dx = cos > 0.35 ? 5 : cos < -0.35 ? -5 : 0
  const dy = sin > 0.35 ? 4 : sin < -0.35 ? -4 : 1

  return {
    textAnchor,
    dx,
    dy,
  }
}

export function splitRadarLabel(label) {
  const words = label.split(' ')
  if (words.length <= 1) {
    return [label]
  }

  if (words.length === 2) {
    return words
  }

  const midpoint = Math.ceil(words.length / 2)
  return [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')]
}

export function buildRadarData(averageScores, roleNames) {
  const axisCount = roleNames.length
  const centerX = 120
  const centerY = 116
  const radius = 78
  const maxRoleValue = Math.max(...Object.values(averageScores), 0) || 1

  const axes = roleNames.map((role, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / axisCount
    const end = getRadarPoint(centerX, centerY, radius, angle)
    const label = getRadarPoint(centerX, centerY, radius + 8, angle)
    const placement = getRadarLabelPlacement(angle)
    const labelLines = splitRadarLabel(role)

    return {
      role,
      angle,
      end,
      label,
      placement,
      labelLines,
    }
  })

  const rings = [0.25, 0.5, 0.75, 1].map((ratio) => {
    const points = axes.map((axis) => {
      const point = getRadarPoint(centerX, centerY, radius * ratio, axis.angle)
      return `${point.x},${point.y}`
    })

    return points.join(' ')
  })

  const dataPolygon = axes
    .map((axis) => {
      const value = averageScores[axis.role]
      const ratio = Math.max(value, 0) / maxRoleValue
      const point = getRadarPoint(centerX, centerY, radius * ratio, axis.angle)
      return `${point.x},${point.y}`
    })
    .join(' ')

  return {
    axes,
    rings,
    dataPolygon,
    centerX,
    centerY,
  }
}
