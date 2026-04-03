import { useState } from 'react'
import { computeHeatmap } from '../data/mockAlerts'

const DAY_LABELS  = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const HOUR_START  = 6
const HOUR_END    = 22
const HOUR_LABELS = Array.from({ length: 24 }, function(_, h) {
  return h % 3 === 0 ? String(h).padStart(2, '0') : ''
})

const SEARCH_RANGES = [
  { label: '7 днів',  days: 7  },
  { label: '14 днів', days: 14 },
  { label: '30 днів', days: 30 },
]

// Колір ∑ від зеленого до червоного
function dowCountColor(count, maxCount) {
  if (maxCount === 0) return '#8899aa'
  var ratio = count / maxCount
  if (ratio <= 0.25) return '#4ade80'
  if (ratio <= 0.5)  return '#a3e635'
  if (ratio <= 0.75) return '#f97316'
  return '#ef4444'
}

// Обчислює зважену теплову карту з остиганням
// Кожна тривога отримує вагу e^(-вік/tau) де tau = halflife/ln(2)
function computeDecayHeatmap(alerts, halfLifeDays) {
  var now  = Date.now()
  var tau  = halfLifeDays / Math.LN2  // константа загасання

  // Зважена сума по слоту [dow][hour]
  var slotWeight   = Array.from({ length: 7 }, function() { return Array(24).fill(0) })
  var dowWeight    = Array(7).fill(0)
  var slotDuration = Array.from({ length: 7 }, function() { return Array(24).fill(0) })
  var slotCount    = Array.from({ length: 7 }, function() { return Array(24).fill(0) })

  alerts.forEach(function(a) {
    var d      = new Date(a.started_at)
    var dow    = (d.getDay() + 6) % 7
    var hour   = d.getHours()
    var ageDays = (now - d.getTime()) / 86400000
    var weight  = Math.exp(-ageDays / tau)

    slotWeight[dow][hour] += weight
    dowWeight[dow]        += weight

    if (a.duration_minutes) {
      slotDuration[dow][hour] += a.duration_minutes
      slotCount[dow][hour]    += 1
    }
  })

  // Максимум для нормалізації
  var maxWeight = 0
  for (var d2 = 0; d2 < 7; d2++) {
    for (var h = 0; h < 24; h++) {
      if (slotWeight[d2][h] > maxWeight) maxWeight = slotWeight[d2][h]
    }
  }
  var maxDowWeight = Math.max.apply(null, dowWeight) || 1

  return {
    slotWeight  : slotWeight,
    dowWeight   : dowWeight,
    maxWeight   : maxWeight,
    maxDowWeight: maxDowWeight,
    slotDuration: slotDuration,
    slotCount   : slotCount,
  }
}

// Opacity для клітинки з остиганням
function weightToOpacity(weight, maxWeight) {
  if (weight === 0 || maxWeight === 0) return 0.03
  return 0.1 + (weight / maxWeight) * 0.88
}

// Пошук безпечних вікон у відфільтрованих за діапазоном тривогах
function findSafeWindows(alerts, windowSize, searchDays) {
  var cutoff = Date.now() - searchDays * 86400000
  var recent = alerts.filter(function(a) {
    return new Date(a.started_at).getTime() >= cutoff
  })

  // Будуємо set зайнятих слотів
  var busySet = {}
  recent.forEach(function(a) {
    var d   = new Date(a.started_at)
    var dow  = (d.getDay() + 6) % 7
    var hour = d.getHours()
    busySet[dow + '-' + hour] = true
  })

  var results = []
  for (var dow = 0; dow < 7; dow++) {
    for (var start = HOUR_START; start + windowSize - 1 <= HOUR_END; start++) {
      var allClear = true
      for (var h = start; h < start + windowSize; h++) {
        if (busySet[dow + '-' + h]) { allClear = false; break }
      }
      if (allClear) {
        results.push({
          key      : dow + '-' + start,
          dow      : dow,
          day      : DAY_LABELS[dow],
          startHour: start,
          endHour  : start + windowSize - 1,
        })
      }
    }
  }
  return results
}

