import { useState } from 'react'
import { useAlertsData } from './hooks/useAlertsData'
import { RegionFilter } from './components/RegionFilter'
import { StatsCards } from './components/StatsCards'
import { HeatmapWithFinder } from './components/HeatmapWithFinder'
import { ForecastChart } from './components/ForecastChart'

export default function App() {
  var _data     = useAlertsData()
  var loading   = _data.loading
  var error     = _data.error
  var isMock    = _data.isMock
  var kyiv      = _data.kyiv
  var zhytomyr  = _data.zhytomyr
  var historyDays     = _data.historyDays
  var forecastHistory = _data.forecastHistory

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