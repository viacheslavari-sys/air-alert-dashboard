import { useState, useEffect } from 'react'
import { useAlertsData } from './hooks/useAlertsData'
import { RegionFilter } from './components/RegionFilter'
import { StatsCards } from './components/StatsCards'
import { HeatmapWithFinder } from './components/HeatmapWithFinder'
import { ForecastChart } from './components/ForecastChart'
import { DailyAlertsChart } from './components/DailyAlertsChart'

export default function App() {
  // Статус активної тривоги — оновлюється кожні 30 секунд
  var _alertStatus = useState(null)  // null | true | false
  var alertStatus  = _alertStatus[0]
  var setAlertStatus = _alertStatus[1]

  useEffect(function() {
    function fetchStatus() {
      fetch('/api/alert-status')
        .then(function(r) { return r.json() })
        .then(function(d) { setAlertStatus(d.alert === true) })
        .catch(function() { setAlertStatus(null) })
    }
    fetchStatus()
    var interval = setInterval(fetchStatus, 30000)
    return function() { clearInterval(interval) }
  }, [])

  var _data     = useAlertsData()
  var loading   = _data.loading
  var error     = _data.error
  var isMock    = _data.isMock
  var kyiv      = _data.kyiv
  var zhytomyr  = _data.zhytomyr
  var historyDays     = _data.historyDays
  var forecastHistory = _data.forecastHistory
  var dailyCounts     = _data.dailyCounts
  var hourlyActuals   = _data.hourlyActuals

  var _region      = useState('kyiv')
  var selectedRegion = _region[0]
  var setRegion      = _region[1]

  var dataMap = { kyiv: kyiv, zhytomyr: zhytomyr }
  var current = dataMap[selectedRegion]

  var regionLabel = selectedRegion === 'kyiv'
    ? 'Вишгородський р-н · Київська обл.'
    : 'Житомирський р-н · Житомирська обл.'

  // StatsCards очікує statsMap і regionKeys — адаптуємо
  var statsMap   = {}
  statsMap[selectedRegion] = current ? current.stats : null

  return (
    <div className="app">
      <div className="bg-grid" aria-hidden="true" />

      <header className="header">
        <div className="header-left">
          <div className={'header-badge' + (alertStatus === true ? ' header-badge--alert' : alertStatus === false ? ' header-badge--calm' : '')}>
            <span className="badge-dot" />
            <span className="badge-text">
              {isMock ? 'ДЕМО-ДАНІ' : alertStatus === true ? 'ТРИВОГА' : alertStatus === false ? 'СПОКІЙ' : 'LIVE'}
            </span>
          </div>
          <div>
            <h1 className="header-title">
              <span className="title-icon">⚠</span>
              Аналітика тривог
            </h1>
            <p className="header-sub">{regionLabel} · {historyDays} днів</p>
          </div>
        </div>
        <div className="header-right">
          <div className="data-source">
            <span className="ds-label">Джерело</span>
            <span className="ds-value">alerts.in.ua</span>
          </div>
          <div className="updated">
            <span className="ds-label">Оновлено</span>
            <span className="ds-value">
              {new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </header>

      <main className="main">
        <RegionFilter selected={selectedRegion} onChange={setRegion} />

        {loading && (
          <div className="loading">
            <div className="loading-spinner" />
            <span>Завантаження даних...</span>
          </div>
        )}

        {error && (
          <div className="notice notice--warn">
            <div>⚠ API недоступне — показано демо-дані</div>
            <code style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginTop: '6px' }}>
              {error}
            </code>
          </div>
        )}

        {isMock && !error && (
          <div className="notice notice--info">
            ℹ Показано моделювання на основі статистичних патернів 2023–2024.
          </div>
        )}

        {!loading && current && (
          <>
            <StatsCards
              statsMap={statsMap}
              regionKeys={[selectedRegion]}
            />
            <HeatmapWithFinder
              alerts={current.alerts}
              regionKey={selectedRegion}
            />
            <ForecastChart
              alertsMap={{ [selectedRegion]: current.alerts }}
              regionKeys={[selectedRegion]}
              forecastHistory={forecastHistory}
              hourlyActuals={hourlyActuals && hourlyActuals[selectedRegion]}
            />
            <DailyAlertsChart
              alertsMap={{ kyiv: kyiv && kyiv.alerts, zhytomyr: zhytomyr && zhytomyr.alerts }}
              dailyCounts={dailyCounts}
            />
          </>
        )}
      </main>

      <footer className="footer">
        <span>Дані: alerts.in.ua API</span>
        <span>·</span>
        <span>React + Vite + Recharts</span>
      </footer>
    </div>
  )
}