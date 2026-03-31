import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

// Кольори для кожного регіону
const REGION_COLORS = {
  kyiv    : { bar: '#3b82f6', name: 'Вишгород' },
  zhytomyr: { bar: '#f97316', name: 'Житомир'  },
}

function CustomTooltip({ active, payload, isSingle }) {
  if (!active || !payload?.length) return null
  const hour = payload[0]?.payload?.label
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{hour}</div>
      {payload.map(p => (
        <div className="tooltip-row" key={p.dataKey}>
          <span className="tooltip-label" style={{ color: p.fill }}>{p.name}</span>
          <span className="tooltip-value accent">
            {(p.value * 100).toFixed(1)}%
          </span>
        </div>
      ))}
      {payload[0] && (
        <div className="tooltip-row">
          <span className="tooltip-label">Тривог</span>
          <span className="tooltip-value">{payload[0].payload.totalAlerts_kyiv ?? payload[0].payload.totalAlerts}</span>
        </div>
      )}
    </div>
  )
}

export function HourlyChart({ data, compareData, regionKeys }) {
  const isCompare = compareData && regionKeys?.length === 2

  // Якщо порівняння — мержимо два масиви в один по label
  const chartData = isCompare
    ? data.map((d, i) => ({
        ...d,
        label              : d.label,
        probability_kyiv   : regionKeys[0] === 'kyiv' ? d.probability : compareData[i]?.probability,
        probability_zhytomyr: regionKeys[0] === 'zhytomyr' ? d.probability : compareData[i]?.probability,
        totalAlerts_kyiv   : d.totalAlerts,
      }))
    : data

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Імовірність тривоги по годинах</h2>
          <p className="chart-subtitle">За останні 30 днів</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#8899aa', fontSize: 11, fontFamily: 'monospace' }}
            tickLine={false} axisLine={false} interval={2}
          />
          <YAxis
            tickFormatter={v => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: '#8899aa', fontSize: 11 }}
            tickLine={false} axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine y={0.2} stroke="var(--danger)" strokeDasharray="6 3" strokeOpacity={0.5} />

          {isCompare ? (
            <>
              <Legend
                formatter={v => v}
                wrapperStyle={{ paddingTop: 8 }}
              />
              <Bar dataKey="probability_kyiv"      name={REGION_COLORS.kyiv.name}
                   fill={REGION_COLORS.kyiv.bar}     radius={[3,3,0,0]} maxBarSize={14} fillOpacity={0.85} />
              <Bar dataKey="probability_zhytomyr"  name={REGION_COLORS.zhytomyr.name}
                   fill={REGION_COLORS.zhytomyr.bar} radius={[3,3,0,0]} maxBarSize={14} fillOpacity={0.85} />
            </>
          ) : (
            <Bar dataKey="probability" fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={28} fillOpacity={0.85} />
          )}
        </BarChart>
      </ResponsiveContainer>

      <div className="hour-zones">
        <span className="zone">🌙 02:00–05:00</span>
        <span className="zone">🌅 08:00–10:00</span>
        <span className="zone">🌆 18:00–20:00</span>
      </div>
    </div>
  )
}