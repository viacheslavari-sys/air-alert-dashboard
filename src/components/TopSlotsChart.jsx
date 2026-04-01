import { useState } from 'react'
import { computeHeatmap } from '../data/mockAlerts'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

var REGION_COLORS = {
  kyiv    : '#3b82f6',
  zhytomyr: '#f97316',
}

var REGION_NAMES = {
  kyiv    : 'Вишгород',
  zhytomyr: 'Житомир',
}

// Небезпечні: ймовірність тривоги > 40%
var DANGER_THRESHOLD = 0.4
// Безпечні: ймовірність тривоги < 40% (тобто безпека > 60%)
var SAFE_THRESHOLD   = 0.4

function SlotTooltip(props) {
  var active  = props.active
  var payload = props.payload
  var mode    = props.mode

  if (!active || !payload || !payload.length) return null
  var d = payload[0] && payload[0].payload ? payload[0].payload : {}

  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{d.fullLabel || ''}</div>
      {payload.map(function(p) {
        var pct = mode === 'safe'
          ? Math.round((1 - p.value) * 100) + '% безпечно'
          : Math.round(p.value * 100) + '% ризик'
        return (
          <div className="tooltip-row" key={p.name || p.dataKey}>
            <span className="tooltip-label" style={{ color: p.fill }}>{p.name}</span>
            <span className="tooltip-value accent">{pct}</span>
          </div>
        )
      })}
      {d.avgDuration > 0 && mode === 'danger' && (
        <div className="tooltip-row">
          <span className="tooltip-label">Серед. тривалість</span>
          <span className="tooltip-value">{d.avgDuration} хв</span>
        </div>
      )}
      <div className="tooltip-row">
        <span className="tooltip-label">Кількість тривог</span>
        <span className="tooltip-value">{d.count}</span>
      </div>
    </div>
  )
}

function computeSlots(alerts) {
  var hm        = computeHeatmap(alerts)
  var DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

  // Рахуємо середню тривалість по кожному слоту
  var durationSums   = Array.from({ length: 7 }, function() { return new Array(24).fill(0) })
  var durationCounts = Array.from({ length: 7 }, function() { return new Array(24).fill(0) })

  alerts.forEach(function(a) {
    if (!a.duration_minutes) return
    var d   = new Date(a.started_at)
    var dow  = (d.getDay() + 6) % 7
    var hour = d.getHours()
    durationSums[dow][hour]   += a.duration_minutes
    durationCounts[dow][hour] += 1
  })

  var slots = []
  hm.cells.forEach(function(dayCells, dow) {
    dayCells.forEach(function(cell, hour) {
      var avgDuration = durationCounts[dow][hour] > 0
        ? Math.round(durationSums[dow][hour] / durationCounts[dow][hour])
        : 0
      slots.push({
        key        : dow + '-' + hour,
        fullLabel  : DAY_LABELS[dow] + ', ' + cell.label,
        label      : DAY_LABELS[dow] + ' ' + String(hour).padStart(2, '0') + ':00',
        probability: cell.probability,
        safety     : 1 - cell.probability,
        avgDuration: avgDuration,
        count      : cell.count,
        total      : hm.dowTotals[dow],
        dow        : dow,
        hour       : hour,
      })
    })
  })

  return slots
}

function computeCompareSlots(alertsMap, regionKeys) {
  var DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
  var hm0 = computeHeatmap(alertsMap[regionKeys[0]])
  var hm1 = computeHeatmap(alertsMap[regionKeys[1]])

  var slots = []
  hm0.cells.forEach(function(dayCells, dow) {
    dayCells.forEach(function(cell, hour) {
      var p0  = cell.probability
      var p1  = hm1.cells[dow][hour].probability
      var row = {
        key        : dow + '-' + hour,
        fullLabel  : DAY_LABELS[dow] + ', ' + String(hour).padStart(2, '0') + ':00',
        label      : DAY_LABELS[dow] + ' ' + String(hour).padStart(2, '0') + ':00',
        avgProb    : (p0 + p1) / 2,
        count      : cell.count,
        total      : hm0.dowTotals[dow],
        avgDuration: 0,
      }
      row['prob_' + regionKeys[0]] = p0
      row['prob_' + regionKeys[1]] = p1
      slots.push(row)
    })
  })

  return slots
}

