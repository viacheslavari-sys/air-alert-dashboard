import { useState, useEffect } from 'react'
import {
  generateMockAlerts,
  computeHourlyProbability,
  computeSummaryStats,
  computeDailyAlerts,
} from '../data/mockAlerts'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

function normalizeAlerts(raw) {
  const list = Array.isArray(raw && raw.alerts) ? raw.alerts : []
  return list.map(a => ({
    id              : a.id,
    started_at      : a.started_at,
    finished_at     : a.finished_at ?? null,
    duration_minutes: a.finished_at
      ? Math.round((new Date(a.finished_at) - new Date(a.started_at)) / 60000)
      : null,
    location_title  : a.location_title,
    alert_type      : a.alert_type,
  }))
}

async function fetchHistory(region) {
  const res = await fetch(`/api/alerts?type=history&region=${region}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

function buildRegionState(alerts) {
  return {
    alerts    : alerts,
    hourlyData: computeHourlyProbability(alerts),
    dailyData : computeDailyAlerts(alerts),
    stats     : computeSummaryStats(alerts),
  }
}

export function useAlertsData() {
  const [state, setState] = useState({
    loading : true,
    error   : null,
    isMock  : USE_MOCK,
    kyiv    : null,
    zhytomyr: null,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (USE_MOCK) {
        // Генеруємо моки для обох регіонів
        const kyivAlerts     = generateMockAlerts()
        const zhytomyrAlerts = generateMockAlerts()
        if (!cancelled) {
          setState({
            loading : false,
            error   : null,
            isMock  : true,
            kyiv    : buildRegionState(kyivAlerts),
            zhytomyr: buildRegionState(zhytomyrAlerts),
          })
        }
        return
      }

      // Паралельні запити для обох регіонів
      try {
        const [kyivRaw, zhytomyrRaw] = await Promise.all([
          fetchHistory('kyiv'),
          fetchHistory('zhytomyr'),
        ])

        if (!cancelled) {
          setState({
            loading : false,
            error   : null,
            isMock  : false,
            kyiv    : buildRegionState(normalizeAlerts(kyivRaw)),
            zhytomyr: buildRegionState(normalizeAlerts(zhytomyrRaw)),
          })
        }
      } catch (err) {
        // Fallback на моки
        const kyivAlerts     = generateMockAlerts()
        const zhytomyrAlerts = generateMockAlerts()
        if (!cancelled) {
          setState({
            loading : false,
            error   : err.message,
            isMock  : true,
            kyiv    : buildRegionState(kyivAlerts),
            zhytomyr: buildRegionState(zhytomyrAlerts),
          })
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return state
}