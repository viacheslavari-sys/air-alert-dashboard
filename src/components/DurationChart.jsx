import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

const REGION_COLORS = {
  kyiv    : { bar: '#a78bfa', area: '#3b82f6', name: 'Вишгород' },
  zhytomyr: { bar: '#fb923c', area: '#f97316', name: 'Житомир'  },
}

function DurationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{payload[0]?.payload?.label}</div>
      {payload.map(p => (
        <div className="tooltip-row" key={p.dataKey}>
          <span className="tooltip-label" style={{ color: p.fill }}>{p.name}</span>
          <span className="tooltip-value accent">{p.value} хв</span>
        </div>
      ))}
    </div>
  )
}

function DailyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  const dateStr = new Date(d.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{dateStr}</div>
      {payload.map(p => (
        <div className="tooltip-row" key={p.dataKey}>
          <span className="tooltip-label" style={{ color: p.stroke }}>{p.name}</span>
          <span className="tooltip-value accent">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function DurationChart({ dataMap, dailyDataMap, regionKeys }) {
  const isCompare = regionKeys.length === 2

  // Мержимо погодинні дані
  const hourlyMerged = (dataMap[regionKeys[0]] ?? [])
    .filter(d => d.totalAlerts > 0)
    .map((d, i) => {
      const row = { label: d.label }
      regionKeys.forEach(k => {
        row[`avg_${k}`] = dataMap[k]?.[i]?.avgDuration ?? 0
      })
      return row
    })

  // Мержимо щоденні дані
  const dailyMerged = (dailyDataMap[regionKeys[0]] ?? []).map((d, i) => {
    const row = {
      date     : d.date,
      shortDate: new Date(d.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'numeric' }),
    }
    regionKeys.forEach(k => {
      row[`count_${k}`] = dailyDataMap[k]?.[i]?.count ?? 0
    })
    return row
  })

  return (
    <div className="charts-row">
      <div className="chart-card chart-card--half">
        <div className="chart-header">
          <div>
            <h2 className="chart-title">Середня тривалість по годинах</h2>
            <p className="chart-subtitle">Хвилин · за годиною початку</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hourlyMerged} margin={{ top: 10, right: 10, left: -15, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#8899aa', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval={2} />
            <YAxis tick={{ fill: '#8899aa', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}хв`} />
            <Tooltip content={<DurationTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            {isCompare && <Legend formatter={v => v} wrapperStyle={{ paddingTop: 8 }} />}
            {regionKeys.map(k => (
              <Bar key={k} dataKey={`avg_${k}`} name={REGION_COLORS[k].name}
                   fill={REGION_COLORS[k].bar} radius={[3,3,0,0]} maxBarSize={isCompare ? 14 : 24} fillOpacity={0.8} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card chart-card--half">
        <div className="chart-header">
          <div>
            <h2 className="chart-title">Тривоги по днях</h2>
            <p className="chart-subtitle">Кількість за останні 30 днів</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dailyMerged} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              {regionKeys.map(k => (
                <linearGradient key={k} id={`grad_${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={REGION_COLORS[k].area} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={REGION_COLORS[k].area} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="shortDate" tick={{ fill: '#8899aa', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval={6} />
            <YAxis tick={{ fill: '#8899aa', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<DailyTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
            {isCompare && <Legend formatter={v => v} wrapperStyle={{ paddingTop: 8 }} />}
            {regionKeys.map(k => (
              <Area key={k} type="monotone" dataKey={`count_${k}`} name={REGION_COLORS[k].name}
                    stroke={REGION_COLORS[k].area} strokeWidth={2}
                    fill={`url(#grad_${k})`} dot={false}
                    activeDot={{ r: 4, fill: REGION_COLORS[k].area, strokeWidth: 0 }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}