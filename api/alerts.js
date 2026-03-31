const API_BASE = 'https://api.alerts.in.ua/v1'
const OBLAST_UID = 14

const TARGET_TITLES = [
  'Вишгородський район',
  'Київська область',
]

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const token = process.env.ALERTS_TOKEN
  if (!token) {
    return res.status(500).json({ error: 'ALERTS_TOKEN не налаштований' })
  }

  const type = req.query.type || 'history'

  let upstreamUrl
  if (type === 'history') {
    upstreamUrl = `${API_BASE}/regions/${OBLAST_UID}/alerts/month_ago.json`
  } else if (type === 'active') {
    upstreamUrl = `${API_BASE}/alerts/active.json`
  } else {
    return res.status(400).json({ error: `Невідомий type: ${type}` })
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    })

    const text = await upstream.text()

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `alerts.in.ua: ${upstream.status}`,
        detail: text,
      })
    }

    const raw = JSON.parse(text)

    if (type === 'history') {
      const all = Array.isArray(raw?.alerts) ? raw.alerts : []
      const filtered = all.filter(a => TARGET_TITLES.includes(a.location_title))

      res.setHeader('Cache-Control', 'public, s-maxage=300')
      return res.status(200).json({
        alerts    : filtered,
        total     : filtered.length,
        fetched_at: new Date().toISOString(),
      })
    }

    res.setHeader('Cache-Control', 'public, s-maxage=60')
    return res.status(200).json(raw)

  } catch (err) {
    return res.status(502).json({ error: String(err) })
  }
}
