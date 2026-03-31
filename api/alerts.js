const API_BASE = 'https://api.alerts.in.ua/v1'

const REGIONS = {
  kyiv    : { uid: 14, titles: ['Вишгородський район', 'Київська область'] },
  zhytomyr: { uid: 10, titles: ['Житомирський район',  'Житомирська область'] },
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = process.env.ALERTS_TOKEN
  if (!token) return res.status(500).json({ error: 'ALERTS_TOKEN не налаштований' })

  const type   = req.query.type   || 'history'
  const region = req.query.region || 'kyiv'

  if (!REGIONS[region]) {
    return res.status(400).json({ error: `Невідомий region: ${region}` })
  }

  const { uid, titles } = REGIONS[region]

  if (type !== 'history' && type !== 'active') {
    return res.status(400).json({ error: `Невідомий type: ${type}` })
  }

  const upstreamUrl = type === 'history'
    ? `${API_BASE}/regions/${uid}/alerts/month_ago.json`
    : `${API_BASE}/alerts/active.json`

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    })

    const text = await upstream.text()
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `alerts.in.ua: ${upstream.status}`, detail: text })
    }

    const raw = JSON.parse(text)

    if (type === 'history') {
      const all      = Array.isArray(raw?.alerts) ? raw.alerts : []
      const filtered = all.filter(a => titles.includes(a.location_title))
      res.setHeader('Cache-Control', 'public, s-maxage=300')
      return res.status(200).json({ alerts: filtered, total: filtered.length, fetched_at: new Date().toISOString() })
    }

    res.setHeader('Cache-Control', 'public, s-maxage=60')
    return res.status(200).json(raw)

  } catch (err) {
    return res.status(502).json({ error: String(err) })
  }
}
