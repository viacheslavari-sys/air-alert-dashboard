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

export function computeSummaryStats(alerts, historyDays) {
  var total = alerts.length
  if (total === 0) return {
    total: 0, todayCount: 0, weekCount: 0,
    daysWithAlerts: 0, totalDays: historyDays || 30,
  }

  var now     = new Date()
  var todayUTC = now.toISOString().slice(0, 10)
  var weekAgo  = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)

  var todayCount = 0
  var weekCount  = 0
  var days = new Set()

  alerts.forEach(function(a) {
    var day = a.started_at.slice(0, 10)
    days.add(day)
    if (day === todayUTC) todayCount++
    if (day >= weekAgo)   weekCount++
  })

  return {
    total         : total,
    todayCount    : todayCount,
    weekCount     : weekCount,
    daysWithAlerts: days.size,
    totalDays     : historyDays || 30,
  }
}

/**
 * Теплова карта: година (0–23) × день тижня (0=Пн, 6=Нд)
 * Повертає матрицю 7×24 з імовірністю тривоги в кожній комірці.
 * Імовірність = кількість тижнів де була тривога в цей слот / загальна кількість тижнів.
 */
export function computeHeatmap(alerts) {
  const now   = new Date()
  const since = new Date(now)
  since.setDate(since.getDate() - 30)

  // Скільки разів кожен день тижня зустрічається за останні 30 днів
  const dowTotals = Array(7).fill(0)
  for (let i = 0; i < 30; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dowTotals[(d.getDay() + 6) % 7]++
  }

  // Кількість тривог по слоту [dow][hour]
  const slotCount    = Array.from({ length: 7 }, () => Array(24).fill(0))
  const slotDuration = Array.from({ length: 7 }, () => Array(24).fill(0))
  const slotAlertCount = Array.from({ length: 7 }, () => Array(24).fill(0))

  // Кількість тривог по дню тижня (для лівої колонки)
  const dowCount = Array(7).fill(0)

  alerts.forEach(function(a) {
    const d       = new Date(a.started_at)
    const dow     = (d.getDay() + 6) % 7
    const hour    = d.getHours()
    slotCount[dow][hour]++
    dowCount[dow]++
    if (a.duration_minutes) {
      slotDuration[dow][hour] += a.duration_minutes
      slotAlertCount[dow][hour]++
    }
  })

  // Максимум серед усіх слотів — для нормалізації кольору
  let maxSlotCount = 0
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (slotCount[d][h] > maxSlotCount) maxSlotCount = slotCount[d][h]
    }
  }

  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

  // Найтихіший день — мінімум по dowCount (серед тих де > 0)
  const nonZeroDays = dowCount
    .map(function(c, i) { return { count: c, dow: i } })
    .filter(function(d) { return d.count >= 0 })
  const quietestDow = nonZeroDays.reduce(function(min, d) {
    return d.count < min.count ? d : min
  }, nonZeroDays[0]).dow

  const dayStats = DAY_LABELS.map(function(day, dow) {
    return {
      day        : day,
      dow        : dow,
      count      : dowCount[dow],
      totalDays  : dowTotals[dow],
    }
  })

  return {
    periodFrom  : since.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
    periodTo    : now.toLocaleDateString('uk-UA',   { day: 'numeric', month: 'short' }),
    dowTotals,
    dowCount,
    dayStats,
    quietestDow,
    maxSlotCount,
    cells: DAY_LABELS.map(function(day, dow) {
      return Array.from({ length: 24 }, function(_, hour) {
        const count = slotCount[dow][hour]
        const dur   = slotAlertCount[dow][hour] > 0
          ? Math.round(slotDuration[dow][hour] / slotAlertCount[dow][hour])
          : 0
        return {
          day        : day,
          dow        : dow,
          hour       : hour,
          label      : String(hour).padStart(2, '0') + ':00',
          count      : count,
          avgDuration: dur,
        }
      })
    }),
  }
}

export function computeForecast(alerts, hoursAhead) {
  if (!hoursAhead) hoursAhead = 6

  // ── Будуємо таблицю умовних імовірностей ─────────────────────────
  // P(тривога | dow, hour) = кількість унікальних дат з тривогою в цей слот
  //                         / загальна кількість таких днів тижня у вибірці

  // Підраховуємо скільки разів кожен день тижня зустрівся у вибірці
  var dowObserved = Array(7).fill(0)
  var datesSeen   = new Set()
  alerts.forEach(function(a) {
    var d       = new Date(a.started_at)
    var kyivDay = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Kiev' }))
    var dateKey = kyivDay.toISOString().slice(0, 10)
    if (datesSeen.has(dateKey)) return
    datesSeen.add(dateKey)
    var dow = (kyivDay.getDay() + 6) % 7
    dowObserved[dow]++
  })

  // Підраховуємо унікальні дати з тривогою для кожного слоту [dow][hour]
  var slotDates = Array.from({ length: 7 }, function() {
    return Array.from({ length: 24 }, function() { return new Set() })
  })
  alerts.forEach(function(a) {
    var d       = new Date(a.started_at)
    var dow     = (d.getDay() + 6) % 7
    var hour    = d.getHours()
    var dateKey = a.started_at.slice(0, 10)
    slotDates[dow][hour].add(dateKey)
  })

  // Умовна імовірність для кожного слоту
  // Використовуємо згладжування Лапласа (+1/+2) щоб уникнути 0% і 100%
  // при малій кількості спостережень
  function slotProb(dow, hour) {
    var observed = dowObserved[dow]
    if (observed === 0) return 0
    var hits = slotDates[dow][hour].size
    // Лапласівське згладжування: (hits + 0.5) / (observed + 1)
    return (hits + 0.5) / (observed + 1)
  }

  // ── Остання тривога для контекстної корекції ──────────────────────
  var sorted = alerts.slice().sort(function(a, b) {
    return new Date(b.started_at) - new Date(a.started_at)
  })
  var lastAlert = sorted[0] ? new Date(sorted[0].started_at) : null

  // ── Генеруємо слоти ───────────────────────────────────────────────
  var now   = new Date()
  var slots = []

  for (var i = 1; i <= hoursAhead; i++) {
    var future = new Date(now.getTime() + i * 3600000)
    future.setMinutes(0, 0, 0)
    var kyivFuture = new Date(future.toLocaleString('en-US', { timeZone: 'Europe/Kiev' }))
    var dow  = (kyivFuture.getDay() + 6) % 7
    var hour = kyivFuture.getHours()

    var prob = slotProb(dow, hour)

    // Довірчий інтервал Вілсона (точніший ніж нормальне наближення)
    var n = dowObserved[dow] + 1  // з урахуванням згладжування
    var z = 1.645  // 90% CI
    var p = prob
    var margin = n > 0 ? z * Math.sqrt((p * (1 - p)) / n) : 0.15

    slots.push({
      hour             : future.getHours(),
      dow              : dow,
      label            : future.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
      fullLabel        : future.toLocaleDateString('uk-UA', { weekday: 'short' }) +
                         ' ' + future.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
      baseProbability  : prob,
      adjustedProbability: prob,  // поки без додаткових корекцій
      ciLow            : Math.max(0, prob - margin),
      ciHigh           : Math.min(1, prob + margin),
      observed         : dowObserved[dow],
      hits             : slotDates[dow][hour].size,
    })
  }

  return {
    slots          : slots,
    avgIntervalHours: null,
    lastAlert      : lastAlert ? lastAlert.toISOString() : null,
  }
}