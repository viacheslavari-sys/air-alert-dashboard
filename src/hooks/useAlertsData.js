import { useState, useEffect } from 'react'
import {
  generateMockAlerts,
  computeHourlyProbability,
  computeSummaryStats,
  computeDailyAlerts,
} from '../data/mockAlerts'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

// Адаптер: перетворює відповідь alerts.in.ua на внутрішній формат
function normalizeAlerts(raw) {
  const list = Array.isArray(raw?.alerts) ? raw.alerts : []
  return list.map(a => ({
    id             : a.id,
    started_at     : a.started_at,
    finished_at    : a.finished_at ?? null,
    duration_minutes: a.finished_at
      ? Math.round((new Date(a.finished_at) - new Date(a.started_at)) / 60000)
      : null,
    location_type  : a.location_type,
    location_title : a.location_title,
    location_raion : a.location_raion ?? null,
    alert_type     : a.alert_type,
    calculated     : a.calculated ?? false,
  }))
}

async function fetchHistory(type = 'history') {
  const res = await fetch(`/api/alerts?type=${type}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function useAlertsData() {
  const [state, setState] = useState({
    loading  : true,
    error    : null,
    alerts   : [],
    hourlyData: [],
    dailyData : [],
    stats    : null,
    isMock   : USE_MOCK,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        let alerts

        if (USE_MOCK) {
          alerts = generateMockAlerts()
        } else {
          const raw = await fetchHistory('history')
          alerts = normalizeAlerts(raw)
        }

        if (cancelled) return

        setState({
          loading   : false,
          error     : null,
          alerts,
          hourlyData: computeHourlyProbability(alerts),
          dailyData : computeDailyAlerts(alerts),
          stats     : computeSummaryStats(alerts),
          isMock    : USE_MOCK,
        })
      } catch (err) {
        if (cancelled) return
        // Fallback на моки при помилці API
        const alerts = generateMockAlerts()
        setState({
          loading   : false,
          error     : err.message,
          alerts,
          hourlyData: computeHourlyProbability(alerts),
          dailyData : computeDailyAlerts(alerts),
          stats     : computeSummaryStats(alerts),
          isMock    : true,
        })
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return state
}
