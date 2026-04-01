const REGION_OPTIONS = [
  { key: 'kyiv',     label: 'Вишгородський р-н', sub: 'Київська обл.' },
  { key: 'zhytomyr', label: 'Житомирський р-н',  sub: 'Житомирська обл.' },
]

export function RegionFilter({ selected, onChange }) {
  return (
    <div className="region-filter">
      <span className="rf-label">Регіон:</span>
      {REGION_OPTIONS.map(function(opt) {
        var active = selected === opt.key
        return (
          <button
            key={opt.key}
            className={'rf-chip ' + (active ? 'rf-chip--active' : '')}
            onClick={function() { onChange(opt.key) }}
            aria-pressed={active}
          >
            <span className="rf-chip-label">{opt.label}</span>
            <span className="rf-chip-sub">{opt.sub}</span>
          </button>
        )
      })}
    </div>
  )
}