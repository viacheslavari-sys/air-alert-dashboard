import { computeHeatmap } from '../data/mockAlerts'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const REGION_COLORS = {
  kyiv    : '#3b82f6',
  zhytomyr: '#f97316',
}

const REGION_NAMES = {
  kyiv    : 'Вишгород',
  zhytomyr: 'Житомир',
}

function SlotTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{d.fullLabel}</div>
      {payload.map(p => (
        <div className="tooltip-row" key={p.dataKey}>
          <span className="tooltip-label" style={{ color: p.fill }}>{p.name}</span>
          <span className="tooltip-value accent">{(p.value * 100).toFixed(0)}%</span>
        </div>
      ))}
      <div className="tooltip-row">
        <span className="tooltip-label">Підстава</span>
        <span className="tooltip-value">{d.count} з {d.total} дн.</span>
      </div>
    </div>
  )
}

function getTopSlots(alerts, n) {
  const hm = computeHeatmap(alerts)
  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

  const flat = hm.cells.flatMap((dayCells, dow) =>
    dayCells.map(cell => ({
      key       : dow + '-' + cell.hour,
      fullLabel : DAY_LABELS[dow] + ', ' + cell.label,
      label     : DAY_LABELS[dow] + ' ' + String(cell.hour).padStart(2, '0') + ':00',
      probability: cell.probability,
      pctLabel  : Math.round(cell.probability * 100) + '%',
      count     : cell.count,
      total     : hm.dowTotals[dow],
    }))
  )

  return flat
    .filter(s => s.probability > 0)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, n || 8)
}

function getTopSlotsCompare(alertsMap, regionKeys, n) {
  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
  const hm0 = computeHeatmap(alertsMap[regionKeys[0]])
  const hm1 = computeHeatmap(alertsMap[regionKeys[1]])

  const flat = hm0.cells.flatMap((dayCells, dow) =>
    dayCells.map((cell, hour) => {
      const p0 = cell.probability
      const p1 = hm1.cells[dow][hour].probability
      const row = {
        key      : dow + '-' + hour,
        label    : DAY_LABELS[dow] + ' ' + String(hour).padStart(2, '0') + ':00',
        fullLabel: DAY_LABELS[dow] + ', ' + String(hour).padStart(2, '0') + ':00',
        avgProb  : (p0 + p1) / 2,
        count    : cell.count,
        total    : hm0.dowTotals[dow],
      }
      row['prob_' + regionKeys[0]] = p0
      row['prob_' + regionKeys[1]] = p1
      return row
    })
  )

  return flat
    .filter(s => s.avgProb > 0)
    .sort((a, b) => b.avgProb - a.avgProb)
    .slice(0, n || 8)
}

export function TopSlotsChart({ alertsMap, regionKeys }) {
  const isCompare = regionKeys.length === 2
  const n = 8

  const chartData = isCompare
    ? getTopSlotsCompare(alertsMap, regionKeys, n)
    : getTopSlots(alertsMap[regionKeys[0]], n)

  const maxProb = Math.max(
    ...chartData.map(d => isCompare
      ? Math.max(d['prob_' + regionKeys[0]] || 0, d['prob_' + regionKeys[1]] || 0)
      : (d.probability || 0)
    ), 0.1
  )

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Найнебезпечніші слоти</h2>
          <p className="chart-subtitle">Топ-8 комбінацій день+година</p>
        </div>
        {isCompare && (
          <div className="legend">
            {regionKeys.map(k => (
              <span key={k} className="legend-item">
                <span className="legend-dot" style={{ background: REGION_COLORS[k] }} />
                <span className="legend-text">{REGION_NAMES[k]}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={isCompare ? 300 : 260}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 52, left: 8, bottom: 0 }}
          barGap={3}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={v => Math.round(v * 100) + '%'}
            tick={{ fill: '#8899aa', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={[0, Math.min(maxProb * 1.15, 1)]}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: '#8899aa', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip content={<SlotTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

          {isCompare ? (
            regionKeys.map(k => (
              <Bar
                key={k}
                dataKey={'prob_' + k}
                name={REGION_NAMES[k]}
                fill={REGION_COLORS[k]}
                radius={[0, 4, 4, 0]}
                maxBarSize={14}
                fillOpacity={0.85}
              />
            ))
          ) : (
            <Bar
              dataKey="probability"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              fillOpacity={0.85}
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.probability >= 0.5 ? '#ef4444'
                    : entry.probability >= 0.3 ? '#f97316'
                    : '#3b82f6'
                  }
                />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>

      <p className="hm-note">
        Відсоток = частка відповідних днів у яких тривога починалась саме в цю годину.
        {isCompare && ' Відсортовано за середньою між регіонами.'}
      </p>
    </div>
  )
}