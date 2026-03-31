import { computeHeatmap } from '../data/mockAlerts'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
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

function pctFormatter(v) {
  if (!v || v <= 0) return ''
  return `${(v * 100).toFixed(0)}%`
}

function getTopSlots(alerts, n = 8) {
  const { cells, dowTotals } = computeHeatmap(alerts)
  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

  const flat = cells.flatMap((dayCells, dow) =>
    dayCells.map(cell => ({
      key       : `${dow}-${cell.hour}`,
      fullLabel : `${DAY_LABELS[dow]}, ${cell.label}`,
      label     : `${DAY_LABELS[dow]} ${String(cell.hour).padStart(2, '0')}:00`,
      probability: cell.probability,
      count     : cell.count,
      total     : dowTotals[dow],
    }))
  )

  return flat
    .filter(s => s.probability > 0)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, n)
}

function getTopSlotsCompare(alertsMap, regionKeys, n = 8) {
  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
  const maps = regionKeys.map(k => computeHeatmap(alertsMap[k]))

  const flat = maps[0].cells.flatMap((dayCells, dow) =>
    dayCells.map((cell, hour) => {
      const p0 = cell.probability
      const p1 = maps[1].cells[dow][hour].probability
      return {
        key      : `${dow}-${hour}`,
        label    : `${DAY_LABELS[dow]} ${String(hour).padStart(2, '0')}:00`,
        fullLabel: `${DAY_LABELS[dow]}, ${String(hour).padStart(2, '0')}:00`,
        avgProb  : (p0 + p1) / 2,
        count    : cell.count,
        total    : maps[0].dowTotals[dow],
        [`prob_${regionKeys[0]}`]: p0,
        [`prob_${regionKeys[1]}`]: p1,
      }
    })
  )

  return flat
    .filter(s => s.avgProb > 0)
    .sort((a, b) => b.avgProb - a.avgProb)
    .slice(0, n)
}

export function TopSlotsChart({ alertsMap, regionKeys }) {
  const isCompare = regionKeys.length === 2

  const chartData = isCompare
    ? getTopSlotsCompare(alertsMap, regionKeys)
    : getTopSlots(alertsMap[regionKeys[0]])

  const labelStyle = { fill: '#8899aa', fontSize: 11 }

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Найнебезпечніші слоти</h2>
          <p className="chart-subtitle">
            Топ-8 комбінацій день+година · за імовірністю тривоги
          </p>
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
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tickFormatter={v => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: '#8899aa', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 'auto']}
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
                dataKey={`prob_${k}`}
                name={REGION_NAMES[k]}
                fill={REGION_COLORS[k]}
                radius={[0, 4, 4, 0]}
                maxBarSize={14}
                fillOpacity={0.85}
              >
                <LabelList
                  dataKey={`prob_${k}`}
                  position="right"
                  formatter={pctFormatter}
                  style={{ ...labelStyle, fill: REGION_COLORS[k] }}
                />
              </Bar>
            ))
          ) : (
            <Bar
              dataKey="probability"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              fillOpacity={0.85}
            >
              <LabelList
                dataKey="probability"
                position="right"
                formatter={pctFormatter}
                style={labelStyle}
              />
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.probability >= 0.5
                      ? '#ef4444'
                      : entry.probability >= 0.3
                      ? '#f97316'
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
        {isCompare && ' Відсортовано за середньою імовірністю між регіонами.'}
      </p>
    </div>
  )
}