import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

const REGIONS = {
  kyiv    : { name: 'Вишгород', color: '#3b82f6' },
  zhytomyr: { name: 'Житомир',  color: '#f97316' },
}

var DAY_NAMES = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function buildFromDailyCounts(kyivCounts, zhytomyrCounts) {
  var allDates = new Set()
  if (kyivCounts)     Object.keys(kyivCounts).forEach(function(d) { allDates.add(d) })
  if (zhytomyrCounts) Object.keys(zhytomyrCounts).forEach(function(d) { allDates.add(d) })
  if (allDates.size === 0) return []
  return Array.from(allDates).sort().map(function(date) {
    return {
      date    : date,
      label   : new Date(date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
      kyiv    : kyivCounts     ? (kyivCounts[date]     || 0) : null,
      zhytomyr: zhytomyrCounts ? (zhytomyrCounts[date] || 0) : null,
    }
  })
}

function buildFromAlerts(alerts, regionKey) {
  if (!Array.isArray(alerts) || alerts.length === 0) return []
  var byDay = {}
  alerts.forEach(function(a) {
    var day = a.started_at.slice(0, 10)
    byDay[day] = (byDay[day] || 0) + 1
  })
  var keys = Object.keys(byDay).sort()
  if (keys.length === 0) return []
  var start = new Date(keys[0])
  var end   = new Date()
  end.setHours(0, 0, 0, 0)
  var rows  = []
  var cur   = new Date(start)
  while (cur <= end) {
    var key = cur.toISOString().slice(0, 10)
    var row = { date: key, label: new Date(key).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) }
    row[regionKey] = byDay[key] || 0
    rows.push(row)
    cur.setDate(cur.getDate() + 1)
  }
  return rows
}

// Рахує метрики порівняння двох регіонів
function calcComparison(data, kyivTotal, zhytomyrTotal) {
  if (!data.length || kyivTotal === 0 || zhytomyrTotal === 0) return null

  // Співвідношення інтенсивності
  var ratio = Math.round(zhytomyrTotal / kyivTotal * 100)

  // Синхронізація — дні коли обидва регіони мали тривоги
  var bothActive = 0
  var eitherActive = 0
  data.forEach(function(d) {
    var k = d.kyiv || 0
    var z = d.zhytomyr || 0
    if (k > 0 || z > 0) eitherActive++
    if (k > 0 && z > 0) bothActive++
  })
  var sync = eitherActive > 0 ? Math.round(bothActive / eitherActive * 100) : 0

  // Дні тільки в одному регіоні
  var onlyKyiv     = data.filter(function(d) { return (d.kyiv||0) > 0 && (d.zhytomyr||0) === 0 }).length
  var onlyZhytomyr = data.filter(function(d) { return (d.zhytomyr||0) > 0 && (d.kyiv||0) === 0 }).length

  return { ratio: ratio, sync: sync, bothActive: bothActive, eitherActive: eitherActive, onlyKyiv: onlyKyiv, onlyZhytomyr: onlyZhytomyr }
}

function DailyTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  var row = payload[0] && payload[0].payload ? payload[0].payload : {}
  var dayName = row.date ? DAY_NAMES[new Date(row.date).getDay()] : ''
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{dayName + ', ' + row.label}</div>
      {payload.map(function(p) {
        if (p.value == null) return null
        return (
          <div className="tooltip-row" key={p.dataKey}>
            <span className="tooltip-label" style={{ color: p.stroke }}>{p.name}</span>
            <span className="tooltip-value accent">{p.value}</span>
          </div>
        )
      })}
    </div>
  )
}

