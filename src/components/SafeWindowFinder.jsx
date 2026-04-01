import { useState } from 'react'
import { computeHeatmap } from '../data/mockAlerts'

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const HOUR_START = 6   // 06:00
const HOUR_END   = 22  // до 22:00 (включно)
const HOUR_LABELS = Array.from({ length: 24 }, function(_, h) {
  return h % 3 === 0 ? String(h).padStart(2, '0') : ''
})

const REGION_COLORS = {
  kyiv    : { name: 'Вишгород', h: '217' },
  zhytomyr: { name: 'Житомир',  h: '24'  },
}

// Шукає всі чисті вікна заданої довжини для одного регіону
function findSafeWindows(hm, windowSize) {
  var results = []

  hm.cells.forEach(function(dayCells, dow) {
    // Перебираємо всі можливі початки блоку в діапазоні 06:00–22:00
    for (var startHour = HOUR_START; startHour + windowSize - 1 <= HOUR_END; startHour++) {
      var allClear = true
      for (var h = startHour; h < startHour + windowSize; h++) {
        if (dayCells[h].count > 0) {
          allClear = false
          break
        }
      }
      if (allClear) {
        results.push({
          dow      : dow,
          day      : DAY_LABELS[dow],
          startHour: startHour,
          endHour  : startHour + windowSize - 1,
          label    : DAY_LABELS[dow] + ' ' +
            String(startHour).padStart(2, '0') + ':00 – ' +
            String(startHour + windowSize).padStart(2, '0') + ':00',
        })
      }
    }
  })

  return results
}

function countToOpacity(count, maxCount) {
  if (count === 0 || maxCount === 0) return 0.03
  var ratio = count / maxCount
  return 0.12 + ratio * 0.83
}

function isInWindow(hour, win) {
  return hour >= win.startHour && hour < win.startHour + 1 + (win.endHour - win.startHour)
}

// Міні теплова карта з підсвіченими вікнами
function MiniHeatmap({ hm, windows, hue, windowSize }) {
  var highlightSet = {}
  windows.forEach(function(w) {
    for (var h = w.startHour; h <= w.endHour; h++) {
      highlightSet[w.dow + '-' + h] = true
    }
  })

  return (
    <div className="heatmap-wrap sf-heatmap">
      {/* Заголовок годин */}
      <div className="hm-row hm-header-row">
        <span className="hm-day-label" />
        {HOUR_LABELS.map(function(l, h) {
          return (
            <span
              key={h}
              className="hm-hour-label"
              style={{
                opacity: (h >= HOUR_START && h <= HOUR_END) ? 1 : 0.3,
              }}
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
            {dayCells.map(function(cell) {
              var inRange    = cell.hour >= HOUR_START && cell.hour <= HOUR_END
              var highlighted = highlightSet[dow + '-' + cell.hour]
              var outOfRange  = !inRange

              var bg
              if (outOfRange) {
                bg = 'rgba(255,255,255,0.01)'
              } else if (highlighted) {
                bg = 'hsla(142, 70%, 50%, 0.7)'  // зелений
              } else {
                bg = 'hsla(' + hue + ', 80%, 55%, ' +
                  countToOpacity(cell.count, hm.maxSlotCount) + ')'
              }

              return (
                <span
                  key={cell.hour}
                  className={'hm-cell' + (highlighted ? ' hm-cell--safe' : '') + (outOfRange ? ' hm-cell--dim' : '')}
                  style={{ background: bg }}
                  title={
                    outOfRange ? '' :
                    highlighted
                      ? cell.day + ' ' + cell.label + ' — входить у безпечне вікно'
                      : cell.day + ' ' + cell.label + ' — ' + cell.count + ' тривог'
                  }
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function RegionResult({ regionKey, hm, windows, windowSize }) {
  var color = REGION_COLORS[regionKey]
  var isEmpty = windows.length === 0

  return (
    <div className="sf-region">
      <MiniHeatmap
        hm={hm}
        windows={windows}
        hue={color.h}
        windowSize={windowSize}
      />

      <div className="sf-windows-list">
        {isEmpty ? (
          <div className="sf-no-results">
            <span className="sf-no-icon">—</span>
            <span>
              Немає повністю чистих вікон на {windowSize} год у діапазоні 06:00–22:00.
              Спробуйте зменшити тривалість.
            </span>
          </div>
        ) : (
          <>
            <div className="sf-results-header">
              Знайдено {windows.length} вікн{windows.length === 1 ? 'о' : windows.length < 5 ? 'а' : ''}
            </div>
            <div className="sf-tags">
              {windows.map(function(w, i) {
                return (
                  <span key={i} className="sf-tag">
                    <span className="sf-tag-day">{w.day}</span>
                    <span className="sf-tag-time">
                      {String(w.startHour).padStart(2, '0')}:00 –{' '}
                      {String(w.startHour + windowSize).padStart(2, '0')}:00
                    </span>
                  </span>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function SafeWindowFinder({ alertsMap, regionKeys }) {
  var _state      = useState(4)
  var windowSize  = _state[0]
  var setWindow   = _state[1]

  var isCompare = regionKeys.length === 2

  var maps    = {}
  var windows = {}
  regionKeys.forEach(function(k) {
    maps[k]    = computeHeatmap(alertsMap[k])
    windows[k] = findSafeWindows(maps[k], windowSize)
  })

  var maxWindow = HOUR_END - HOUR_START + 1  // 17 годин

  return (
    <div className="chart-card sf-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Пошук безпечних вікон</h2>
          <p className="chart-subtitle">
            Послідовні години без жодної тривоги · 06:00–22:00
          </p>
        </div>

        {/* Слайдер кількості годин */}
        <div className="sf-controls">
          <span className="sf-controls-label">Тривалість вікна</span>
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

      {isCompare ? (
        <div className="sf-compare">
          {regionKeys.map(function(k) {
            return (
              <div key={k} className="sf-compare-col">
                <div
                  className="sf-compare-title"
                  style={{ color: 'hsl(' + REGION_COLORS[k].h + ', 80%, 65%)' }}
                >
                  {REGION_COLORS[k].name}
                </div>
                <RegionResult
                  regionKey={k}
                  hm={maps[k]}
                  windows={windows[k]}
                  windowSize={windowSize}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <RegionResult
          regionKey={regionKeys[0]}
          hm={maps[regionKeys[0]]}
          windows={windows[regionKeys[0]]}
          windowSize={windowSize}
        />
      )}

      <p className="hm-note">
        Зелені клітинки = безпечне вікно (нуль тривог за весь зібраний період).
        Затемнені клітинки поза діапазоном пошуку.
        Статистичний прогноз на основі минулих даних — не гарантія.
      </p>
    </div>
  )
}