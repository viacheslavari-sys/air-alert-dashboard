import { useState, useEffect } from 'react'
import {
  generateMockAlerts,
  computeHourlyProbability,
  computeSummaryStats,
  computeDailyAlerts,
} from '../data/mockAlerts'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

// Raw URL до history.json у цьому ж публічному репо
// Замініть YOUR_GITHUB_USER та YOUR_REPO_NAME на свої значення
const HISTORY_URL = 'https://raw.githubusercontent.com/' +
  (import.meta.env.VITE_GITHUB_USER || 'YOUR_GITHUB_USER') + '/' +
  (import.meta.env.VITE_REPO_NAME   || 'YOUR_REPO_NAME')  +
  '/main/data/history.json'

function normalizeAlert(a) {
  return {
    id             : a.id,
    started_at     : a.started_at,
    finished_at    : a.finished_at || null,
    duration_minutes: a.finished_at
      ? Math.round((new Date(a.finished_at) - new Date(a.started_at)) / 60000)
      : null,
    location_title : a.location_title,
    location_type  : a.location_type,
    alert_type     : a.alert_type,
  }
}

function normalizeAlerts(raw) {
  var list = Array.isArray(raw && raw.alerts) ? raw.alerts : []
  return list.map(normalizeAlert)
}

async function fetchRegion(region) {
  var res = await fetch('/api/alerts?type=history&region=' + region)
  if (!res.ok) {
    var err = await res.json().catch(function() { return {} })
    throw new Error(err.error || 'HTTP ' + res.status)
  }
  return res.json()
}

async function fetchAccumulated() {
  try {
    var res = await fetch(HISTORY_URL)
    if (!res.ok) return null
    return res.json()
  } catch (e) {
    return null
  }
}

function mergeAlerts(fresh, accumulated) {
  var map = {}
  if (Array.isArray(accumulated)) {
    accumulated.forEach(function(a) { map[a.id] = normalizeAlert(a) })
  }
  if (Array.isArray(fresh)) {
    fresh.forEach(function(a) {
      if (!map[a.id] || (!map[a.id].finished_at && a.finished_at)) {
        map[a.id] = a
      }
    })
  }
  return Object.values(map).sort(function(a, b) {
    return new Date(b.started_at) - new Date(a.started_at)
  })
}

function buildRegionState(alerts) {
  return {
    alerts    : alerts,
    hourlyData: computeHourlyProbability(alerts),
    dailyData : computeDailyAlerts(alerts),
    stats     : computeSummaryStats(alerts),
  }
}

function calcHistoryDays(alerts) {
  if (!alerts || alerts.length === 0) return 30
  var oldest = alerts[alerts.length - 1].started_at
  return Math.round((Date.now() - new Date(oldest)) / 86400000)
}

export function useAlertsData() {
  var _state   = useState({ loading: true, error: null, isMock: USE_MOCK, kyiv: null, zhytomyr: null, historyDays: 30 })
  var state    = _state[0]
  var setState = _state[1]

  useEffect(function() {
    var cancelled = false

    async function load() {
      // Моковий режим — без fetch
      if (USE_MOCK) {
        var ka = generateMockAlerts()
        var za = generateMockAlerts()
        if (!cancelled) setState({
          loading: false, error: null, isMock: true,
          kyiv: buildRegionState(ka), zhytomyr: buildRegionState(za),
          historyDays: 30,
        })
        return
      }

      try {
        // Паралельно: свіжі 30 днів + вся накопичена історія
        var results = await Promise.all([
          fetchRegion('kyiv'),
          fetchRegion('zhytomyr'),
          fetchAccumulated(),
        ])

        var kyivFresh     = normalizeAlerts(results[0])
        var zhytomyrFresh = normalizeAlerts(results[1])
        var accumulated   = results[2]

        var kyivAcc     = accumulated && Array.isArray(accumulated.kyiv)     ? accumulated.kyiv     : []
        var zhytomyrAcc = accumulated && Array.isArray(accumulated.zhytomyr) ? accumulated.zhytomyr : []

        var kyivAll     = mergeAlerts(kyivFresh,     kyivAcc)
        var zhytomyrAll = mergeAlerts(zhytomyrFresh, zhytomyrAcc)

        if (!cancelled) setState({
          loading     : false,
          error       : null,
          isMock      : false,
          kyiv        : buildRegionState(kyivAll),
          zhytomyr    : buildRegionState(zhytomyrAll),
          historyDays : calcHistoryDays(kyivAll),
        })
      } catch (err) {
        var kf = generateMockAlerts()
        var zf = generateMockAlerts()
        if (!cancelled) setState({
          loading: false, error: err.message, isMock: true,
          kyiv: buildRegionState(kf), zhytomyr: buildRegionState(zf),
          historyDays: 30,
        })
      }
    }

    load()
    return function() { cancelled = true }
  }, [])

  return state
}