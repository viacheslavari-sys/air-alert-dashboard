import { useState } from 'react'
import { useAlertsData } from './hooks/useAlertsData'
import { RegionFilter } from './components/RegionFilter'
import { StatsCards } from './components/StatsCards'
import { HeatmapChart } from './components/HeatmapChart'
import { ForecastChart } from './components/ForecastChart'
import { TopSlotsChart } from './components/TopSlotsChart'
import { SafeWindowFinder } from './components/SafeWindowFinder'
import { DurationChart } from './components/DurationChart'

function buildMaps(regionKeys, dataMap) {
  const statsMap  = {}
  const alertsMap = {}
  const hourlyMap = {}
  const dailyMap  = {}

  regionKeys.forEach(function(k) {
    const d = dataMap[k]
    if (!d) return
    statsMap[k]  = d.stats       || null
    alertsMap[k] = d.alerts      || []
    hourlyMap[k] = d.hourlyData  || []
    dailyMap[k]  = d.dailyData   || []
  })

  return { statsMap, alertsMap, hourlyMap, dailyMap }
}

export default function App() {
  const { loading, error, isMock, kyiv, zhytomyr, historyDays } = useAlertsData()
  const [selectedRegions, setSelectedRegions] = useState(['kyiv'])

  const dataMap = { kyiv: kyiv, zhytomyr: zhytomyr }

  const activeRegions = selectedRegions.filter(function(k) {
    return dataMap[k] != null
  })

  const { statsMap, alertsMap, hourlyMap, dailyMap } = buildMaps(activeRegions, dataMap)

  let regionLabel = 'Порівняння регіонів'
  if (activeRegions.length === 1) {
    regionLabel = activeRegions[0] === 'kyiv'
      ? 'Вишгородський р-н · Київська обл.'
      : 'Житомирський р-н · Житомирська обл.'
  }

  return (
    <div className="app">
      <div className="bg-grid" aria-hidden="true" />

      <header className="header">
        <div className="header-left">
          <div className="header-badge">
            <span className="badge-dot" />
            <span className="badge-text">{isMock ? 'ДЕМО-ДАНІ' : 'LIVE'}</span>
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
        <RegionFilter selected={selectedRegions} onChange={setSelectedRegions} />

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

        {!loading && activeRegions.length > 0 && (
          <>
            <StatsCards statsMap={statsMap} regionKeys={activeRegions} />
            <HeatmapChart alertsMap={alertsMap} regionKeys={activeRegions} />
            <SafeWindowFinder alertsMap={alertsMap} regionKeys={activeRegions} />
            <TopSlotsChart alertsMap={alertsMap} regionKeys={activeRegions} />
            <ForecastChart alertsMap={alertsMap} regionKeys={activeRegions} />
            <DurationChart
              dataMap={hourlyMap}
              dailyDataMap={dailyMap}
              regionKeys={activeRegions}
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