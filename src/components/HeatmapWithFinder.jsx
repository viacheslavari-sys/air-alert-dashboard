import { useState } from 'react'
import { computeHeatmap } from '../data/mockAlerts'

const DAY_LABELS  = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

// Колір ∑ від зеленого (мало) до червоного (багато)
function dowCountColor(count, maxCount) {
  if (maxCount === 0) return '#8899aa'
  var ratio = count / maxCount
  if (ratio <= 0.25) return '#4ade80'  // зелений
  if (ratio <= 0.5)  return '#a3e635'  // жовто-зелений
  if (ratio <= 0.75) return '#f97316'  // помаранчевий
  return '#ef4444'                      // червоний
}
const HOUR_START  = 6
const HOUR_END    = 22
const HOUR_LABELS = Array.from({ length: 24 }, function(_, h) {
  return h % 3 === 0 ? String(h).padStart(2, '0') : ''
})

function countToOpacity(count, maxCount) {
  if (count === 0 || maxCount === 0) return 0.03
  return 0.12 + (count / maxCount) * 0.83
}

function findSafeWindows(hm, windowSize) {
  var results = []
  hm.cells.forEach(function(dayCells, dow) {
    for (var start = HOUR_START; start + windowSize - 1 <= HOUR_END; start++) {
      var allClear = true
      for (var h = start; h < start + windowSize; h++) {
        if (dayCells[h].count > 0) { allClear = false; break }
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
  })
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
  var _win        = useState(8)
  var windowSize  = _win[0]
  var setWindow   = _win[1]

  var _active    = useState(false)
  var isActive   = _active[0]
  var setActive  = _active[1]

  var _hover     = useState(null)
  var hoveredWin = _hover[0]
  var setHovered = _hover[1]

  var hm      = computeHeatmap(alerts)
  var windows = isActive ? findSafeWindows(hm, windowSize) : []
  var hlSet   = isActive ? buildHighlightSet(windows) : {}
  var blinkSet = buildBlinkSet(hoveredWin)

  var maxWindow = HOUR_END - HOUR_START + 1
  var hue = regionKey === 'zhytomyr' ? '24' : '217'

  return (
    <div className="chart-card heatmap-card">

      {/* ── Заголовок ── */}
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Теплова карта тривог</h2>
          <p className="chart-subtitle">
            {hm.periodFrom} — {hm.periodTo} · кількість тривог за слот
          </p>
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

      {/* ── Теплова карта ── */}
      <div className="heatmap-wrap">
        <div className="hm-row hm-header-row">
          <span className="hm-day-label" />
          <span className="hm-count-label" title="Всього тривог за період">∑</span>
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
          var isQuietest = dow === hm.quietestDow
          return (
            <div
              key={dow}
              className={'hm-row ' + (isQuietest ? 'hm-row--quiet' : '')}
            >
              <span className="hm-day-label">{DAY_LABELS[dow]}</span>
              <span
                className="hm-count-label"
                style={{ color: dowCountColor(hm.dowCount[dow], Math.max.apply(null, hm.dowCount)) }}
                title={DAY_LABELS[dow] + ' — ' + hm.dowCount[dow] + ' тривог за весь період'}
              >
                {hm.dowCount[dow]}
              </span>

              {dayCells.map(function(cell) {
                var key        = dow + '-' + cell.hour
                var inRange    = cell.hour >= HOUR_START && cell.hour <= HOUR_END
                var isGreen    = hlSet[key]
                var isBlinking = blinkSet[key]
                // Затемнення нічних годин тільки в активному режимі
                var isDim      = isActive && !inRange

                var bg
                if (isDim) {
                  bg = 'rgba(255,255,255,0.01)'
                } else if (isGreen) {
                  bg = 'hsla(142, 70%, 50%, 0.65)'
                } else {
                  bg = 'hsla(' + hue + ', 80%, 55%, ' +
                    countToOpacity(cell.count, hm.maxSlotCount) + ')'
                }

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
                          (cell.avgDuration > 0 ? ', серед. ' + cell.avgDuration + ' хв' : '')
                    }
                  />
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── Результати — тільки в активному режимі ── */}
      {isActive && (
        <div className="sf-results-section">
          <div className="sf-results-header">
            {windows.length === 0
              ? 'Немає чистих вікон на ' + windowSize + ' год у діапазоні 06:00–22:00 — спробуйте зменшити тривалість'
              : 'Знайдено ' + windows.length + ' вікн' +
                (windows.length === 1 ? 'о' : windows.length < 5 ? 'а' : '') +
                ' без тривог · наведіть щоб підсвітити на карті'}
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
        ∑ = загальна кількість тривог за весь зібраний період для цього дня тижня.
        {isActive
          ? ' Зелені клітинки = нуль тривог. Нічні години затемнені під час пошуку. Статистичний прогноз — не гарантія.'
          : ' Натисніть «Показати» для пошуку безпечних вікон у діапазоні 06:00–22:00.'}
      </p>
    </div>
  )
}