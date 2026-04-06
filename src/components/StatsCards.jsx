function StatCard({ label, value, unit, sub, icon, alert }) {
  return (
    <div className={'stat-card' + (alert ? ' stat-card--alert' : '')}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <div className="stat-value">
          {value != null ? value : '—'}
          {unit && <span className="stat-unit">{unit}</span>}
        </div>
        {sub && <div className="stat-sub">{sub}</div>}
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

export function StatsCards({ statsMap, regionKeys }) {
  if (!statsMap || regionKeys.every(function(k) { return !statsMap[k] })) return null

  var s = statsMap[regionKeys[0]]
  if (!s) return null

  return (
    <div className="stats-grid">
      <StatCard
        icon="🚨"
        value={s.total}
        unit=" шт"
        label="Тривог за весь час"
        sub={'за ' + s.totalDays + ' дн'}
      />
      <StatCard
        icon="📅"
        value={s.todayCount}
        unit=" шт"
        label="Тривог сьогодні"
        alert={s.todayCount > 0}
      />
      <StatCard
        icon="📆"
        value={s.weekCount}
        unit=" шт"
        label="За останній тиждень"
      />
      <StatCard
        icon="🗓️"
        value={s.daysWithAlerts}
        unit=""
        sub={'з ' + s.totalDays + ' днів'}
        label="Днів з тривогами"
      />
    </div>
  )
}