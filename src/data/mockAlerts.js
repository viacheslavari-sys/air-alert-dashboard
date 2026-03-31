/**
 * Моковані дані тривог для Вишгородського р-ну, Київська обл.
 * Патерни: нічний пік 02–05, ранковий 08–10, вечірній 18–20.
 */

const HOURLY_PROBABILITY = [
  0.08, 0.12, 0.22, 0.28, 0.31, 0.26,
  0.18, 0.14, 0.19, 0.21, 0.16, 0.11,
  0.09, 0.07, 0.06, 0.05, 0.06, 0.08,
  0.10, 0.13, 0.11, 0.09, 0.08, 0.08,
]

const DURATION_BY_HOUR = [
  55, 60, 65, 70, 72, 68, 55, 45,
  42, 40, 38, 35, 32, 30, 28, 30,
  33, 38, 42, 48, 50, 52, 53, 55,
]

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

export function generateMockAlerts() {
  const rand = seededRandom(20240301)
  const now = new Date()
  const alerts = []

  const start = new Date(now)
  start.setDate(start.getDate() - 30)
  start.setMinutes(0, 0, 0)

  const current = new Date(start)
  while (current < now) {
    const hour = current.getHours()
    const prob = HOURLY_PROBABILITY[hour]
    const noise = (rand() - 0.5) * 0.1
    const effective = Math.max(0, Math.min(1, prob + noise))

    if (rand() < effective * 0.35) {
      const baseDuration = DURATION_BY_HOUR[hour]
      const durationMinutes = Math.round(baseDuration * (0.6 + rand() * 0.8))

      const startTime = new Date(current)
      startTime.setMinutes(Math.floor(rand() * 55))

      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + durationMinutes)

      alerts.push({
        id: `mock-${alerts.length}`,
        started_at: startTime.toISOString(),
        finished_at: endTime < now ? endTime.toISOString() : null,
        duration_minutes: durationMinutes,
        location_type: 'raion',
        location_raion: 'Вишгородський район',
      })
    }

    current.setHours(current.getHours() + 1)
  }

  return alerts
}

export function computeHourlyProbability(alerts) {
  const hourData = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}:00`,
    totalAlerts: 0,
    totalDuration: 0,
    daysWithAlert: 0,
    probability: 0,
    avgDuration: 0,
  }))

  const hourDaySet = Array.from({ length: 24 }, () => new Set())

  alerts.forEach((a) => {
    const start = new Date(a.started_at)
    const h = start.getHours()
    const dayKey = a.started_at.slice(0, 10)
    hourDaySet[h].add(dayKey)
    hourData[h].totalAlerts++
    hourData[h].totalDuration += a.duration_minutes || 0
  })

  return hourData.map((d, h) => ({
    ...d,
    daysWithAlert: hourDaySet[h].size,
    probability: hourDaySet[h].size / 30,
    avgDuration: d.totalAlerts > 0 ? Math.round(d.totalDuration / d.totalAlerts) : 0,
  }))
}

export function computeDailyAlerts(alerts) {
  const now = new Date()
  const byDay = {}

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    byDay[key] = { date: key, count: 0, totalDuration: 0 }
  }

  alerts.forEach((a) => {
    const key = a.started_at.slice(0, 10)
    if (byDay[key]) {
      byDay[key].count++
      byDay[key].totalDuration += a.duration_minutes || 0
    }
  })

  return Object.values(byDay)
}

export function computeSummaryStats(alerts) {
  const total = alerts.length
  if (total === 0) return { total: 0, avgDuration: 0, maxDuration: 0, minDuration: 0, daysWithAlerts: 0 }

  const durations = alerts.map((a) => a.duration_minutes || 0)
  const avgDuration = Math.round(durations.reduce((s, d) => s + d, 0) / total)
  const maxDuration = Math.max(...durations)
  const minDuration = Math.min(...durations)

  const days = new Set(alerts.map((a) => a.started_at.slice(0, 10)))

  return {
    total,
    avgDuration,
    maxDuration,
    minDuration,
    daysWithAlerts: days.size,
  }
}
