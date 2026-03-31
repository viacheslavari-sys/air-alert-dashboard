import { useState, useEffect } from 'react'
import {
  generateMockAlerts,
  computeHourlyProbability,
  computeSummaryStats,
  computeDailyAlerts,
} from '../data/mockAlerts'

// Використовуємо реальний API тільки якщо явно встановлено VITE_USE_MOCK=false
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

function normalizeAlerts(raw) {
  const list = Array.isArray(raw?.alerts) ? raw.alerts : []
  return list.map(a => ({
    id              : a.id,
    started_at      : a.started_at,
    finished_at     : a.finished_at ?? null,
    duration_minutes: a.finished_at
      ? Math.round((new Date(a.finished_at) - new Date(a.started_at)) / 60000)
      : null,
    location_type   : a.location_type,
    location_title  : a.location_title,
    location_raion  : a.location_raion ?? null,
    alert_type      : a.alert_type,
  }))
}

async function fetchHistory() {
  const res = await fetch('/api/alerts?type=history')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

function buildState(alerts, extra = {}) {
  return {
    loading   : false,
    alerts,
    hourlyData: computeHourlyProbability(alerts),
    dailyData : computeDailyAlerts(alerts),
    stats     : computeSummaryStats(alerts),
    isMock    : USE_MOCK,
    error     : null,
    ...extra,
  }
}

export function useAlertsData() {
  const [state, setState] = useState({
    loading   : true,
    error     : null,
    alerts    : [],
    hourlyData: [],
    dailyData : [],
    stats     : null,
    isMock    : USE_MOCK,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Моковий режим — синхронно, без fetch
      if (USE_MOCK) {
        const alerts = generateMockAlerts()
        if (!cancelled) setState(buildState(alerts))
        return
      }

      // Реальний API
      try {
        const raw = await fetchHistory()
        const alerts = normalizeAlerts(raw)
        if (!cancelled) setState(buildState(alerts))
      } catch (err) {
        // Fallback на моки якщо API недоступне
        const alerts = generateMockAlerts()
        if (!cancelled) setState(buildState(alerts, { error: err.message, isMock: true }))
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return state
}