export function TopSlotsChart(props) {
  var alertsMap  = props.alertsMap
  var regionKeys = props.regionKeys

  var isCompare = regionKeys.length === 2
  var [mode, setMode] = useState('danger')

  var allSlots = isCompare
    ? computeCompareSlots(alertsMap, regionKeys)
    : computeSlots(alertsMap[regionKeys[0]])

  var chartData
  if (isCompare) {
    if (mode === 'danger') {
      chartData = allSlots
        .filter(function(s) { return s.avgProb >= DANGER_THRESHOLD })
        .sort(function(a, b) { return b.avgProb - a.avgProb })
        .slice(0, 8)
    } else {
      chartData = allSlots
        .filter(function(s) { return s.avgProb < SAFE_THRESHOLD })
        .sort(function(a, b) { return a.avgProb - b.avgProb })
        .slice(0, 8)
    }
  } else {
    if (mode === 'danger') {
      chartData = allSlots
        .filter(function(s) { return s.probability >= DANGER_THRESHOLD })
        .sort(function(a, b) { return b.probability - a.probability })
        .slice(0, 8)
    } else {
      chartData = allSlots
        .filter(function(s) { return s.probability < SAFE_THRESHOLD })
        .sort(function(a, b) { return a.probability - b.probability })
        .slice(0, 8)
    }
  }

  var isEmpty = chartData.length === 0

  // Для порівняння в безпечному режимі — інвертуємо значення для відображення
  function getBarValue(entry, key) {
    var raw = key ? entry[key] : entry.probability
    return mode === 'safe' ? 1 - raw : raw
  }

  var dangerActive = mode === 'danger'

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">
            {dangerActive ? 'Найнебезпечніші слоти' : 'Найбезпечніші слоти'}
          </h2>
          <p className="chart-subtitle">
            {dangerActive
              ? 'Ймовірність тривоги > 40% · топ-8'
              : 'Ймовірність безпеки > 60% · топ-8'}
          </p>
        </div>

        <div className="slots-controls">
          {isCompare && (
            <div className="chart-legend-row" style={{ marginBottom: 0 }}>
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
          <div className="slots-toggle">
            <button
              className={'slots-btn' + (dangerActive ? ' slots-btn--active-danger' : '')}
              onClick={function() { setMode('danger') }}
            >
              🚨 Небезпечні
            </button>
            <button
              className={'slots-btn' + (!dangerActive ? ' slots-btn--active-safe' : '')}
              onClick={function() { setMode('safe') }}
            >
              ✅ Безпечні
            </button>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="slots-empty">
          {dangerActive
            ? 'Слотів з ймовірністю > 40% не знайдено — добра новина!'
            : 'Слотів з безпекою > 60% не знайдено за поточними даними.'}
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={isCompare ? Math.max(chartData.length * 36 + 20, 180) : Math.max(chartData.length * 34 + 20, 160)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              barGap={3}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={function(v) { return Math.round(v * 100) + '%' }}
                tick={{ fill: '#8899aa', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                domain={[0, 1]}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: '#8899aa', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                content={function(p) { return <SlotTooltip active={p.active} payload={p.payload} mode={mode} /> }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />

              {isCompare ? (
                regionKeys.map(function(k) {
                  var dataKey = mode === 'safe'
                    ? 'safe_' + k
                    : 'prob_' + k

                  // Для безпечного режиму — додаємо поле safe_
                  var enriched = chartData.map(function(row) {
                    var r = Object.assign({}, row)
                    r['safe_' + k] = 1 - (row['prob_' + k] || 0)
                    return r
                  })

                  return (
                    <Bar
                      key={k}
                      data={enriched}
                      dataKey={dataKey}
                      name={REGION_NAMES[k]}
                      fill={dangerActive ? REGION_COLORS[k] : '#4ade80'}
                      radius={[0, 4, 4, 0]}
                      maxBarSize={14}
                      fillOpacity={0.85}
                    />
                  )
                })
              ) : (
                <Bar
                  dataKey={mode === 'safe' ? 'safety' : 'probability'}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                  fillOpacity={0.85}
                >
                  {chartData.map(function(entry, i) {
                    var fill
                    if (mode === 'safe') {
                      fill = '#4ade80'
                    } else {
                      fill = entry.probability >= 0.6 ? '#ef4444'
                        : entry.probability >= 0.5  ? '#f97316'
                        : '#eab308'
                    }
                    return <Cell key={i} fill={fill} />
                  })}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>

          {/* Тривалість — тільки для небезпечного режиму, одного регіону */}
          {!isCompare && dangerActive && chartData.some(function(d) { return d.avgDuration > 0 }) && (
            <div className="slots-duration-row">
              {chartData.map(function(d) {
                return d.avgDuration > 0 ? (
                  <div key={d.key} className="slots-duration-item">
                    <span className="slots-duration-label">{d.label}</span>
                    <span className="slots-duration-val">~{d.avgDuration} хв</span>
                  </div>
                ) : null
              })}
            </div>
          )}
        </>
      )}

      <p className="hm-note">
        {dangerActive
          ? 'Показані слоти з ймовірністю тривоги понад 40%. Колір: жовтий ≥40%, помаранчевий ≥50%, червоний ≥60%.'
          : 'Показані слоти де тривога траплялась менш ніж у 40% випадків. Оптимальні вікна для планування.'}
      </p>
    </div>
  )
}