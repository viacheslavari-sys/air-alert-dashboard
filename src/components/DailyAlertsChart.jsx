import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

const REGION_COLORS = {
  kyiv    : '#3b82f6',
  zhytomyr: '#f97316',
}

// Будує масив з daily_counts (словник дата->кількість)
function buildFromDailyCounts(dailyCounts) {
  if (!dailyCounts || typeof dailyCounts !== 'object') return []
  var keys = Object.keys(dailyCounts).sort()
  if (keys.length === 0) return []
  return keys.map(function(key) {
    return {
      date : key,
      label: new Date(key).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
      count: dailyCounts[key] || 0,
    }
  })
}

// Fallback: будує з масиву тривог якщо daily_counts ще немає
function buildFromAlerts(alerts) {
  if (!Array.isArray(alerts) || alerts.length === 0) return []
  var byDay = {}
  alerts.forEach(function(a) {
    var day = a.started_at.slice(0, 10)
    byDay[day] = (byDay[day] || 0) + 1
  })
  var keys = Object.keys(byDay).sort()
  if (keys.length === 0) return []

  var start = new Date(keys[0])
  var end   = new Date()
  end.setHours(0, 0, 0, 0)
  var rows  = []
  var cur   = new Date(start)
  while (cur <= end) {
    var key = cur.toISOString().slice(0, 10)
    rows.push({
      date : key,
      label: new Date(key).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
      count: byDay[key] || 0,
    })
    cur.setDate(cur.getDate() + 1)
  }
  return rows
}

function DailyTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  var row = payload[0] && payload[0].payload ? payload[0].payload : {}
  return (
    <div className="tooltip-box">
      <div className="tooltip-hour">{row.label}</div>
      <div className="tooltip-row">
        <span className="tooltip-label">Тривог</span>
        <span className="tooltip-value accent">{row.count}</span>
      </div>
    </div>
  )
}

export function DailyAlertsChart({ alerts, regionKey, dailyCounts }) {
  // Пріоритет: daily_counts з history.json (точні дані з нулями)
  // Fallback: обчислення з масиву тривог
  var data  = dailyCounts
    ? buildFromDailyCounts(dailyCounts)
    : buildFromAlerts(alerts)

  var color = REGION_COLORS[regionKey] || '#3b82f6'
  var total = data.reduce(function(s, d) { return s + d.count }, 0)
  var days  = data.length

  var tickInterval = days <= 30 ? 6 : days <= 60 ? 9 : days <= 90 ? 14 : 20

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Інтенсивність тривог по днях</h2>
          <p className="chart-subtitle">
            {days > 0
              ? data[0].label + ' — ' + data[data.length - 1].label +
                ' · ' + days + ' дн · ' + total + ' тривог'
              : 'Немає даних'}
            {!dailyCounts && days > 0 && ' · дані без нулів (history не завантажено)'}
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="fc-empty">Немає даних для відображення.</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="dailyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#8899aa', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
            />
            <YAxis
              tick={{ fill: '#8899aa', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<DailyTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke={color}
              strokeWidth={2}
              fill="url(#dailyAreaGrad)"
              dot={false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}