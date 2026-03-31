import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ErrorBar, ReferenceLine, Cell,
} from 'recharts'
import { computeForecast } from '../data/mockAlerts'

function ForecastTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{d.fullLabel}</div>
      <div className="tooltip-row">
        <span className="tooltip-label">Скоригована імовірність</span>
        <span className="tooltip-value accent">
          {(d.adjustedProbability * 100).toFixed(1)}%
        </span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">Базова (статистика)</span>
        <span className="tooltip-value">
          {(d.baseProbability * 100).toFixed(1)}%
        </span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">90% довір. інтервал</span>
        <span className="tooltip-value">
          {(d.ciLow * 100).toFixed(0)}% – {(d.ciHigh * 100).toFixed(0)}%
        </span>
      </div>
      {d.hoursSinceLast !== null && (
        <div className="tooltip-row">
          <span className="tooltip-label">З останньої тривоги</span>
          <span className="tooltip-value">
            {d.hoursSinceLast.toFixed(1)} год
          </span>
        </div>
      )}
    </div>
  )
}

export function ForecastChart({ alerts }) {
  const { slots, avgIntervalHours, lastAlert } = computeForecast(alerts, 6)

  // Для ErrorBar потрібен масив [низ, верх] відносно значення
  const data = slots.map(s => ({
    ...s,
    errorBar: [
      s.adjustedProbability - s.ciLow,
      s.ciHigh - s.adjustedProbability,
    ],
  }))

  const maxProb = Math.max(...data.map(d => d.ciHigh), 0.15)

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Прогноз на наступні 6 годин</h2>
          <p className="chart-subtitle">
            Статистична імовірність · 90% довірчий інтервал
          </p>
        </div>
      </div>

      {avgIntervalHours && (
        <div className="forecast-meta">
          <span>
            Середній інтервал між тривогами:{' '}
            <strong>{avgIntervalHours.toFixed(1)} год</strong>
          </span>
          {lastAlert && (
            <span>
              · Остання тривога:{' '}
              <strong>
                {new Date(lastAlert).toLocaleString('uk-UA', {
                  day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })}
              </strong>
            </span>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={v => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={[0, Math.min(maxProb * 1.15, 1)]}
          />
          <Tooltip content={<ForecastTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine
            y={0.2}
            stroke="var(--danger)"
            strokeDasharray="6 3"
            strokeOpacity={0.5}
          />
          <Bar dataKey="adjustedProbability" radius={[4, 4, 0, 0]} maxBarSize={48}>
            <ErrorBar
              dataKey="errorBar"
              width={4}
              strokeWidth={1.5}
              stroke="rgba(255,255,255,0.35)"
            />
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.adjustedProbability >= 0.35
                    ? 'var(--accent-high)'
                    : entry.adjustedProbability >= 0.2
                    ? 'var(--accent-mid)'
                    : 'var(--accent-low)'
                }
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="hm-note">
        Скоригована імовірність враховує час з останньої тривоги відносно
        середнього інтервалу. Риски показують 90% довірчий інтервал Вілсона.
        Засновано виключно на статистиці за 30 днів — не є оперативним прогнозом.
      </p>
    </div>
  )
}
