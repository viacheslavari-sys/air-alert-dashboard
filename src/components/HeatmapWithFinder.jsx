import { useState } from 'react'
import { computeHeatmap } from '../data/mockAlerts'

const DAY_LABELS  = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
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

// Будує set підсвічених клітинок для швидкого lookup
function buildHighlightSet(windows) {
  var set = {}
  windows.forEach(function(w) {
    for (var h = w.startHour; h <= w.endHour; h++) {
      set[w.dow + '-' + h] = true
    }
  })
  return set
}

// Будує set "блимаючих" клітинок при наведенні на тег
function buildBlinkSet(win) {
  if (!win) return {}
  var set = {}
  for (var h = win.startHour; h <= win.endHour; h++) {
    set[win.dow + '-' + h] = true
  }
  return set
}

export function HeatmapWithFinder({ alerts, regionKey }) {
  var _win       = useState(4)
  var windowSize = _win[0]
  var setWindow  = _win[1]

  var _hover    = useState(null)
  var hoveredWin = _hover[0]
  var setHovered = _hover[1]

  var hm       = computeHeatmap(alerts)
  var windows  = findSafeWindows(hm, windowSize)
  var hlSet    = buildHighlightSet(windows)
  var blinkSet = buildBlinkSet(hoveredWin)

  var maxWindow = HOUR_END - HOUR_START + 1
  var hue = regionKey === 'zhytomyr' ? '24' : '217'

  return (
    <div className="chart-card heatmap-card">

      {/* ── Заголовок ── */}
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Теплова карта · Пошук безпечних вікон</h2>
          <p className="chart-subtitle">
            {hm.periodFrom} — {hm.periodTo} · колір = кількість тривог
          </p>
        </div>

        {/* Слайдер */}
        <div className="sf-controls">
          <span className="sf-controls-label">Вікно без тривог</span>
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
          </div>
        </div>
      </div>

      {/* ── Теплова карта ── */}
      <div className="heatmap-wrap">
        {/* Заголовок годин */}
        <div className="hm-row hm-header-row">
          <span className="hm-day-label" />
          <span className="hm-count-label" title="Всього тривог за період">∑</span>
          {HOUR_LABELS.map(function(l, h) {
            return (
              <span
                key={h}
                className="hm-hour-label"
                style={{ opacity: (h >= HOUR_START && h <= HOUR_END) ? 1 : 0.3 }}
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
                style={{ color: isQuietest ? '#4ade80' : '#8899aa' }}
                title={DAY_LABELS[dow] + ' — ' + hm.dowCount[dow] + ' тривог за весь період'}
              >
                {hm.dowCount[dow]}
                {isQuietest && <span className="hm-quiet-badge">тихо</span>}
              </span>

              {dayCells.map(function(cell) {
                var key        = dow + '-' + cell.hour
                var inRange    = cell.hour >= HOUR_START && cell.hour <= HOUR_END
                var isGreen    = hlSet[key]
                var isBlinking = blinkSet[key]

                var bg
                if (!inRange) {
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
                      (isGreen    ? ' hm-cell--safe'    : '') +
                      (isBlinking ? ' hm-cell--blink'   : '') +
                      (!inRange   ? ' hm-cell--dim'     : '')
                    }
                    style={{ background: bg }}
                    title={
                      !inRange ? '' :
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

      {/* ── Результати пошуку ── */}
      <div className="sf-results-section">
        <div className="sf-results-header">
          {windows.length === 0
            ? 'Немає чистих вікон на ' + windowSize + ' год у діапазоні 06:00–22:00'
            : 'Знайдено ' + windows.length + ' вікн' +
              (windows.length === 1 ? 'о' : windows.length < 5 ? 'а' : '') +
              ' без тривог'}
        </div>

        {windows.length === 0 ? (
          <div className="sf-no-results">
            Спробуйте зменшити тривалість вікна.
          </div>
        ) : (
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

      <p className="hm-note">
        Зелені клітинки = нуль тривог за весь зібраний період.
        Наведіть на тег щоб підсвітити вікно на карті.
        Години поза 06:00–22:00 затемнені.
        Статистичний прогноз — не гарантія.
      </p>
    </div>
  )
}