import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts'
import { computeForecast } from '../data/mockAlerts'

const REGION_NAMES = { kyiv: 'Вишгород', zhytomyr: 'Житомир' }

const RANGE_OPTIONS = [
  { label: '7 днів',   days: 7  },
  { label: '30 днів',  days: 30 },
  { label: 'Весь час', days: 999 },
]

// Форматуємо дату для осі X
function fmtDt(isoStr) {
  const d = new Date(isoStr)
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'numeric' }) +
    ' ' + String(d.getUTCHours()).padStart(2, '0') + ':00'
}

function ForecastTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const row = payload[0] && payload[0].payload ? payload[0].payload : {}
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{row.label || ''}</div>
      {payload.map(function(p) {
        if (p.value == null) return null
        return (
          <div className="tooltip-row" key={p.name}>
            <span className="tooltip-label" style={{ color: p.color || p.fill }}>
              {p.name}
            </span>
            <span className="tooltip-value accent">
              {p.dataKey === 'had_alert'
                ? (p.value ? '🔴 Була' : '🟢 Не було')
                : Math.round(p.value * 100) + '%'}
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
      {row.observed != null && (
        <div className="tooltip-row">
          <span className="tooltip-label">Підстава</span>
          <span className="tooltip-value">{row.hits} з {row.observed} тижнів</span>
        </div>
      )}
      {row.made_at && (
        <div className="tooltip-row">
          <span className="tooltip-label">Прогноз зроблено</span>
          <span className="tooltip-value">
            {new Date(row.made_at).toLocaleDateString('uk-UA', {
              day: 'numeric', month: 'short',
            })}
          </span>
        </div>
      )}
    </div>
  )
}

// Будує дані для графіку з масиву збережених прогнозів
function buildHistoryData(forecasts, daysLimit) {
  if (!Array.isArray(forecasts) || forecasts.length === 0) return []
  const cutoff = daysLimit < 999
    ? new Date(Date.now() - daysLimit * 86400000)
    : new Date(0)

  // Дедублікуємо по dt — беремо останній прогноз для кожного часового слоту
  var byDt = {}
  forecasts.forEach(function(forecast) {
    if (new Date(forecast.made_at) < cutoff) return
    forecast.slots.forEach(function(slot) {
      var key = slot.dt.slice(0, 13) // округлюємо до години
      if (!byDt[key] || new Date(forecast.made_at) > new Date(byDt[key].made_at)) {
        byDt[key] = {
          dt       : slot.dt,
          label    : fmtDt(slot.dt),
          prob     : slot.prob,
          had_alert: slot.had_alert === true ? 1 : slot.had_alert === false ? 0 : null,
          made_at  : forecast.made_at,
        }
      }
    })
  })

  return Object.values(byDt).sort(function(a, b) { return new Date(a.dt) - new Date(b.dt) })
}

// Рахує точність прогнозу по порогу 0.5
function calcAccuracy(rows) {
  var total   = 0
  var correct = 0
  rows.forEach(function(row) {
    if (row.had_alert === null) return  // ще не відомо
    total++
    var predicted = row.prob >= 0.5 ? 1 : 0
    if (predicted === row.had_alert) correct++
  })
  if (total === 0) return null
  return {
    correct : correct,
    total   : total,
    pct     : Math.round(correct / total * 100),
    // Скільки разів прогноз казав "буде" і справді було
    truePos : rows.filter(function(r) { return r.had_alert === 1 && r.prob >= 0.5 }).length,
    falsePos: rows.filter(function(r) { return r.had_alert === 0 && r.prob >= 0.5 }).length,
    trueNeg : rows.filter(function(r) { return r.had_alert === 0 && r.prob < 0.5  }).length,
    falseNeg: rows.filter(function(r) { return r.had_alert === 1 && r.prob < 0.5  }).length,
  }
}

export function ForecastChart({ alertsMap, regionKeys, forecastHistory }) {
  var regionKey = regionKeys[0]
  var alerts    = alertsMap[regionKey] || []

  var _range    = useState(0)  // індекс в RANGE_OPTIONS
  var rangeIdx  = _range[0]
  var setRange  = _range[1]

  var _mode     = useState('forecast')  // 'forecast' | 'history'
  var mode      = _mode[0]
  var setMode   = _mode[1]

  // Поточний прогноз (live)
  var liveData = []
  if (mode === 'forecast') {
    var forecast = computeForecast(alerts, 6)
    liveData = forecast.slots
      .filter(function(s) { return s.adjustedProbability >= 0.5 })
      .map(function(s) {
        return {
          label    : s.label,
          prob     : s.adjustedProbability,
          ciLo     : s.ciLow,
          ciHi     : s.ciHigh,
          observed : s.observed,
          hits     : s.hits,
          had_alert: null,
        }
      })
  }

  // Історія прогнозів
  var historyData = []
  var accuracy    = null
  var savedForecasts = forecastHistory && forecastHistory[regionKey]
    ? forecastHistory[regionKey]
    : []
  if (mode === 'history') {
    historyData = buildHistoryData(savedForecasts, RANGE_OPTIONS[rangeIdx].days)
    accuracy    = calcAccuracy(historyData)
  }

  var chartData  = mode === 'forecast' ? liveData : historyData
  var hasHistory = savedForecasts.length > 0

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">
            {mode === 'forecast' ? 'Прогноз на наступні 6 годин' : 'Історія прогнозів'}
          </h2>
          <p className="chart-subtitle">
            {mode === 'forecast'
              ? 'Показано слоти з імовірністю ≥ 50% · ' + (liveData.length === 0 ? 'немає прогнозів' : liveData.length + ' з 6 год')
              : 'Прогноз vs реальні тривоги · ' + RANGE_OPTIONS[rangeIdx].label}
          </p>
        </div>

        <div className="forecast-controls">
          {/* Перемикач режиму */}
          <div className="fc-tabs">
            <button
              className={'fc-tab ' + (mode === 'forecast' ? 'fc-tab--active' : '')}
              onClick={function() { setMode('forecast') }}
            >
              Прогноз
            </button>
            <button
              className={'fc-tab ' + (mode === 'history' ? 'fc-tab--active' : '')}
              onClick={function() { setMode('history') }}
              disabled={!hasHistory}
              title={!hasHistory ? 'Немає збережених прогнозів' : ''}
            >
              Історія
            </button>
          </div>

          {/* Фільтр діапазону — тільки в режимі history */}
          {mode === 'history' && (
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
          )}
        </div>
      </div>

      {/* ── Точність в режимі history ── */}
      {mode === 'history' && accuracy && (
        <div className="fc-accuracy">
          <div className="fc-acc-main">
            <span className="fc-acc-value">{accuracy.pct}%</span>
            <span className="fc-acc-label">точність · {accuracy.correct} з {accuracy.total} слотів</span>
          </div>
          <div className="fc-acc-grid">
            <div className="fc-acc-cell fc-acc-cell--good">
              <span className="fc-acc-num">{accuracy.truePos}</span>
              <span className="fc-acc-desc">вгадав тривогу</span>
            </div>
            <div className="fc-acc-cell fc-acc-cell--bad">
              <span className="fc-acc-num">{accuracy.falsePos}</span>
              <span className="fc-acc-desc">хибна тривога</span>
            </div>
            <div className="fc-acc-cell fc-acc-cell--bad">
              <span className="fc-acc-num">{accuracy.falseNeg}</span>
              <span className="fc-acc-desc">пропущена тривога</span>
            </div>
            <div className="fc-acc-cell fc-acc-cell--good">
              <span className="fc-acc-num">{accuracy.trueNeg}</span>
              <span className="fc-acc-desc">вгадав тишу</span>
            </div>
          </div>
        </div>
      )}

      {chartData.length === 0 ? (
        <div className="fc-empty">
          {mode === 'history'
            ? 'Немає збережених прогнозів за цей період. Дані накопичуються щодня.'
            : 'Немає слотів з імовірністю ≥ 50% · наступні 6 годин відносно спокійні за статистикою.'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#8899aa', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={mode === 'history' ? Math.floor(chartData.length / 6) : 0}
            />
            <YAxis
              tickFormatter={function(v) { return Math.round(v * 100) + '%' }}
              tick={{ fill: '#8899aa', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={[0, 1]}
            />
            <Tooltip content={<ForecastTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <ReferenceLine y={0.2} stroke="#ef4444" strokeDasharray="6 3" strokeOpacity={0.4} />

            {/* Прогнозована імовірність */}
            <Bar
              dataKey="prob"
              name="Прогноз"
              radius={[4, 4, 0, 0]}
              maxBarSize={mode === 'history' ? 8 : 48}
              fillOpacity={0.8}
            >
              {chartData.map(function(entry, i) {
                var p = entry.prob || 0
                return (
                  <Cell
                    key={i}
                    fill={p >= 0.35 ? '#ef4444' : p >= 0.2 ? '#f97316' : '#3b82f6'}
                  />
                )
              })}
            </Bar>

            {/* Реальні тривоги — тільки в режимі history */}
            {mode === 'history' && (
              <Line
                dataKey="had_alert"
                name="Реальна тривога"
                type="step"
                stroke="#ef4444"
                strokeWidth={2}
                dot={function(props) {
                  var val = props.payload && props.payload.had_alert
                  if (val !== 1) return null
                  return (
                    <circle
                      key={props.key || props.index}
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill="#ef4444"
                      stroke="none"
                    />
                  )
                }}
                activeDot={{ r: 5, fill: '#ef4444' }}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      <p className="hm-note">
        {mode === 'forecast'
          ? 'Засновано на статистиці за ' + (alerts.length > 0 ? 'зібраний період' : '30 днів') + '. Не є оперативним прогнозом.'
          : 'Стовпці = прогноз · червоні крапки = реальні тривоги · порожньо = дані ще збираються.'}
      </p>
    </div>
  )
}