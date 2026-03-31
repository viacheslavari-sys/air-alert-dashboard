import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

const DANGER_HOURS = [1, 2, 3, 4, 5, 6]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="chart-tooltip">
      <div className="tooltip-hour">{d.label}</div>
      <div className="tooltip-prob">{d.probability}% імовірність</div>
      <div className="tooltip-count">{d.count} тривог за місяць</div>
    </div>
  )
}

export default function HourlyChart({ data }) {
  return (
    <div className="chart-card">
      <div className="chart-header">
        <h2>Імовірність тривоги по годинах доби</h2>
        <span className="chart-sub">За останній місяць · Вишгородський р-н</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#8899aa', fontSize: 11, fontFamily: 'inherit' }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis
            tickFormatter={v => `${v}%`}
            tick={{ fill: '#8899aa', fontSize: 11, fontFamily: 'inherit' }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="probability" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.probability > 60
                    ? '#ff4d4d'
                    : entry.probability > 30
                    ? '#ff944d'
                    : entry.probability > 10
                    ? '#ffcc4d'
                    : '#2a4060'
                }
                fillOpacity={0.9}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="legend-row">
        <span className="legend-item"><span className="dot" style={{background:'#ff4d4d'}}/>{'> 60% — критично'}</span>
        <span className="legend-item"><span className="dot" style={{background:'#ff944d'}}/>{'30–60% — небезпечно'}</span>
        <span className="legend-item"><span className="dot" style={{background:'#ffcc4d'}}/>{'10–30% — помірно'}</span>
        <span className="legend-item"><span className="dot" style={{background:'#2a4060'}}/>{'< 10% — спокійно'}</span>
      </div>
    </div>
  )
}