function buildHighlightSet(windows) {
  var set = {}
  windows.forEach(function(w) {
    for (var h = w.startHour; h <= w.endHour; h++) {
      set[w.dow + '-' + h] = true
    }
  })
  return set
}

function buildBlinkSet(win) {
  if (!win) return {}
  var set = {}
  for (var h = win.startHour; h <= win.endHour; h++) {
    set[win.dow + '-' + h] = true
  }
  return set
}

export function HeatmapWithFinder({ alerts, regionKey }) {
  // Остигання
  var _decay    = useState(30)
  var decayDays = _decay[0]
  var setDecay  = _decay[1]

  // Пошук вікон
  var _win       = useState(8)
  var windowSize = _win[0]
  var setWindow  = _win[1]

  var _active   = useState(false)
  var isActive  = _active[0]
  var setActive = _active[1]

  var _range      = useState(1)  // індекс SEARCH_RANGES, дефолт 14 днів
  var rangeIdx    = _range[0]
  var setRange    = _range[1]

  var _hover     = useState(null)
  var hoveredWin = _hover[0]
  var setHovered = _hover[1]

  var hue = regionKey === 'zhytomyr' ? '24' : '217'

  // Зважена карта для відображення
  var decay    = computeDecayHeatmap(alerts || [], decayDays)

  // Повна карта для ∑ (абсолютні кількості)
  var hm       = computeHeatmap(alerts || [])

  // Пошук вікон
  var searchDays = SEARCH_RANGES[rangeIdx].days
  var windows    = isActive ? findSafeWindows(alerts || [], windowSize, searchDays) : []
  var hlSet      = isActive ? buildHighlightSet(windows) : {}
  var blinkSet   = buildBlinkSet(hoveredWin)

  var maxWindow  = HOUR_END - HOUR_START + 1

  return (
    <div className="chart-card heatmap-card">

      {/* ── Заголовок ── */}
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Теплова карта тривог</h2>
          <p className="chart-subtitle">
            Остигання {decayDays} дн · яскравість = відносна свіжість
          </p>
        </div>

        <div className="hm-top-controls">
          {/* Повзунок остигання */}
          <div className="hm-decay-control">
            <span className="sf-controls-label">Остигання</span>
            <div className="hm-decay-row">
              <span className="hm-decay-edge">сьогодні</span>
              <input
                type="range"
                min={7}
                max={90}
                step={1}
                value={decayDays}
                className="hm-decay-slider"
                onChange={function(e) { setDecay(Number(e.target.value)) }}
              />
              <span className="hm-decay-edge">90 дн</span>
              <span className="hm-decay-value">{decayDays} дн</span>
            </div>
          </div>

          {/* Контролі пошуку */}
          <div className="sf-controls">
            <span className="sf-controls-label">Пошук безпечного вікна</span>
            <div className="sf-slider-row">
              <button
                className="sf-btn"
                onClick={function() { setWindow(Math.max(1, windowSize - 1)) }}
                disabled={windowSize <= 1}
              >−</button>
              <span className="sf-window-value">{windowSize} год</span>
              <button
                className="sf-btn"
                onClick={function() { setWindow(Math.min(maxWindow, windowSize + 1)) }}
                disabled={windowSize >= maxWindow}
              >+</button>
              {/* Діапазон пошуку */}
              {SEARCH_RANGES.map(function(opt, i) {
                return (
                  <button
                    key={opt.label}
                    className={'sf-range-btn ' + (rangeIdx === i ? 'sf-range-btn--active' : '')}
                    onClick={function() { setRange(i) }}
                  >
                    {opt.label}
                  </button>
                )
              })}
              <button
                className={'sf-toggle-btn ' + (isActive ? 'sf-toggle-btn--active' : '')}
                onClick={function() {
                  setActive(!isActive)
                  if (isActive) setHovered(null)
                }}
              >
                {isActive ? 'Сховати' : 'Показати'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Теплова карта ── */}
      <div className="heatmap-wrap">
        <div className="hm-row hm-header-row">
          <span className="hm-day-label" />
          <span className="hm-count-label" title="Всього тривог за весь час">∑</span>
          {HOUR_LABELS.map(function(l, h) {
            var outOfRange = isActive && (h < HOUR_START || h > HOUR_END)
            return (
              <span
                key={h}
                className="hm-hour-label"
                style={{ opacity: outOfRange ? 0.2 : 1 }}
              >
                {l}
              </span>
            )
          })}
        </div>

        {hm.cells.map(function(dayCells, dow) {
          return (
            <div key={dow} className="hm-row">
              <span className="hm-day-label">{DAY_LABELS[dow]}</span>
              <span
                className="hm-count-label"
                style={{ color: dowCountColor(hm.dowCount[dow], Math.max.apply(null, hm.dowCount)) }}
                title={DAY_LABELS[dow] + ' — ' + hm.dowCount[dow] + ' тривог за весь час'}
              >
                {hm.dowCount[dow]}
              </span>

              {dayCells.map(function(cell) {
                var key        = dow + '-' + cell.hour
                var inRange    = cell.hour >= HOUR_START && cell.hour <= HOUR_END
                var isGreen    = hlSet[key]
                var isBlinking = blinkSet[key]
                var isDim      = isActive && !inRange

                var bg
                if (isDim) {
                  bg = 'rgba(255,255,255,0.01)'
                } else if (isGreen) {
                  bg = 'hsla(142, 70%, 50%, 0.65)'
                } else {
                  var op = weightToOpacity(
                    decay.slotWeight[dow][cell.hour],
                    decay.maxWeight
                  )
                  bg = 'hsla(' + hue + ', 80%, 55%, ' + op + ')'
                }

                var dur = decay.slotCount[dow][cell.hour] > 0
                  ? Math.round(decay.slotDuration[dow][cell.hour] / decay.slotCount[dow][cell.hour])
                  : 0

                return (
                  <span
                    key={cell.hour}
                    className={
                      'hm-cell' +
                      (isGreen    ? ' hm-cell--safe'  : '') +
                      (isBlinking ? ' hm-cell--blink' : '') +
                      (isDim      ? ' hm-cell--dim'   : '')
                    }
                    style={{ background: bg }}
                    title={
                      isDim ? '' :
                      isGreen
                        ? cell.day + ' ' + cell.label + ' — безпечна година'
                        : cell.day + ' ' + cell.label + ' — ' + cell.count + ' тривог' +
                          (dur > 0 ? ', серед. ' + dur + ' хв' : '')
                    }
                  />
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── Результати пошуку ── */}
      {isActive && (
        <div className="sf-results-section">
          <div className="sf-results-header">
            {windows.length === 0
              ? 'Немає чистих вікон на ' + windowSize + ' год за останні ' + searchDays + ' дн · спробуйте зменшити тривалість або діапазон'
              : 'Знайдено ' + windows.length + ' вікн' +
                (windows.length === 1 ? 'о' : windows.length < 5 ? 'а' : '') +
                ' за останні ' + searchDays + ' дн · наведіть щоб підсвітити'}
          </div>
          {windows.length > 0 && (
            <div className="sf-tags">
              {windows.map(function(w) {
                return (
                  <span
                    key={w.key}
                    className={'sf-tag ' + (hoveredWin && hoveredWin.key === w.key ? 'sf-tag--hovered' : '')}
                    onMouseEnter={function() { setHovered(w) }}
                    onMouseLeave={function() { setHovered(null) }}
                  >
                    <span className="sf-tag-day">{w.day}</span>
                    <span className="sf-tag-time">
                      {String(w.startHour).padStart(2, '0')}:00 –{' '}
                      {String(w.startHour + windowSize).padStart(2, '0')}:00
                    </span>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      <p className="hm-note">
        ∑ = загальна кількість тривог за весь час · яскравість клітинок враховує вік тривоги.
        {isActive && ' Пошук вікон — тривоги без ' + searchDays + ' дн.'}
      </p>
    </div>
  )
}