/**
 * Vercel Edge Function — проксі до alerts.in.ua API
 *
 * ЗМІННІ СЕРЕДОВИЩА (Vercel Dashboard → Settings → Environment Variables):
 *   ALERTS_TOKEN  — токен від alerts.in.ua (обов'язково)
 *
 * ЕНДПОІНТИ:
 *   GET /api/alerts?type=history          → місячна історія Київської обл.
 *   GET /api/alerts?type=history_kyiv     → місячна історія м. Київ
 *   GET /api/alerts?type=active           → поточні активні тривоги
 *   GET /api/alerts?type=status           → IoT-рядок статусів по областях
 *
 * РЕГІОНИ:
 *   UID 14  — Київська область (батьківська — охоплює всі райони)
 *   UID 31  — м. Київ (окрема адм. одиниця)
 *
 * Фільтрування по Вишгородському р-ну відбувається тут, на Edge,
 * через поле location_raion === 'Вишгородський район'.
 */


const API_BASE      = 'https://api.alerts.in.ua/v1'
const OBLAST_UID    = 14   // Київська область
const KYIV_CITY_UID = 31   // м. Київ (для порівняння)
const RAION_NAME    = 'Вишгородський район'

const CACHE_TTL = {
  history      : 300,  // 5 хв — ліміт API: 2 запити/хв для history!
  history_kyiv : 300,
  active       : 60,
  status       : 60,
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin'  : '*',
        'Access-Control-Allow-Methods' : 'GET, OPTIONS',
        'Access-Control-Allow-Headers' : 'Content-Type',
      },
    })
  }

  const token = process.env.ALERTS_TOKEN
  if (!token) {
    return errorResponse(500, 'ALERTS_TOKEN не налаштований у Vercel Environment Variables')
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'history'

  // Вибір ендпоінту
  let upstreamUrl
  switch (type) {
    case 'history':
      upstreamUrl = `${API_BASE}/regions/${OBLAST_UID}/alerts/month_ago.json`
      break
    case 'history_kyiv':
      upstreamUrl = `${API_BASE}/regions/${KYIV_CITY_UID}/alerts/month_ago.json`
      break
    case 'active':
      upstreamUrl = `${API_BASE}/alerts/active.json`
      break
    case 'status':
      upstreamUrl = `${API_BASE}/iot/active_air_raid_alerts_by_oblast.json`
      break
    default:
      return errorResponse(400, `Невідомий type: "${type}". Допустимі: history, history_kyiv, active, status`)
  }

  // Запит до alerts.in.ua
  let upstream
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept'       : 'application/json',
      },
    })
  } catch (err) {
    return errorResponse(502, `Не вдалося зʼєднатися з alerts.in.ua: ${err.message}`)
  }

  if (!upstream.ok) {
    const body = await upstream.text().catch(() => '')
    return errorResponse(
      upstream.status,
      upstream.status === 429
        ? 'Перевищено ліміт запитів (2/хв для history). Зачекайте хвилину.'
        : upstream.status === 401
        ? 'Невірний або відкликаний ALERTS_TOKEN.'
        : `alerts.in.ua повернув ${upstream.status}: ${body}`,
    )
  }

  const raw = await upstream.json()

  // Для history: фільтруємо по Вишгородському р-ну
  // API повертає всі тривоги Київської обл. — ми залишаємо:
  //   1. Тривоги по всій обл. (location_type === 'oblast') — вони стосуються і р-ну
  //   2. Тривоги саме по Вишгородському р-ну (location_raion)
  let payload = raw
  if (type === 'history' || type === 'history_kyiv') {
    const alerts = Array.isArray(raw?.alerts) ? raw.alerts : []
    const filtered = type === 'history'
      ? alerts.filter(a =>
          a.location_type === 'oblast' ||
          a.location_raion === RAION_NAME
        )
      : alerts // для Києва повертаємо все без фільтра

    payload = {
      alerts      : filtered,
      total       : filtered.length,
      region_uid  : type === 'history' ? OBLAST_UID : KYIV_CITY_UID,
      raion_filter: type === 'history' ? RAION_NAME : null,
      fetched_at  : new Date().toISOString(),
    }
  }

  const ttl = CACHE_TTL[type] ?? 60
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type'                : 'application/json; charset=utf-8',
      'Cache-Control'               : `public, s-maxage=${ttl}, stale-while-revalidate=30`,
      'Access-Control-Allow-Origin' : '*',
      'X-Region-UID'                : String(OBLAST_UID),
      'X-Raion-Filter'              : RAION_NAME,
    },
  })
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type'                : 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin' : '*',
    },
  })
}
