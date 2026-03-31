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
          <span className="tooltip-label" style={{ color: p.fill }}>
            {p.name}
          </span>
          <span className="tooltip-value accent">
            {(p.value * 100).toFixed(0)}%
          </span>
        </div>
      ))}
      <div className="tooltip-row">
        <span className="tooltip-label">Підстава</span>
        <span className="tooltip-value">{d.count} з {d.total} дн.</span>
      </div>
    </div>
  )
}

function getTopSlots(alerts, regionKey, n = 8) {
  const { cells, dowTotals } = computeHeatmap(alerts)
  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

  const flat = cells.flatMap((dayCells, dow) =>
    dayCells.map(cell => ({
      key      : `${dow}-${cell.hour}`,
      fullLabel: `${DAY_LABELS[dow]}, ${cell.label}`,
      shortLabel: `${DAY_LABELS[dow]} ${String(cell.hour).padStart(2,'0')}:00`,
      probability: cell.probability,
      count    : cell.count,
      total    : dowTotals[dow],
      dow,
      hour     : cell.hour,
      [`prob_${regionKey}`]: cell.probability,
    }))
  )

  return flat
    .filter(s => s.probability > 0)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, n)
}

export function TopSlotsChart({ alertsMap, regionKeys }) {
  const isCompare = regionKeys.length === 2

  // Для одного регіону — топ-8 його слотів
  // Для двох — об'єднуємо топи і показуємо обидва значення
  let chartData

  if (!isCompare) {
    const key = regionKeys[0]
    chartData = getTopSlots(alertsMap[key], key).map(s => ({
      ...s,
      label: s.shortLabel,
    }))
  } else {
    // Беремо топ-8 за середньою імовірністю між двома регіонами
    const { cells: cells0, dowTotals: dt0 } = computeHeatmap(alertsMap[regionKeys[0]])
    const { cells: cells1, dowTotals: dt1 } = computeHeatmap(alertsMap[regionKeys[1]])
    const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

    const flat = cells0.flatMap((dayCells, dow) =>
      dayCells.map((cell, hour) => {
        const p0 = cell.probability
        const p1 = cells1[dow][hour].probability
        return {
          key      : `${dow}-${hour}`,
          label    : `${DAY_LABELS[dow]} ${String(hour).padStart(2,'0')}:00`,
          fullLabel: `${DAY_LABELS[dow]}, ${String(hour).padStart(2,'0')}:00`,
          avgProb  : (p0 + p1) / 2,
          count    : cell.count,
          total    : dt0[dow],
          [`prob_${regionKeys[0]}`]: p0,
          [`prob_${regionKeys[1]}`]: p1,
        }
      })
    )

    chartData = flat
      .filter(s => s.avgProb > 0)
      .sort((a, b) => b.avgProb - a.avgProb)
      .slice(0, 8)
  }

  const maxProb = Math.max(...chartData.map(d =>
    isCompare
      ? Math.max(d[`prob_${regionKeys[0]}`] ?? 0, d[`prob_${regionKeys[1]}`] ?? 0)
      : d.probability
  ), 0.1)

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Найнебезпечніші слоти</h2>
          <p className="chart-subtitle">
            Топ-8 комбінацій день+година · за імовірністю тривоги
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 48, left: 8, bottom: 0 }}
          barGap={3}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tickFormatter={v => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            tickLine={false}
            axisLine={false}
            domain={[0, Math.min(maxProb * 1.15, 1)]}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip content={<SlotTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

          {isCompare ? (
            regionKeys.map(k => (
              <Bar
                key={k}
                dataKey={`prob_${k}`}
                name={REGION_NAMES[k]}
                fill={REGION_COLORS[k]}
                radius={[0, 4, 4, 0]}
                maxBarSize={14}
                fillOpacity={0.85}
                label={{
                  position: 'right',
                  formatter: v => v > 0 ? `${(v * 100).toFixed(0)}%` : '',
                  style: { fill: REGION_COLORS[k], fontSize: 10, fontFamily: 'var(--font-mono)' },
                }}
              />
            ))
          ) : (
            <Bar
              dataKey="probability"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              fillOpacity={0.85}
              label={{
                position: 'right',
                formatter: v => `${(v * 100).toFixed(0)}%`,
                style: { fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' },
              }}
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.probability >= 0.5
                      ? 'var(--accent-high)'
                      : entry.probability >= 0.3
                      ? 'var(--accent-mid)'
                      : 'var(--accent-low)'
                  }
                />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>

      <p className="hm-note">
        Відсоток = частка відповідних днів у яких тривога починалась саме в цю годину.
        {isCompare && ' Відсортовано за середньою імовірністю між регіонами.'}
      </p>
    </div>
  )
}