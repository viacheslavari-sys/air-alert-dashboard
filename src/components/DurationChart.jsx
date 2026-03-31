import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

function DurationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{d.label}</div>
      <div className="tooltip-row">
        <span className="tooltip-label">Серед. тривалість</span>
        <span className="tooltip-value accent">{d.avgDuration} хв</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">Всього тривог</span>
        <span className="tooltip-value">{d.totalAlerts}</span>
      </div>
    </div>
  )
}

function DailyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const dateStr = new Date(d.date).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
  })
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{dateStr}</div>
      <div className="tooltip-row">
        <span className="tooltip-label">Тривог</span>
        <span className="tooltip-value accent">{d.count}</span>
      </div>
      {d.totalDuration > 0 && (
        <div className="tooltip-row">
          <span className="tooltip-label">Сумарно</span>
          <span className="tooltip-value">{d.totalDuration} хв</span>
        </div>
      )}
    </div>
  )
}

export function DurationChart({ hourlyData, dailyData }) {
  // Only hours with alerts
  const validHours = hourlyData.filter((d) => d.totalAlerts > 0)

  // Format daily dates
  const formattedDaily = dailyData.map((d) => ({
    ...d,
    shortDate: new Date(d.date).toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'numeric',
    }),
  }))

  return (
    <div className="charts-row">
      {/* Duration by hour of start */}
      <div className="chart-card chart-card--half">
        <div className="chart-header">
          <div>
            <h2 className="chart-title">Середня тривалість по годинах</h2>
            <p className="chart-subtitle">Хвилин · за годиною початку тривоги</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={validHours}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}хв`}
            />
            <Tooltip content={<DurationTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar
              dataKey="avgDuration"
              fill="var(--accent-duration)"
              radius={[3, 3, 0, 0]}
              fillOpacity={0.8}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily alert count */}
      <div className="chart-card chart-card--half">
        <div className="chart-header">
          <div>
            <h2 className="chart-title">Тривоги по днях</h2>
            <p className="chart-subtitle">Кількість за останні 30 днів</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart
            data={formattedDaily}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          >
            <defs>
              <linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-area)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--accent-area)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="shortDate"
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              interval={6}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<DailyTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--accent-area)"
              strokeWidth={2}
              fill="url(#dailyGrad)"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--accent-area)', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
