import { computeHeatmap } from '../data/mockAlerts'

const REGION_COLORS = {
  kyiv    : { name: 'Вишгород', h: '217' },
  zhytomyr: { name: 'Житомир',  h: '24'  },
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) =>
  h % 3 === 0 ? `${String(h).padStart(2, '0')}` : ''
)

function probToOpacity(p) {
  if (p === 0)  return 0.04
  if (p < 0.10) return 0.20
  if (p < 0.20) return 0.40
  if (p < 0.35) return 0.60
  if (p < 0.50) return 0.78
  return 0.95
}

function HeatmapGrid({ cells, dowTotals, dayStats, quietestDow, hue, label }) {
  return (
    <div className="hm-grid-wrap">
      {label && (
        <div className="hm-grid-title" style={{ color: `hsl(${hue}, 80%, 65%)` }}>
          {label}
        </div>
      )}

      <div className="heatmap-wrap">
        {/* Заголовок годин */}
        <div className="hm-row hm-header-row">
          <span className="hm-day-label" />
          <span className="hm-pct-label" />
          {HOUR_LABELS.map((l, h) => (
            <span key={h} className="hm-hour-label">{l}</span>
          ))}
        </div>

        {/* Рядки днів */}
        {cells.map((dayCells, dow) => {
          const ds         = dayStats[dow]
          const isQuietest = dow === quietestDow
          const pct        = Math.round(ds.probability * 100)

          return (
            <div key={dow} className={`hm-row ${isQuietest ? 'hm-row--quiet' : ''}`}>
              <span className="hm-day-label" title={`${ds.daysWithAlert} з ${ds.totalDays} днів`}>
                {dayCells[0].day}
              </span>
              <span
                className="hm-pct-label"
                title={`Тривога в ${pct}% випадків`}
                style={{ color: isQuietest ? '#4ade80' : 'var(--text-muted)' }}
              >
                {pct}%
                {isQuietest && <span className="hm-quiet-badge">тихо</span>}
              </span>
              {dayCells.map(cell => (
                <span
                  key={cell.hour}
                  className="hm-cell"
                  style={{
                    background: `hsla(${hue}, 80%, 55%, ${probToOpacity(cell.probability)})`,
                  }}
                  title={`${cell.day} ${cell.label} — ${(cell.probability * 100).toFixed(0)}% (${cell.count}/${dowTotals[dow]} дн.)`}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function HeatmapChart({ alertsMap, regionKeys }) {
  const isCompare = regionKeys.length === 2
  const maps = Object.fromEntries(
    regionKeys.map(k => [k, computeHeatmap(alertsMap[k])])
  )
  const primary = maps[regionKeys[0]]

  return (
    <div className="chart-card heatmap-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Теплова карта тривог</h2>
          <p className="chart-subtitle">
            Година × день тижня · {primary.periodFrom} — {primary.periodTo}
          </p>
        </div>
        <div className="hm-legend">
          {[['0%', 0.04], ['10%', 0.25], ['35%', 0.62], ['50%+', 0.95]].map(([label, op]) => (
            <span key={label} className="hm-legend-item">
              <span className="hm-legend-swatch" style={{ background: `rgba(100,150,255,${op})` }} />
              <span className="hm-legend-label">{label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className={isCompare ? 'hm-compare-row' : ''}>
        {regionKeys.map(k => (
          <HeatmapGrid
            key={k}
            cells={maps[k].cells}
            dowTotals={maps[k].dowTotals}
            dayStats={maps[k].dayStats}
            quietestDow={maps[k].quietestDow}
            hue={REGION_COLORS[k].h}
            label={isCompare ? REGION_COLORS[k].name : null}
          />
        ))}
      </div>

      <p className="hm-note">
        % поруч з днем = частка {isCompare ? 'відповідних ' : ''}днів у яких була хоча б одна тривога.
        Знаменник відповідає реальній кількості таких днів у вибірці.
        Комірка = частка конкретних дат з тривогою в цю годину.
      </p>
    </div>
  )
}
