/**
 * GET /api/alert-status
 * Повертає { alert: true/false/null } — чи є активна тривога
 * в будь-якому з відстежуваних районів
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')

  const token = process.env.ALERTS_TOKEN
  if (!token) return res.status(500).json({ alert: null, error: 'no token' })

  // UIDs наших районів:
  // 332 = Вишгородський район
  // 310 = Житомирський район
  // Перевірте актуальні UIDs через /v1/regions/{uid}/alerts/active.json
  const LOCATION_UIDS = [74, 59]  // 74 = Вишгородський район, 59 = Житомирський район

  try {
    var results = await Promise.all(
      LOCATION_UIDS.map(function(uid) {
        return fetch(
          'https://api.alerts.in.ua/v1/iot/active_air_raid_alerts/' + uid + '.json?token=' + token
        ).then(function(r) { return r.json() })
      })
    )

    var anyActive = results.some(function(d) { return d.alert === true })

    return res.status(200).json({
      alert    : anyActive,
      regions  : LOCATION_UIDS.map(function(uid, i) {
        return { uid: uid, alert: results[i].alert === true }
      }),
      checked_at: new Date().toISOString(),
    })

  } catch (err) {
    return res.status(200).json({ alert: null, error: String(err) })
  }
}