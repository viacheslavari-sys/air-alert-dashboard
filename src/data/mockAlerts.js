/**
 * Реалістичні мокові дані для Вишгородського р-ну, Київська обл.
 * Патерни базовані на публічній статистиці тривог по Київщині за 2024-2025 рр.
 *
 * Особливості реальних патернів:
 * - Пік активності: 3:00–6:00 (нічні удари) та 11:00–14:00 (денні)
 * - Вихідні не суттєво відрізняються від буднів
 * - Тривалість: 45 хв – 3 год, середня ~90 хв
 * - Найспокійніший час: 8:00–10:00 та 17:00–20:00
 */

import { subDays, format, addMinutes, startOfDay, setHours, setMinutes } from 'date-fns'

const SEED_ALERTS = [
  // (startHour, durationMin, daysAgo)
  [3, 110, 1], [5, 85, 1],
  [2, 135, 2], [14, 60, 2],
  [4, 95, 3],
  [3, 120, 4], [12, 75, 4],
  [1, 150, 5], [6, 55, 5], [13, 80, 5],
  [5, 100, 6],
  [4, 115, 7], [11, 65, 7],
  [2, 90, 8], [15, 50, 8],
  [3, 140, 9],
  [6, 70, 10], [12, 85, 10],
  [4, 105, 11], [14, 60, 11],
  [2, 130, 12],
  [5, 80, 13], [11, 70, 13], [22, 45, 13],
  [3, 95, 14],
  [4, 110, 15], [13, 65, 15],
  [1, 145, 16],
  [6, 85, 17], [12, 90, 17],
  [3, 120, 18], [14, 55, 18],
  [5, 100, 19],
  [2, 115, 20], [11, 75, 20],
  [4, 95, 21],
  [3, 135, 22], [13, 60, 22], [23, 50, 22],
  [6, 80, 23],
  [4, 110, 24], [14, 70, 24],
  [2, 125, 25],
  [5, 90, 26], [12, 65, 26],
  [3, 105, 27],
  [4, 115, 28], [13, 80, 28],
  [1, 150, 29], [6, 60, 29],
  [3, 95, 30],
]

const now = new Date()

export const mockAlerts = SEED_ALERTS.map(([startHour, durationMin, daysAgo], i) => {
  const base = subDays(now, daysAgo)
  const startedAt = setMinutes(setHours(startOfDay(base), startHour), (i * 7) % 55)
  const finishedAt = addMinutes(startedAt, durationMin)
  return {
    id: i + 1,
    region: 'Вишгородський район',
    oblast: 'Київська область',
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    alert_type: 'air_raid',
    duration_minutes: durationMin,
  }
})

/** Підрахунок імовірності тривоги по годинах (0–23) */
export function computeHourlyProbability(alerts) {
  const counts = Array(24).fill(0)
  const days = new Set()

  alerts.forEach(a => {
    const start = new Date(a.started_at)
    const end   = new Date(a.finished_at)
    const dayKey = format(start, 'yyyy-MM-dd')
    days.add(dayKey)

    // Позначаємо кожну годину, яку покриває тривога
    let cursor = new Date(start)
    cursor.setMinutes(0, 0, 0)
    while (cursor <= end) {
      counts[cursor.getHours()]++
      cursor = addMinutes(cursor, 60)
    }
  })

  const totalDays = days.size || 1
  return counts.map((count, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    probability: Math.round((count / totalDays) * 100),
    count,
  }))
}

/** Середня тривалість по днях тижня */
export function computeWeekdayDuration(alerts) {
  const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  const buckets = Array(7).fill(null).map(() => ({ total: 0, count: 0 }))

  alerts.forEach(a => {
    const d = new Date(a.started_at).getDay()
    buckets[d].total += a.duration_minutes
    buckets[d].count += 1
  })

  return buckets.map((b, i) => ({
    day: days[i],
    avgDuration: b.count ? Math.round(b.total / b.count) : 0,
    count: b.count,
  }))
}

/** Зведена статистика */
export function computeStats(alerts) {
  const durations = alerts.map(a => a.duration_minutes)
  const avg = durations.reduce((s, d) => s + d, 0) / (durations.length || 1)
  const max = Math.max(...durations)
  const min = Math.min(...durations)

  const byDay = {}
  alerts.forEach(a => {
    const k = format(new Date(a.started_at), 'yyyy-MM-dd')
    byDay[k] = (byDay[k] || 0) + 1
  })
  const days = Object.values(byDay)
  const avgPerDay = days.reduce((s, d) => s + d, 0) / (days.length || 1)

  return {
    total: alerts.length,
    avgDuration: Math.round(avg),
    maxDuration: max,
    minDuration: min,
    avgPerDay: avgPerDay.toFixed(1),
    activeDays: Object.keys(byDay).length,
  }
}
