const REGION_OPTIONS = [
  { key: 'kyiv',     label: 'Вишгородський р-н', sub: 'Київська обл.' },
  { key: 'zhytomyr', label: 'Житомирський р-н',  sub: 'Житомирська обл.' },
]

export function RegionFilter({ selected, onChange }) {
  function toggle(key) {
    if (selected.includes(key)) {
      // Не дозволяємо зняти останній
      if (selected.length === 1) return
      onChange(selected.filter(k => k !== key))
    } else {
      onChange([...selected, key])
    }
  }

  return (
    <div className="region-filter">
      <span className="rf-label">Регіони:</span>
      {REGION_OPTIONS.map(({ key, label, sub }) => {
        const active = selected.includes(key)
        return (
          <button
            key={key}
            className={`rf-chip ${active ? 'rf-chip--active' : ''}`}
            onClick={() => toggle(key)}
            aria-pressed={active}
          >
            <span className="rf-chip-label">{label}</span>
            <span className="rf-chip-sub">{sub}</span>
          </button>
        )
      })}
    </div>
  )
}
