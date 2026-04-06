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
          dt         : slot.dt,
          label      : fmtDt(slot.dt),
          prob       : slot.prob,
          had_alert  : slot.had_alert === true ? 1 : slot.had_alert === false ? 0 : null,
          alertMarker: slot.had_alert === true ? 0.97 : null,
          made_at    : forecast.made_at,
        }
      }
    })
  })

  return Object.values(byDt).sort(function(a, b) { return new Date(a.dt) - new Date(b.dt) })
}

// Рахує метрики якості прогнозу
function calcAccuracy(rows, hourlyActuals) {
  var known = rows.filter(function(r) { return r.had_alert !== null })
  if (known.length === 0) return null

  var truePos  = known.filter(function(r) { return r.had_alert === 1 }).length
  var falsePos = known.filter(function(r) { return r.had_alert === 0 }).length
  var precision = known.length > 0 ? Math.round(truePos / known.length * 100) : 0

  // Recall: з усіх реальних тривог скільки ми передбачили
  // Потрібен hourlyActuals — погодинний журнал реальних тривог
  var recall = null
  var falseNeg = null
  if (hourlyActuals) {
    // Збираємо всі прогнозовані слоти (дата+година)
    var predictedSet = {}
    rows.forEach(function(r) {
      var key = r.dt ? r.dt.slice(0, 13) : null
      if (key) predictedSet[key] = true
    })

    // Визначаємо точний час першого прогнозного слоту
    var firstForecastDt = null
    rows.forEach(function(r) {
      if (!r.dt) return
      if (!firstForecastDt || r.dt < firstForecastDt) firstForecastDt = r.dt
    })

    // Визначаємо дні де прогнози вже оцінені (had_alert !== null)
    var evaluatedDates = {}
    rows.forEach(function(r) {
      if (r.dt && r.had_alert !== null) {
        evaluatedDates[r.dt.slice(0, 10)] = true
      }
    })

    // Рахуємо скільки реальних тривог ми пропустили
    // Тільки слоти що відбулись ПІСЛЯ першого прогнозу і в оцінених днях
    var totalRealAlerts = 0
    var missedAlerts    = 0
    Object.keys(hourlyActuals).forEach(function(day) {
      if (!evaluatedDates[day]) return
      var hours = hourlyActuals[day]
      hours.forEach(function(hadAlert, hour) {
        if (hadAlert !== 1) return
        var slotDt = day + 'T' + String(hour).padStart(2, '0') + ':00:00.000Z'
        // Ігноруємо тривоги що були до першого прогнозу
        if (firstForecastDt && slotDt < firstForecastDt) return
        totalRealAlerts++
        var key = day + 'T' + String(hour).padStart(2, '0')
        if (!predictedSet[key]) missedAlerts++
      })
    })

    falseNeg = missedAlerts
    recall   = totalRealAlerts > 0
      ? Math.round((totalRealAlerts - missedAlerts) / totalRealAlerts * 100)
      : null
  }

  return {
    truePos  : truePos,
    falsePos : falsePos,
    falseNeg : falseNeg,
    total    : known.length,
    precision: precision,
    recall   : recall,
  }
}

export function ForecastChart({ alertsMap, regionKeys, forecastHistory, hourlyActuals }) {
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
    // Для метрик точності беремо тільки слоти з prob >= 0.5
    var evaluatedRows = historyData.filter(function(r) { return r.prob >= 0.5 })
    accuracy = calcAccuracy(evaluatedRows, hourlyActuals)
  }

  // В режимі history показуємо слоти >= 50% + маркери пропущених тривог
  var displayData = historyData
  if (mode === 'history' && hourlyActuals) {
    var filteredHigh = historyData.filter(function(r) { return r.prob >= 0.5 })

    // Знаходимо пропущені тривоги — були але не прогнозувались
    var predictedKeys = {}
    historyData.forEach(function(r) {
      if (r.dt && r.prob >= 0.5) predictedKeys[r.dt.slice(0, 13)] = true
    })
    var firstDt = null
    historyData.forEach(function(r) {
      if (!r.dt) return
      if (!firstDt || r.dt < firstDt) firstDt = r.dt
    })
    var missedRows = []
    Object.keys(hourlyActuals).sort().forEach(function(day) {
      hourlyActuals[day].forEach(function(v, h) {
        if (v !== 1) return
        var slotDt = day + 'T' + String(h).padStart(2, '0') + ':00:00.000Z'
        if (firstDt && slotDt < firstDt) return
        var key = day + 'T' + String(h).padStart(2, '0')
        if (!predictedKeys[key]) {
          missedRows.push({
            dt         : slotDt,
            label      : fmtDt(slotDt),
            prob       : null,
            had_alert  : 1,
            alertMarker: null,
            missedAlert: 0.01,  // показуємо внизу графіку
            made_at    : null,
          })
        }
      })
    })

    // Зливаємо і сортуємо по часу
    displayData = filteredHigh.concat(missedRows).sort(function(a, b) {
      return new Date(a.dt) - new Date(b.dt)
    })
  } else if (mode === 'history') {
    displayData = historyData.filter(function(r) { return r.prob >= 0.5 })
  }
  var chartData  = mode === 'forecast' ? liveData : displayData
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
            <span className="fc-acc-value">{accuracy.precision}%</span>
            <span className="fc-acc-label">
              precision · з {accuracy.total} прогнозів тривоги
            </span>
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
          </div>
          {accuracy.recall !== null && (
            <>
              <div className="fc-acc-cell fc-acc-cell--good">
                <span className="fc-acc-num">{accuracy.recall}%</span>
                <span className="fc-acc-desc">recall · знайдено тривог</span>
              </div>
              <div className="fc-acc-cell fc-acc-cell--bad">
                <span className="fc-acc-num">{accuracy.falseNeg}</span>
                <span className="fc-acc-desc">пропущено тривог</span>
              </div>
            </>
          )}
          {accuracy.recall === null && (
            <p className="fc-acc-note">
              Recall з'явиться після наступного запуску Action — потрібен hourly_actuals.
            </p>
          )}
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

            {/* Пропущені тривоги — хрестики внизу */}
            {mode === 'history' && (
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
            )}

          </ComposedChart>
        </ResponsiveContainer>
      )}

      <p className="hm-note">
        {mode === 'forecast'
          ? 'Засновано на статистиці за ' + (alerts.length > 0 ? 'зібраний період' : '30 днів') + '. Не є оперативним прогнозом.'
          : 'Стовпці = прогноз (≥50%) · ✕ помаранчевий = пропущена тривога (не прогнозувалась)'}
      </p>
    </div>
  )
}