function ComparisonBlock({ cmp, kyivTotal, zhytomyrTotal }) {
  if (!cmp) return null
  return (
    <div className="daily-comparison">
      <div className="dc-item">
        <span className="dc-value">{cmp.ratio}%</span>
        <span className="dc-label">
          інтенсивність Житомира відносно Вишгорода
        </span>
      </div>
      <div className="dc-divider" />
      <div className="dc-item">
        <span className="dc-value">{cmp.sync}%</span>
        <span className="dc-label">
          синхронізація · {cmp.bothActive} з {cmp.eitherActive} активних днів збіглись
        </span>
      </div>
      <div className="dc-divider" />
      <div className="dc-item dc-item--split">
        <span>
          <span className="dc-dot" style={{ background: REGIONS.kyiv.color }} />
          <span className="dc-small">{cmp.onlyKyiv} дн тільки Вишгород</span>
        </span>
        <span>
          <span className="dc-dot" style={{ background: REGIONS.zhytomyr.color }} />
          <span className="dc-small">{cmp.onlyZhytomyr} дн тільки Житомир</span>
        </span>
      </div>
    </div>
  )
}

export function DailyAlertsChart({ alertsMap, dailyCounts }) {
  var kyivCounts     = dailyCounts && dailyCounts.kyiv
  var zhytomyrCounts = dailyCounts && dailyCounts.zhytomyr

  var data
  if (kyivCounts || zhytomyrCounts) {
    data = buildFromDailyCounts(kyivCounts, zhytomyrCounts)
  } else {
    var kyivAlerts = alertsMap && alertsMap.kyiv ? alertsMap.kyiv : []
    data = buildFromAlerts(kyivAlerts, 'kyiv')
  }

  var days          = data.length
  var kyivTotal     = data.reduce(function(s, d) { return s + (d.kyiv || 0) }, 0)
  var zhytomyrTotal = data.reduce(function(s, d) { return s + (d.zhytomyr || 0) }, 0)
  var cmp           = calcComparison(data, kyivTotal, zhytomyrTotal)

  var tickInterval  = days <= 30 ? 6 : days <= 60 ? 9 : days <= 90 ? 14 : 20
  var showKyiv      = kyivCounts != null || (alertsMap && alertsMap.kyiv)
  var showZhytomyr  = zhytomyrCounts != null

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Інтенсивність тривог по днях</h2>
          <p className="chart-subtitle">
            {days > 0
              ? data[0].label + ' — ' + data[data.length - 1].label + ' · ' + days + ' дн'
              : 'Немає даних'}
          </p>
        </div>
        <div className="chart-legend-row">
          {showKyiv && (
            <span className="legend-item">
              <span className="legend-dot" style={{ background: REGIONS.kyiv.color }} />
              <span className="legend-text">{REGIONS.kyiv.name} · {kyivTotal}</span>
            </span>
          )}
          {showZhytomyr && (
            <span className="legend-item">
              <span className="legend-dot" style={{ background: REGIONS.zhytomyr.color }} />
              <span className="legend-text">{REGIONS.zhytomyr.name} · {zhytomyrTotal}</span>
            </span>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="fc-empty">Немає даних для відображення.</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="gradKyiv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={REGIONS.kyiv.color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={REGIONS.kyiv.color} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradZhytomyr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={REGIONS.zhytomyr.color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={REGIONS.zhytomyr.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#8899aa', fontSize: 10 }} tickLine={false} axisLine={false} interval={tickInterval} />
            <YAxis tick={{ fill: '#8899aa', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<DailyTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
            {showKyiv && (
              <Area type="monotone" dataKey="kyiv" name={REGIONS.kyiv.name}
                stroke={REGIONS.kyiv.color} strokeWidth={2} fill="url(#gradKyiv)"
                dot={false} activeDot={{ r: 4, fill: REGIONS.kyiv.color, strokeWidth: 0 }} />
            )}
            {showZhytomyr && (
              <Area type="monotone" dataKey="zhytomyr" name={REGIONS.zhytomyr.name}
                stroke={REGIONS.zhytomyr.color} strokeWidth={2} fill="url(#gradZhytomyr)"
                dot={false} activeDot={{ r: 4, fill: REGIONS.zhytomyr.color, strokeWidth: 0 }} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {cmp && <ComparisonBlock cmp={cmp} kyivTotal={kyivTotal} zhytomyrTotal={zhytomyrTotal} />}
    </div>
  )
}