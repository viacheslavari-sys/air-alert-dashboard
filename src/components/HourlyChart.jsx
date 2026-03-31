import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{d.label}</div>
      <div className="tooltip-row">
        <span className="tooltip-label">Імовірність</span>
        <span className="tooltip-value accent">{(d.probability * 100).toFixed(1)}%</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">Тривог за місяць</span>
        <span className="tooltip-value">{d.totalAlerts}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">Серед. тривалість</span>
        <span className="tooltip-value">{d.avgDuration} хв</span>
      </div>
    </div>
  )
}

export function HourlyChart({ data }) {
  const maxProb = Math.max(...data.map((d) => d.probability))

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Імовірність тривоги по годинах</h2>
          <p className="chart-subtitle">За останні 30 днів · Вишгородський р-н</p>
        </div>
        <div className="legend">
          <span className="legend-dot high" />
          <span className="legend-text">Зона ризику (&gt;20%)</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={[0, Math.min(maxProb * 1.2, 1)]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine
            y={0.2}
            stroke="var(--danger)"
            strokeDasharray="6 3"
            strokeOpacity={0.6}
            label={{
              value: '20%',
              fill: 'var(--danger)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              position: 'insideTopRight',
            }}
          />
          <Bar dataKey="probability" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.probability >= 0.2
                    ? 'var(--accent-high)'
                    : entry.probability >= 0.1
                    ? 'var(--accent-mid)'
                    : 'var(--accent-low)'
                }
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="hour-zones">
        <span className="zone">🌙 Нічний пік: 02:00–05:00</span>
        <span className="zone">🌅 Ранковий: 08:00–10:00</span>
        <span className="zone">🌆 Вечірній: 18:00–20:00</span>
      </div>
    </div>
  )
}
