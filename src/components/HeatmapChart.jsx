import { computeHeatmap } from '../data/mockAlerts'

const REGION_COLORS = {
  kyiv    : { name: 'Вишгород', h: '217' },
  zhytomyr: { name: 'Житомир',  h: '24'  },
}

const HOUR_LABELS = Array.from({ length: 24 }, function(_, h) {
  return h % 3 === 0 ? String(h).padStart(2, '0') : ''
})

// Нормалізуємо колір по максимуму вибірки
function countToOpacity(count, maxCount) {
  if (count === 0 || maxCount === 0) return 0.03
  var ratio = count / maxCount
  // Мінімальна видимість 0.12 щоб навіть 1 тривога була помітна
  return 0.12 + ratio * 0.83
}

function HeatmapGrid({ cells, dayStats, quietestDow, dowCount, maxSlotCount, hue, label }) {
  return (
    <div className="hm-grid-wrap">
      {label && (
        <div className="hm-grid-title" style={{ color: 'hsl(' + hue + ', 80%, 65%)' }}>
          {label}
        </div>
      )}

      <div className="heatmap-wrap">
        {/* Заголовок годин */}
        <div className="hm-row hm-header-row">
          <span className="hm-day-label" />
          <span className="hm-count-label" title="Всього тривог за період">∑</span>
          {HOUR_LABELS.map(function(l, h) {
            return <span key={h} className="hm-hour-label">{l}</span>
          })}
        </div>

        {/* Рядки днів */}
        {cells.map(function(dayCells, dow) {
          var ds         = dayStats[dow]
          var isQuietest = dow === quietestDow
          var totalCount = dowCount[dow]

          return (
            <div
              key={dow}
              className={'hm-row ' + (isQuietest ? 'hm-row--quiet' : '')}
            >
              <span className="hm-day-label">
                {dayCells[0].day}
              </span>

              {/* Загальна кількість тривог за день тижня */}
              <span
                className="hm-count-label"
                title={dayCells[0].day + ' — ' + totalCount + ' тривог за весь період'}
                style={{ color: isQuietest ? '#4ade80' : '#8899aa' }}
              >
                {totalCount}
                {isQuietest && <span className="hm-quiet-badge">тихо</span>}
              </span>

              {/* Клітинки по годинах */}
              {dayCells.map(function(cell) {
                return (
                  <span
                    key={cell.hour}
                    className="hm-cell"
                    style={{
                      background: 'hsla(' + hue + ', 80%, 55%, ' + countToOpacity(cell.count, maxSlotCount) + ')',
                    }}
                    title={
                      cell.day + ' ' + cell.label +
                      ' — ' + cell.count + ' тривог' +
                      (cell.avgDuration > 0 ? ', серед. ' + cell.avgDuration + ' хв' : '')
                    }
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function HeatmapChart({ alertsMap, regionKeys }) {
  var isCompare = regionKeys.length === 2

  var maps = {}
  regionKeys.forEach(function(k) {
    maps[k] = computeHeatmap(alertsMap[k])
  })

  var primary = maps[regionKeys[0]]

  return (
    <div className="chart-card heatmap-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Теплова карта тривог</h2>
          <p className="chart-subtitle">
            Кількість тривог · {primary.periodFrom} — {primary.periodTo}
          </p>
        </div>
        <div className="hm-legend">
          <span className="hm-legend-item">
            <span className="hm-legend-swatch" style={{ background: 'rgba(100,150,255,0.03)' }} />
            <span className="hm-legend-label">0</span>
          </span>
          <span className="hm-legend-item">
            <span className="hm-legend-swatch" style={{ background: 'rgba(100,150,255,0.35)' }} />
            <span className="hm-legend-label">мало</span>
          </span>
          <span className="hm-legend-item">
            <span className="hm-legend-swatch" style={{ background: 'rgba(100,150,255,0.70)' }} />
            <span className="hm-legend-label">багато</span>
          </span>
          <span className="hm-legend-item">
            <span className="hm-legend-swatch" style={{ background: 'rgba(100,150,255,0.95)' }} />
            <span className="hm-legend-label">макс</span>
          </span>
        </div>
      </div>

      <div className={isCompare ? 'hm-compare-row' : ''}>
        {regionKeys.map(function(k) {
          var m = maps[k]
          return (
            <HeatmapGrid
              key={k}
              cells={m.cells}
              dayStats={m.dayStats}
              quietestDow={m.quietestDow}
              dowCount={m.dowCount}
              maxSlotCount={m.maxSlotCount}
              hue={REGION_COLORS[k].h}
              label={isCompare ? REGION_COLORS[k].name : null}
            />
          )
        })}
      </div>

      <p className="hm-note">
        ∑ = загальна кількість тривог за весь зібраний період для цього дня тижня.
        Колір клітинки = кількість тривог в цю годину, нормалізована по максимуму вибірки.
        {isCompare && ' Кожен регіон нормалізований окремо.'}
      </p>
    </div>
  )
}