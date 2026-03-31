import { computeHeatmap } from '../data/mockAlerts'

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) =>
  h % 3 === 0 ? `${String(h).padStart(2, '0')}` : ''
)

function probToColor(p) {
  if (p === 0)   return 'var(--hm-0)'
  if (p < 0.10)  return 'var(--hm-1)'
  if (p < 0.20)  return 'var(--hm-2)'
  if (p < 0.35)  return 'var(--hm-3)'
  if (p < 0.50)  return 'var(--hm-4)'
  return               'var(--hm-5)'
}

function probToTextColor(p) {
  return p >= 0.35 ? 'rgba(255,255,255,0.9)' : 'transparent'
}

export function HeatmapChart({ alerts }) {
  const { cells, totalWeeks } = computeHeatmap(alerts)

  return (
    <div className="chart-card heatmap-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Теплова карта тривог</h2>
          <p className="chart-subtitle">
            Імовірність по годині і дню тижня · {totalWeeks} тижн.
          </p>
        </div>
        <div className="hm-legend">
          {['0%', '10%', '20%', '35%', '50%', '65%+'].map((label, i) => (
            <span key={i} className="hm-legend-item">
              <span className="hm-legend-swatch" style={{ background: `var(--hm-${i})` }} />
              <span className="hm-legend-label">{label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="heatmap-wrap">
        {/* Заголовок годин */}
        <div className="hm-row hm-header-row">
          <span className="hm-day-label" />
          {HOUR_LABELS.map((l, h) => (
            <span key={h} className="hm-hour-label">{l}</span>
          ))}
        </div>

        {/* Рядки днів */}
        {cells.map((dayCells, dow) => (
          <div key={dow} className="hm-row">
            <span className="hm-day-label">{dayCells[0].day}</span>
            {dayCells.map(cell => (
              <span
                key={cell.hour}
                className="hm-cell"
                style={{ background: probToColor(cell.probability) }}
                title={`${cell.day} ${cell.label} — ${(cell.probability * 100).toFixed(0)}% (${cell.count}/${totalWeeks} тижнів)`}
              >
                <span style={{ color: probToTextColor(cell.probability), fontSize: '9px' }}>
                  {cell.probability >= 0.35 ? `${(cell.probability * 100).toFixed(0)}` : ''}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>

      <p className="hm-note">
        Значення = частка тижнів у яких була тривога в цей час.
        Наведіть курсор на комірку для деталей.
      </p>
    </div>
  )
}
