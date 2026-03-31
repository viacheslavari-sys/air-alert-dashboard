import { useAlertsData } from './hooks/useAlertsData'
import { HourlyChart } from './components/HourlyChart'
import { DurationChart } from './components/DurationChart'
import { StatsCards } from './components/StatsCards'

export default function App() {
  const { loading, error, hourlyData, dailyData, stats, isMock } = useAlertsData()

  return (
    <div className="app">
      {/* Subtle grid background */}
      <div className="bg-grid" aria-hidden="true" />

      <header className="header">
        <div className="header-left">
          <div className="header-badge">
            <span className="badge-dot" />
            <span className="badge-text">
              {isMock ? 'ДЕМО-ДАНІ' : 'LIVE'}
            </span>
          </div>
          <div>
            <h1 className="header-title">
              <span className="title-icon">⚠</span>
              Аналітика тривог
            </h1>
            <p className="header-sub">
              Вишгородський р-н · Київська обл · 30 днів
            </p>
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

        {error && isMock && (
          <div className="notice notice--warn">
            <span>⚠ API недоступне — показано демо-дані з реалістичними патернами</span>
          </div>
        )}

        {isMock && !error && (
          <div className="notice notice--info">
            <span>
              ℹ Показано моделювання на основі статистичних патернів Київщини 2023–2024.
              Додайте <code>ALERTS_TOKEN</code> у Vercel для реальних даних.
            </span>
          </div>
        )}

        {!loading && (
          <>
            <StatsCards stats={stats} />
            <HourlyChart data={hourlyData} />
            <DurationChart hourlyData={hourlyData} dailyData={dailyData} />
          </>
        )}
      </main>

      <footer className="footer">
        <span>Дані: alerts.in.ua API</span>
        <span>·</span>
        <span>Регіон ID: 31 (Київська обл.)</span>
        <span>·</span>
        <span>React + Vite + Recharts</span>
      </footer>
    </div>
  )
}
