import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { computeForecast } from '../data/mockAlerts'

const REGION_COLORS = {
  kyiv    : '#3b82f6',
  zhytomyr: '#f97316',
}

const REGION_NAMES = {
  kyiv    : 'Вишгород',
  zhytomyr: 'Житомир',
}

function ForecastTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const row = payload[0] && payload[0].payload ? payload[0].payload : {}

  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{row.fullLabel || ''}</div>
      {payload.map(function(p) {
        return (
          <div className="tooltip-row" key={p.name}>
            <span className="tooltip-label" style={{ color: p.fill }}>{p.name}</span>
            <span className="tooltip-value accent">
              {p.value ? (p.value * 100).toFixed(1) + '%' : '—'}
            </span>
          </div>
        )
      })}
      {row.ciLo != null && (
        <div className="tooltip-row">
          <span className="tooltip-label">90% інтервал</span>
          <span className="tooltip-value">
            {Math.round(row.ciLo * 100)}–{Math.round(row.ciHi * 100)}%
          </span>
        </div>
      )}
    </div>
  )
}

export function ForecastChart({ alertsMap, regionKeys }) {
  const isCompare = regionKeys.length === 2

  const forecasts = {}
  regionKeys.forEach(function(k) {
    forecasts[k] = computeForecast(alertsMap[k], 6)
  })

  const primarySlots = forecasts[regionKeys[0]].slots

  const data = primarySlots.map(function(slot, i) {
    const row = {
      label    : slot.label,
      fullLabel: slot.fullLabel,
    }
    regionKeys.forEach(function(k) {
      const s = forecasts[k].slots[i]
      row['prob_' + k] = s.adjustedProbability
      // Store CI for primary region only (shown in tooltip)
      if (k === regionKeys[0]) {
        row.ciLo = s.ciLow
        row.ciHi = s.ciHigh
      }
    })
    return row
  })

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Прогноз на наступні 6 годин</h2>
          <p className="chart-subtitle">Статистична імовірність · скоригована на інтервал</p>
        </div>
        {isCompare && (
          <div className="chart-legend-row">
            {regionKeys.map(function(k) {
              return (
                <span key={k} className="legend-item">
                  <span className="legend-dot" style={{ background: REGION_COLORS[k] }} />
                  <span className="legend-text">{REGION_NAMES[k]}</span>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {regionKeys.some(function(k) { return forecasts[k].avgIntervalHours }) && (
        <div className="forecast-meta">
          {regionKeys.map(function(k) {
            const f = forecasts[k]
            if (!f.avgIntervalHours) return null
            return (
              <span key={k}>
                {isCompare && (
                  <span style={{ color: REGION_COLORS[k] }}>{REGION_NAMES[k]}: </span>
                )}
                інтервал <strong>{f.avgIntervalHours.toFixed(1)} год</strong>
              </span>
            )
          })}
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 0 }} barGap={3}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#8899aa', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={function(v) { return Math.round(v * 100) + '%' }}
            tick={{ fill: '#8899aa', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ForecastTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine y={0.2} stroke="#ef4444" strokeDasharray="6 3" strokeOpacity={0.5} />

          {isCompare ? (
            regionKeys.map(function(k) {
              return (
                <Bar
                  key={k}
                  dataKey={'prob_' + k}
                  name={REGION_NAMES[k]}
                  fill={REGION_COLORS[k]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                  fillOpacity={0.85}
                />
              )
            })
          ) : (
            <Bar
              dataKey={'prob_' + regionKeys[0]}
              name={REGION_NAMES[regionKeys[0]]}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              fillOpacity={0.85}
            >
              {data.map(function(entry, i) {
                const prob = entry['prob_' + regionKeys[0]] || 0
                return (
                  <Cell
                    key={i}
                    fill={prob >= 0.35 ? '#ef4444' : prob >= 0.2 ? '#f97316' : '#3b82f6'}
                  />
                )
              })}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>

      <p className="hm-note">
        Скоригована імовірність враховує час з останньої тривоги відносно середнього інтервалу.
        Засновано виключно на статистиці за 30 днів — не є оперативним прогнозом.
      </p>
    </div>
  )
}