export function StatsCards({ stats }) {
  if (!stats) return null

  const cards = [
    {
      label: 'Тривог за місяць',
      value: stats.total,
      unit: 'шт',
      icon: '🚨',
      highlight: stats.total > 15,
    },
    {
      label: 'Середня тривалість',
      value: stats.avgDuration,
      unit: 'хв',
      icon: '⏱️',
      highlight: stats.avgDuration > 60,
    },
    {
      label: 'Найдовша тривога',
      value: stats.maxDuration,
      unit: 'хв',
      icon: '📊',
      highlight: false,
    },
    {
      label: 'Днів з тривогами',
      value: stats.daysWithAlerts,
      unit: `з 30`,
      icon: '📅',
      highlight: stats.daysWithAlerts > 20,
    },
  ]

  return (
    <div className="stats-grid">
      {cards.map((card) => (
        <div key={card.label} className={`stat-card ${card.highlight ? 'stat-card--alert' : ''}`}>
          <div className="stat-icon">{card.icon}</div>
          <div className="stat-body">
            <div className="stat-value">
              {card.value}
              <span className="stat-unit">{card.unit}</span>
            </div>
            <div className="stat-label">{card.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
