import { computeHeatmap } from '../data/mockAlerts'

const REGION_COLORS = {
  kyiv    : { name: 'Вишгород', h: '217' },
  zhytomyr: { name: 'Житомир',  h: '24'  },
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) =>
  h % 3 === 0 ? `${String(h).padStart(2, '0')}` : ''
)

function probToOpacity(p) {
  if (p === 0)   return 0.04
  if (p < 0.10)  return 0.2
  if (p < 0.20)  return 0.4
  if (p < 0.35)  return 0.6
  if (p < 0.50)  return 0.78
  return 0.95
}

function HeatmapGrid({ cells, totalWeeks, hue, label }) {
  return (
    <div className="hm-grid-wrap">
      <div className="hm-grid-title" style={{ color: `hsl(${hue}, 80%, 65%)` }}>
        {label}
      </div>
      <div className="heatmap-wrap">
        <div className="hm-row hm-header-row">
          <span className="hm-day-label" />
          {HOUR_LABELS.map((l, h) => (
            <span key={h} className="hm-hour-label">{l}</span>
          ))}
        </div>
        {cells.map((dayCells, dow) => (
          <div key={dow} className="hm-row">
            <span className="hm-day-label">{dayCells[0].day}</span>
            {dayCells.map(cell => (
              <span
                key={cell.hour}
                className="hm-cell"
                style={{
                  background: `hsla(${hue}, 80%, 55%, ${probToOpacity(cell.probability)})`,
                }}
                title={`${cell.day} ${cell.label} — ${(cell.probability * 100).toFixed(0)}% (${cell.count}/${totalWeeks})`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function HeatmapChart({ alertsMap, regionKeys }) {
  const isCompare = regionKeys.length === 2
  const maps = Object.fromEntries(
    regionKeys.map(k => [k, computeHeatmap(alertsMap[k])])
  )
  const totalWeeks = maps[regionKeys[0]]?.totalWeeks ?? 4

  return (
    <div className="chart-card heatmap-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Теплова карта тривог</h2>
          <p className="chart-subtitle">Година × день тижня · {totalWeeks} тижн.</p>
        </div>
        <div className="hm-legend">
          <span className="hm-legend-item"><span className="hm-legend-swatch" style={{ background: 'rgba(255,255,255,0.04)' }} /><span className="hm-legend-label">0%</span></span>
          <span className="hm-legend-item"><span className="hm-legend-swatch" style={{ background: 'rgba(100,150,255,0.35)' }} /><span className="hm-legend-label">10%</span></span>
          <span className="hm-legend-item"><span className="hm-legend-swatch" style={{ background: 'rgba(100,150,255,0.65)' }} /><span className="hm-legend-label">35%</span></span>
          <span className="hm-legend-item"><span className="hm-legend-swatch" style={{ background: 'rgba(100,150,255,0.95)' }} /><span className="hm-legend-label">50%+</span></span>
        </div>
      </div>

      <div className={isCompare ? 'hm-compare-row' : ''}>
        {regionKeys.map(k => (
          <HeatmapGrid
            key={k}
            cells={maps[k].cells}
            totalWeeks={maps[k].totalWeeks}
            hue={REGION_COLORS[k].h}
            label={isCompare ? REGION_COLORS[k].name : null}
          />
        ))}
      </div>

      <p className="hm-note">
        Частка тижнів у яких була тривога в цей час. Наведіть на комірку для деталей.
      </p>
    </div>
  )
}
