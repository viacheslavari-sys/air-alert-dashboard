import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { computeForecast } from '../data/mockAlerts'

const RANGE_OPTIONS = [
  { label: '7 днів',   days: 7   },
  { label: '30 днів',  days: 30  },
  { label: 'Весь час', days: 9999 },
]

function fmtDt(isoStr) {
  var d = new Date(isoStr)
  return d.toLocaleString('uk-UA', {
    timeZone: 'Europe/Kiev',
    day: 'numeric', month: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function ForecastTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  var row = payload[0] && payload[0].payload ? payload[0].payload : {}
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">
        {row.label || ''}
        {row.isFuture && <span style={{ marginLeft: 6, fontSize: 10, color: '#8899aa' }}>майбутнє</span>}
      </div>
      {payload.map(function(p) {
        if (p.value == null || p.dataKey === 'missedAlert') return null
        return (
          <div className="tooltip-row" key={p.dataKey}>
            <span className="tooltip-label" style={{ color: p.color || p.fill }}>
              {p.name}
            </span>
            <span className="tooltip-value accent">
              {Math.round(p.value * 100) + '%'}
            </span>
          </div>
        )
      })}
      {row.ciLo != null && (
        <div className="tooltip-row">
          <span className="tooltip-label">90% інтервал</span>
          <span className="tooltip-value">{Math.round(row.ciLo * 100)}–{Math.round(row.ciHi * 100)}%</span>
        </div>
      )}
      {row.observed != null && (
        <div className="tooltip-row">
          <span className="tooltip-label">Підстава</span>
          <span className="tooltip-value">{row.hits} з {row.observed} тижнів</span>
        </div>
      )}
      {!row.isFuture && row.had_alert === 1 && (
        <div className="tooltip-row">
          <span className="tooltip-label">Результат</span>
          <span className="tooltip-value" style={{ color: '#4ade80' }}>✓ тривога була</span>
        </div>
      )}
      {!row.isFuture && row.had_alert === 0 && (
        <div className="tooltip-row">
          <span className="tooltip-label">Результат</span>
          <span className="tooltip-value" style={{ color: '#ef4444' }}>✗ тривоги не було</span>
        </div>
      )}
    </div>
  )
}

function buildHistoryData(forecasts, daysLimit) {
  if (!Array.isArray(forecasts) || forecasts.length === 0) return []
  var cutoff = daysLimit < 9999
    ? new Date(Date.now() - daysLimit * 86400000)
    : new Date(0)
  var byDt = {}
  forecasts.forEach(function(forecast) {
    if (new Date(forecast.made_at) < cutoff) return
    forecast.slots.forEach(function(slot) {
      var key = slot.dt.slice(0, 13)
      if (!byDt[key] || new Date(forecast.made_at) > new Date(byDt[key].made_at)) {
        byDt[key] = {
          dt        : slot.dt,
          label     : fmtDt(slot.dt),
          prob      : slot.prob,
          had_alert : slot.had_alert === true ? 1 : slot.had_alert === false ? 0 : null,
          made_at   : forecast.made_at,
          isFuture  : false,
        }
      }
    })
  })
  return Object.values(byDt).sort(function(a, b) { return new Date(a.dt) - new Date(b.dt) })
}

function calcAccuracy(rows, hourlyActuals) {
  var filtered = rows.filter(function(r) { return r.prob >= 0.5 && !r.isFuture })
  var known    = filtered.filter(function(r) { return r.had_alert !== null })
  if (known.length === 0) return null

  var truePos   = known.filter(function(r) { return r.had_alert === 1 }).length
  var falsePos  = known.filter(function(r) { return r.had_alert === 0 }).length
  var precision = Math.round(truePos / known.length * 100)

  var recall = null
  var falseNeg = null
  if (hourlyActuals) {
    var predictedSet = {}
    filtered.forEach(function(r) {
      if (r.dt) predictedSet[r.dt.slice(0, 13)] = true
    })
    var firstDt = null
    filtered.forEach(function(r) {
      if (!r.dt) return
      if (!firstDt || r.dt < firstDt) firstDt = r.dt
    })
    var evaluatedDates = {}
    filtered.forEach(function(r) {
      if (r.dt && r.had_alert !== null) evaluatedDates[r.dt.slice(0, 10)] = true
    })
    var totalReal = 0
    var missed    = 0
    Object.keys(hourlyActuals).forEach(function(day) {
      if (!evaluatedDates[day]) return
      hourlyActuals[day].forEach(function(v, h) {
        if (v !== 1) return
        var slotDt = day + 'T' + String(h).padStart(2, '0') + ':00:00.000Z'
        if (firstDt && slotDt < firstDt) return
        totalReal++
        if (!predictedSet[day + 'T' + String(h).padStart(2, '0')]) missed++
      })
    })
    falseNeg = missed
    recall   = totalReal > 0 ? Math.round((totalReal - missed) / totalReal * 100) : null
  }
  return { truePos: truePos, falsePos: falsePos, falseNeg: falseNeg, total: known.length, precision: precision, recall: recall }
}

export function ForecastChart({ alertsMap, regionKeys, forecastHistory, hourlyActuals }) {
  var regionKey = regionKeys[0]
  var alerts    = alertsMap[regionKey] || []

  var _range   = useState(0)
  var rangeIdx = _range[0]
  var setRange = _range[1]

  var savedForecasts = forecastHistory && forecastHistory[regionKey]
    ? forecastHistory[regionKey] : []

  // Будуємо історію
  var historyData = buildHistoryData(savedForecasts, RANGE_OPTIONS[rangeIdx].days)

  // Фільтруємо для відображення: тільки >= 50% або з оціненим результатом
  var displayHistory = historyData.filter(function(r) { return r.prob >= 0.5 })

  // Знаходимо пропущені тривоги
  var predictedKeys = {}
  displayHistory.forEach(function(r) {
    if (r.dt) predictedKeys[r.dt.slice(0, 13)] = true
  })
  var firstDt = null
  historyData.forEach(function(r) {
    if (!r.dt) return
    if (!firstDt || r.dt < firstDt) firstDt = r.dt
  })
  var missedRows = []
  if (hourlyActuals) {
    Object.keys(hourlyActuals).sort().forEach(function(day) {
      hourlyActuals[day].forEach(function(v, h) {
        if (v !== 1) return
        var slotDt = day + 'T' + String(h).padStart(2, '0') + ':00:00.000Z'
        if (firstDt && slotDt < firstDt) return
        var key = day + 'T' + String(h).padStart(2, '0')
        if (!predictedKeys[key]) {
          missedRows.push({
            dt: slotDt, label: fmtDt(slotDt),
            prob: null, had_alert: 1, missedAlert: 0.01,
            made_at: null, isFuture: false,
          })
        }
      })
    })
  }

  // Поточний прогноз на 6 годин
  var forecast  = computeForecast(alerts, 6)
  // Для майбутнього показуємо всі слоти >= 20% — щоб завжди була зона справа
  var futureData = forecast.slots
    .filter(function(s) { return s.adjustedProbability >= 0.2 })
    .map(function(s) {
      return {
        dt       : s.label,
        label    : s.label,
        prob     : s.adjustedProbability,
        ciLo     : s.ciLow,
        ciHi     : s.ciHigh,
        observed : s.observed,
        hits     : s.hits,
        had_alert: null,
        isFuture : true,
      }
    })

  // Роздільник "Зараз"
  var nowLabel = 'Зараз'
  var nowRow   = { dt: 'now', label: nowLabel, prob: null, isNow: true, isFuture: false }

  // Фінальний масив: історія + сепаратор + майбутнє
  var chartData = displayHistory
    .concat(missedRows)
    .sort(function(a, b) { return new Date(a.dt) - new Date(b.dt) })
    .concat([nowRow])
    .concat(futureData)

  // Індекс роздільника для ReferenceLine
  var nowIndex = chartData.findIndex(function(r) { return r.isNow })

  // Точність
  var accuracy = calcAccuracy(historyData, hourlyActuals)

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Прогноз та історія</h2>
          <p className="chart-subtitle">
            {'Історія · ' + RANGE_OPTIONS[rangeIdx].label + ' · Прогноз · 6 год'}
          </p>
        </div>
        <div className="forecast-controls">
          <div className="fc-range">
            {RANGE_OPTIONS.map(function(opt, i) {
              return (
                <button
                  key={opt.label}
                  className={'fc-range-btn ' + (rangeIdx === i ? 'fc-range-btn--active' : '')}
                  onClick={function() { setRange(i) }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {accuracy && (
        <div className="fc-accuracy">
          <div className="fc-acc-main">
            <span className="fc-acc-value">{accuracy.precision}%</span>
            <span className="fc-acc-label">precision · з {accuracy.total} прогнозів</span>
          </div>
          <div className="fc-acc-grid">
            <div className="fc-acc-cell fc-acc-cell--good">
              <span className="fc-acc-num">{accuracy.truePos}</span>
              <span className="fc-acc-desc">тривога справді була</span>
            </div>
            <div className="fc-acc-cell fc-acc-cell--bad">
              <span className="fc-acc-num">{accuracy.falsePos}</span>
              <span className="fc-acc-desc">тривоги не було</span>
            </div>
            {accuracy.recall !== null && (
              <>
                <div className="fc-acc-cell fc-acc-cell--good">
                  <span className="fc-acc-num">{accuracy.recall}%</span>
                  <span className="fc-acc-desc">recall</span>
                </div>
                <div className="fc-acc-cell fc-acc-cell--bad">
                  <span className="fc-acc-num">{accuracy.falseNeg}</span>
                  <span className="fc-acc-desc">пропущено тривог</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {chartData.length <= 1 ? (
        <div className="fc-empty">Немає даних для відображення.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#8899aa', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(chartData.length / 8)}
            />
            <YAxis
              tickFormatter={function(v) { return Math.round(v * 100) + '%' }}
              tick={{ fill: '#8899aa', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={[0, 1]}
            />
            <Tooltip content={<ForecastTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <ReferenceLine y={0.5} stroke="#ef4444" strokeDasharray="6 3" strokeOpacity={0.3} />

            {/* Лінія "Зараз" */}
            {nowIndex >= 0 && (
              <ReferenceLine
                x={nowLabel}
                stroke="#60a5fa"
                strokeWidth={2}
                strokeDasharray="4 3"
                label={{ value: 'Зараз', position: 'top', fill: '#60a5fa', fontSize: 10 }}
              />
            )}

            <Bar
              dataKey="prob"
              name="Прогноз"
              radius={[4, 4, 0, 0]}
              maxBarSize={10}
              fillOpacity={0.9}
            >
              {chartData.map(function(entry, i) {
                if (!entry.prob) return <Cell key={i} fill="transparent" />
                var p   = entry.prob || 0
                var hit = entry.had_alert === 1
                if (entry.isFuture) return <Cell key={i} fill="#60a5fa" fillOpacity={0.7} stroke="#93c5fd" strokeWidth={1} />
                return (
                  <Cell
                    key={i}
                    fill={hit ? '#4ade80' : p >= 0.7 ? '#ef4444' : '#f97316'}
                    stroke={hit ? '#86efac' : 'none'}
                    strokeWidth={hit ? 1.5 : 0}
                    fillOpacity={hit ? 1 : 0.8}
                  />
                )
              })}
            </Bar>

            {/* Пропущені тривоги — хрестики внизу */}
            <Line
              dataKey="missedAlert"
              name="Пропущена тривога"
              stroke="none"
              dot={function(props) {
                var row = props.payload
                if (!row || row.missedAlert == null) return null
                var cx = props.cx
                var cy = props.cy
                var r  = 5
                return (
                  <g key={props.index}>
                    <line x1={cx-r} y1={cy-r} x2={cx+r} y2={cy+r} stroke="#f97316" strokeWidth={2.5} />
                    <line x1={cx+r} y1={cy-r} x2={cx-r} y2={cy+r} stroke="#f97316" strokeWidth={2.5} />
                  </g>
                )
              }}
              activeDot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      <p className="hm-note">
        🔴/🟠 = прогноз не справдився · 🟢 = тривога справдилась · 🔵 = майбутній прогноз · ✕ = пропущена тривога
      </p>
    </div>
  )
}