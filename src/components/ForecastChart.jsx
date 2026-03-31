import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ErrorBar, ReferenceLine, Legend,
} from 'recharts'
import { computeForecast } from '../data/mockAlerts'

const REGION_COLORS = {
  kyiv    : { bar: '#3b82f6', name: 'Вишгород' },
  zhytomyr: { bar: '#f97316', name: 'Житомир'  },
}

function ForecastTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{d?.fullLabel}</div>
      {payload.map(p => (
        <div className="tooltip-row" key={p.dataKey}>
          <span className="tooltip-label" style={{ color: p.fill }}>{p.name}</span>
          <span className="tooltip-value accent">{(p.value * 100).toFixed(1)}%</span>
        </div>
      ))}
      {d?.hoursSinceLast_kyiv != null && (
        <div className="tooltip-row">
          <span className="tooltip-label">З останньої (Вишгород)</span>
          <span className="tooltip-value">{d.hoursSinceLast_kyiv?.toFixed(1)} год</span>
        </div>
      )}
    </div>
  )
}

export function ForecastChart({ alertsMap, regionKeys }) {
  const isCompare = regionKeys.length === 2
  const forecasts = Object.fromEntries(
    regionKeys.map(k => [k, computeForecast(alertsMap[k], 6)])
  )

  // Мержимо слоти
  const data = forecasts[regionKeys[0]].slots.map((slot, i) => {
    const row = {
      label    : slot.label,
      fullLabel: slot.fullLabel,
    }
    regionKeys.forEach(k => {
      const s = forecasts[k].slots[i]
      row[`prob_${k}`]           = s.adjustedProbability
      row[`err_${k}`]            = [s.adjustedProbability - s.ciLow, s.ciHigh - s.adjustedProbability]
      row[`hoursSinceLast_${k}`] = s.hoursSinceLast
    })
    return row
  })

  const primaryForecast = forecasts[regionKeys[0]]

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Прогноз на наступні 6 годин</h2>
          <p className="chart-subtitle">Статистична імовірність · 90% довірчий інтервал</p>
        </div>
      </div>

      {primaryForecast.avgIntervalHours && (
        <div className="forecast-meta">
          {regionKeys.map(k => (
            <span key={k}>
              <span style={{ color: REGION_COLORS[k].bar }}>{REGION_COLORS[k].name}</span>
              {' — інтервал: '}
              <strong>{forecasts[k].avgIntervalHours?.toFixed(1)} год</strong>
            </span>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<ForecastTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine y={0.2} stroke="var(--danger)" strokeDasharray="6 3" strokeOpacity={0.5} />
          {isCompare && <Legend formatter={v => <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{v}</span>} wrapperStyle={{ paddingTop: 8 }} />}
          {regionKeys.map(k => (
            <Bar key={k} dataKey={`prob_${k}`} name={REGION_COLORS[k].name}
                 fill={REGION_COLORS[k].bar} radius={[4,4,0,0]}
                 maxBarSize={isCompare ? 20 : 48} fillOpacity={0.85}>
              <ErrorBar dataKey={`err_${k}`} width={4} strokeWidth={1.5} stroke="rgba(255,255,255,0.3)" />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      <p className="hm-note">
        Скоригована імовірність враховує час з останньої тривоги відносно середнього інтервалу.
        Засновано виключно на статистиці за 30 днів — не є оперативним прогнозом.
      </p>
    </div>
  )
}
