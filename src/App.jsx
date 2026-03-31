import { useAlertsData } from './hooks/useAlertsData'
import { HourlyChart } from './components/HourlyChart'
import { DurationChart } from './components/DurationChart'
import { StatsCards } from './components/StatsCards'
import { HeatmapChart } from './components/HeatmapChart'
import { ForecastChart } from './components/ForecastChart'

const REGIONS = {
  kyiv    : { label: 'Вишгородський р-н', sub: 'Київська обл.' },
  zhytomyr: { label: 'Житомирський р-н',  sub: 'Житомирська обл.' },
}

function RegionBlock({ data, label, sub }) {
  if (!data) return null
  return (
    <div className="region-block">
      <div className="region-heading">
        <span className="region-label">{label}</span>
        <span className="region-sub">{sub}</span>
      </div>
      <StatsCards stats={data.stats} />
      <HeatmapChart alerts={data.alerts} />
      <ForecastChart alerts={data.alerts} />
      <HourlyChart data={data.hourlyData} />
      <DurationChart hourlyData={data.hourlyData} dailyData={data.dailyData} />
    </div>
  )
}

export default function App() {
  const { loading, error, isMock, kyiv, zhytomyr } = useAlertsData()

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
            <p className="header-sub">Порівняння регіонів · 30 днів</p>
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

        {!loading && (
          <div className="comparison-grid">
            <RegionBlock data={kyiv}     label={REGIONS.kyiv.label}     sub={REGIONS.kyiv.sub} />
            <RegionBlock data={zhytomyr} label={REGIONS.zhytomyr.label} sub={REGIONS.zhytomyr.sub} />
          </div>
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
