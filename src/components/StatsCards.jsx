const REGION_LABELS = {
  kyiv    : 'Вишгород',
  zhytomyr: 'Житомир',
}

function StatCard({ label, values, unit, icon }) {
  const isCompare = values.length === 2
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        {isCompare ? (
          <div className="stat-compare">
            {values.map(({ regionKey, value }) => (
              <div key={regionKey} className="stat-compare-row">
                <span className="stat-region-tag">{REGION_LABELS[regionKey]}</span>
                <span className="stat-value-sm">
                  {value}<span className="stat-unit">{unit}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="stat-value">
            {values[0]?.value}
            <span className="stat-unit">{unit}</span>
          </div>
        )}
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

export function StatsCards({ statsMap, regionKeys }) {
  if (!statsMap || regionKeys.every(k => !statsMap[k])) return null

  const cards = [
    { label: 'Тривог за місяць',  unit: 'шт', icon: '🚨', field: 'total'        },
    { label: 'Середня тривалість', unit: 'хв', icon: '⏱️', field: 'avgDuration'  },
    { label: 'Найдовша тривога',   unit: 'хв', icon: '📊', field: 'maxDuration'  },
    { label: 'Днів з тривогами',   unit: 'з 30', icon: '📅', field: 'daysWithAlerts' },
  ]

  return (
    <div className="stats-grid">
      {cards.map(card => (
        <StatCard
          key={card.label}
          label={card.label}
          unit={card.unit}
          icon={card.icon}
          values={regionKeys
            .filter(k => statsMap[k])
            .map(k => ({ regionKey: k, value: statsMap[k][card.field] }))}
        />
      ))}
    </div>
  )
}
