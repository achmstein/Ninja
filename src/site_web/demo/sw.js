// The demo's stand-in for a café's server. The home page shows the real apps (built into
// /demo/<app>/ by scripts/demo-apps.mjs); this service worker answers what they ask the API
// for with one made-up café, Mellow, so nothing behind them needs to run and nothing a
// visitor's browser does there reaches a real business.
const t = (en, ar) => ({ en, ar })
const on = { reservations: true, timeBilling: true, loyalty: true, tabs: true, inventory: true, finance: true, payroll: true, kds: true, onlinePayments: true, delivery: true, payAhead: false, ai: true, callCentre: false }

const tenant = {
  name: t('Mellow', 'ميلو'),
  primaryColor: '#0f172a',
  customerUrl: null,
  // The café's sign-in host, as far as the apps know: an address on this site, which only this worker answers
  auth: { authority: self.location.origin + '/demo/auth/realms/mellow', social: null },
  apiUrl: null,
  appsUrl: null,
  logoUrl: null,
  logoDarkUrl: null,
  wordmarks: { en: null, enDark: null, ar: null, arDark: null },
  theme: { accent: null, surface: null, radius: null, fontLatin: null, fontArabic: null, dark: null, headerSize: null, mode: 'light', style: 'ninja', layout: null, slab: null },
  icons: { icon192: '', icon512: '', maskable512: '', appleTouch: '', favicon: '' },
  features: on,
  entitlements: on,
  locale: { country: 'EG', currency: 'EGP', timeZone: 'Africa/Cairo', language: 'en', arabicStyle: 'egyptian', phonePattern: '^01[0125][0-9]{8}$', phonePlaceholder: '01012345678', contentLanguages: 'both' },
  version: 1,
  businessType: 'CoffeeShop',
  guestOrdersAnywhere: true,
  cover: null,
  assistant: null,
  maps: null,
}

const branches = [
  {
    id: 1,
    name: t('Zamalek', 'الزمالك'),
    address: t('14 Brazil Street, Zamalek', '14 شارع البرازيل، الزمالك'),
    phone: '01012345678',
    taxNumber: null,
    receiptFooter: null,
    isActive: true,
    displayOrder: 0,
    dayStartTime: '08:00:00',
    dayEndTime: '02:00:00',
    isOrderingEnabled: true,
    isReservationsEnabled: true,
    requireSignInForTableOrders: false,
    latitude: 30.0626,
    longitude: 31.2197,
    isDeliveryEnabled: false,
    deliveryRadiusKm: 5,
    deliveryFee: 25,
    deliveryMinimumOrder: 100,
    requireSignInForDelivery: false,
    deliveryArea: null,
  },
]

const categories = [
  { id: 1, name: t('Coffee', 'قهوة'), displayOrder: 0 },
  { id: 2, name: t('Iced', 'ساقع'), displayOrder: 1 },
  { id: 3, name: t('Food', 'أكل'), displayOrder: 2 },
  { id: 4, name: t('Desserts', 'حلويات'), displayOrder: 3 },
]

const size = (id) => ({
  id,
  name: t('Size', 'الحجم'),
  isRequired: true,
  allowMultiple: false,
  displayOrder: 0,
  options: [
    { id: id * 10 + 1, name: t('Regular', 'وسط'), priceAdjustment: 0, isDefault: true, displayOrder: 0, isOutOfStock: false },
    { id: id * 10 + 2, name: t('Large', 'كبير'), priceAdjustment: 15, isDefault: false, displayOrder: 1, isOutOfStock: false },
  ],
})

// id, photo (the app's own sample menu photos, /dishes), category, price, popular, name, description
const MENU = [
  [1, 'latte', 1, 75, true, t('Latte', 'لاتيه'), t('Double shot, steamed milk', 'دبل شوت ولبن')],
  [2, 'cappuccino', 1, 70, true, t('Cappuccino', 'كابتشينو'), t('Espresso, velvet foam', 'إسبريسو ورغوة ناعمة')],
  [3, 'flatwhite', 1, 70, false, t('Flat White', 'فلات وايت'), t('Two shots, thin foam', 'شوتين ورغوة خفيفة')],
  [4, 'spanish', 1, 85, true, t('Spanish Latte', 'سبانش لاتيه'), t('Espresso, condensed milk', 'إسبريسو ولبن مكثف')],
  [5, 'turkish', 1, 45, false, t('Turkish Coffee', 'قهوة تركي'), t('Medium roast, cardamom', 'محوّج بالحبهان')],
  [6, 'hotchoc', 1, 80, false, t('Hot Chocolate', 'هوت شوكليت'), t('Dark chocolate, steamed milk', 'شوكولاتة غامقة ولبن')],
  [7, 'mocha', 2, 95, true, t('Iced Mocha', 'آيس موكا'), t('Chocolate, espresso, cream', 'شوكولاتة وإسبريسو وكريمة')],
  [8, 'lemonade', 2, 65, false, t('Lemonade', 'ليمونادة'), t('Fresh lemon, ice', 'ليمون فريش وتلج')],
  [9, 'milkshake', 2, 90, false, t('Milkshake', 'ميلك شيك'), t('Vanilla, whipped cream', 'فانيليا وكريمة')],
  [10, 'waffle', 3, 110, true, t('Waffle', 'وافل'), t('Belgian, chocolate drizzle', 'بلجيكي بصوص شوكولاتة')],
  [11, 'cake', 4, 120, true, t('Chocolate Cake', 'كيكة شوكولاتة'), t('Three layers, dark ganache', 'تلات طبقات وجاناش')],
]

const items = MENU.map(([id, , cat, price, popular, name, description], i) => ({
  id,
  name,
  description,
  price,
  pictureUri: '/api/catalog/items/' + id + '/pic?v=1',
  catalogTypeId: cat,
  catalogTypeName: categories[cat - 1].name,
  isAvailable: true,
  isOutOfStock: false,
  isOnOffer: false,
  offerPrice: null,
  effectivePrice: price,
  offerWeekdays: null,
  offerFrom: null,
  offerTo: null,
  isPopular: popular,
  preparationTimeMinutes: 5,
  displayOrder: i,
  customizations: cat <= 2 ? [size(id)] : [],
  pairedItemIds: id === 1 ? [10, 11] : [],
  base: null,
}))
const PHOTO = new Map(MENU.map(([id, photo]) => [String(id), photo]))

/**
 * A member of staff already signed in, as each staff app keeps one: the key it reads and
 * what it finds there. The page puts this in place before it opens a staff app, so the
 * app starts on its work, not on a sign-in page that leads nowhere. The token opens nothing:
 * the only server these apps reach is this worker.
 */
function staff(clientId) {
  const now = Math.floor(Date.now() / 1000)
  const user = {
    id_token: 'demo',
    session_state: 'demo',
    access_token: 'demo',
    refresh_token: 'demo',
    token_type: 'Bearer',
    scope: 'openid profile email roles',
    profile: {
      sub: 'demo-nour',
      name: 'Nour Hassan',
      given_name: 'Nour',
      family_name: 'Hassan',
      preferred_username: 'nour',
      email: 'nour@mellow.example',
      realm_access: { roles: ['Owner', 'Admin', 'Cashier', 'Kitchen'] },
      branches: [1],
      iss: tenant.auth.authority,
      aud: clientId,
      iat: now,
      exp: now + 365 * 86400,
    },
    expires_at: now + 365 * 86400,
  }
  return ['oidc.user:' + tenant.auth.authority + ':' + clientId, JSON.stringify(user)]
}

// ——— The kitchen ————————————————————————————————————————————————

const stations = [
  { id: 1, name: t('Kitchen', 'المطبخ'), categoryIds: [3, 4], showsOnScreen: true, printsTickets: false, printerHost: null, printerPort: 9100, connectorId: null, printerName: null, isDefault: true, displayOrder: 0 },
  { id: 2, name: t('Bar', 'البار'), categoryIds: [1, 2], showsOnScreen: true, printsTickets: false, printerHost: null, printerPort: 9100, connectorId: null, printerName: null, isDefault: false, displayOrder: 1 },
]
const stationOf = (id) => (stations[1].categoryIds.includes(MENU.find((m) => m[0] === id)[2]) ? 2 : 1)
const line = (id, units, note) => ({ productName: MENU.find((m) => m[0] === id)[5], units, customizationsDescription: null, specialInstructions: note ?? null, stationId: stationOf(id) })

// A round of the kitchen's evening, started each time the kitchen screen opens: three
// orders already waiting, a fourth that comes in a few seconds later, and whichever of
// them the screen has marked ready since.
let round = { at: Date.now(), ready: new Map() }

function kitchenOrders() {
  const since = Date.now() - round.at
  const waiting = [
    { no: 1038, ago: 372, table: t('Table 7', 'ترابيزة 7'), name: 'Karim', lines: [line(7, 2), line(11, 1)] },
    { no: 1040, ago: 205, table: null, name: 'Salma', lines: [line(10, 1), line(8, 1)] },
    { no: 1041, ago: 64, table: t('Table 2', 'ترابيزة 2'), name: 'Omar', lines: [line(3, 2), line(5, 1)] },
  ]
  if (since > 9000) waiting.push({ no: 1042, ago: 9 - since / 1000 + 1, table: t('Table 3', 'ترابيزة 3'), name: 'Lina', lines: [line(4, 1, 'Extra hot, please'), line(11, 1)] })
  return waiting.map((o) => {
    const confirmed = new Date(round.at - o.ago * 1000).toISOString()
    const parts = [...new Set(o.lines.map((l) => l.stationId))].map((id) => ({ stationId: id, stationName: stations[id - 1].name, showsOnScreen: true, readyAt: round.ready.get(o.no) ?? null }))
    return {
      orderNumber: o.no, date: confirmed, confirmedAt: confirmed, readyAt: round.ready.get(o.no) ?? null, source: o.table ? 'Customer' : 'Pos', platform: null, isDelivery: false,
      placeId: o.table ? o.no : null, placeKind: o.table ? 'Table' : null, placeName: o.table, customerName: o.name, customerNote: null, items: o.lines, parts,
    }
  })
}

// ——— The till ———————————————————————————————————————————————————

const ago = (seconds) => new Date(Date.now() - seconds * 1000).toISOString()

const places = () =>
  [
    [1, 2, 'Table 1', 'ترابيزة 1', 1],
    [2, 2, 'Table 2', 'ترابيزة 2', 2],
    [3, 2, 'Table 3', 'ترابيزة 3', 2],
    [4, 2, 'Table 4', 'ترابيزة 4', 1],
    [5, 2, 'Table 5', 'ترابيزة 5', 1],
    [6, 2, 'Table 6', 'ترابيزة 6', 1],
    [7, 2, 'Table 7', 'ترابيزة 7', 2],
    [8, 2, 'Garden', 'الجنينة', 1],
  ].map(([id, kind, en, ar, status]) => ({
    id, kind, name: t(en, ar), description: null, branchId: 1, status, isActive: true, tariff: null, isTimed: false, hasOptions: false,
    reservable: true, canReserve: true, takesControllerRequests: false, currentStay: null, currentReservation: null, seatedReservation: null,
  }))

const openTickets = () => [
  { id: 501, type: 'Table', status: 'Open', locationName: t('Table 7', 'ترابيزة 7'), sessionId: null, placeId: 7, placeKind: 'Table', label: null, openedAt: ago(1500), lastActivityAt: ago(372), lineCount: 3, total: 310, customerIds: [] },
  { id: 502, type: 'Table', status: 'Open', locationName: t('Table 2', 'ترابيزة 2'), sessionId: null, placeId: 2, placeKind: 'Table', label: null, openedAt: ago(700), lastActivityAt: ago(64), lineCount: 3, total: 185, customerIds: [] },
  ...(taken() ? [{ id: 503, type: 'Table', status: 'Open', locationName: t('Table 3', 'ترابيزة 3'), sessionId: null, placeId: 3, placeKind: 'Table', label: null, openedAt: ago(5), lastActivityAt: ago(5), lineCount: 2, total: 220, customerIds: [] }] : []),
]

const orderItem = (id, units) => ({ productName: MENU.find((m) => m[0] === id)[5], units, unitPrice: MENU.find((m) => m[0] === id)[3], pictureUrl: '/api/catalog/items/' + id + '/pic?v=1', customizationsDescription: null, specialInstructions: null })

// When the till last took the guest's order. For a while after, it is a bill on Table 3;
// then the evening starts over and the order is waiting again, for the next visitor's look
let takenAt = 0
const taken = () => Date.now() - takenAt < 20000

// The order a guest has just sent from Table 3, waiting for the till to take it
const pendingOrders = () => taken() ? [] : [
  {
    orderNumber: 1042, date: ago(20), status: 'Submitted', total: 220, pointsToRedeem: 0, loyaltyDiscount: 0, promoCode: null, promoDiscount: 0, paysOnline: false, paymentDueBy: null,
    paidOnlineAt: null, paidAt: null, receiptNumber: null, paidWith: null, refundedAmount: 0, voidedAt: null, ticketId: null, placeId: 3, placeKind: 'Table', placeName: t('Table 3', 'ترابيزة 3'),
    sessionId: null, source: 'Customer', takenByName: null, takenAtBranchId: null, platform: null, delivery: null, userName: 'Lina Ahmed', userId: null, guestPhone: '01012345678',
    guestOrdersBefore: 6, ratingValue: null, customerNote: null, items: [orderItem(4, 1), orderItem(11, 1)], isMine: false,
  },
]

const shift = () => ({
  id: 77, branchId: 1, status: 'Open', openedAt: ago(6 * 3600), openedBy: 'Nour Hassan', openingFloat: 500, closedAt: null, closedBy: null, closingCount: null, expectedCash: null, overShort: null,
  movements: [], ticketsSettled: 41, salesTotal: 9840, grossSales: 9840, netSales: 9840, netSalesExVat: 8632, vat: 1208, vatAdded: 0, refundVat: 0, discounts: 0, billDiscounts: 0, lineDiscounts: 0,
  loyaltyAndPromo: 0, tenderTotals: [{ tender: 'Cash', amount: 6120, count: 27, tendered: 6500 }, { tender: 'Card', amount: 3720, count: 14, tendered: 3720 }], cashTendered: 6500, changeGiven: 380,
  refundsTotal: 0, cashRefunds: 0, payInsTotal: 0, payOutsTotal: 0, tabPaymentsTotal: 0, cashTabPayments: 0, tabPaymentTenderTotals: [], tabPayments: [], expectedInDrawer: 6620, lateCash: 0, adjustedOverShort: null,
})

// ——— The owner's dashboard ——————————————————————————————————————

// A day's takings: the same for the same date every time, busier at the weekend
function dayNet(date) {
  const d = new Date(date)
  const seed = d.getUTCDate() * 37 + d.getUTCMonth() * 101
  const weekend = [4, 5].includes(d.getUTCDay()) ? 1.35 : 1
  return Math.round((14200 + (seed % 23) * 310) * weekend)
}

function dailyReport(query) {
  const from = new Date(query.get('from') ?? Date.now() - 30 * 86400000)
  const to = new Date(query.get('to') ?? Date.now())
  const days = []
  for (let at = new Date(from); at < to; at = new Date(at.getTime() + 86400000)) {
    const net = dayNet(at)
    days.push({ date: at.toISOString().slice(0, 10), tickets: Math.round(net / 172), grossSales: net + 240, refunds: 240, netSales: net, refundCount: 1 })
  }
  return { from: from.toISOString(), to: to.toISOString(), timeZone: 'Africa/Cairo', dayStart: '08:00', days }
}

function rangeReport(query) {
  const from = new Date(query.get('from') ?? Date.now() - 86400000)
  const to = new Date(query.get('to') ?? Date.now())
  // A day's takings as far as the day has gone: today's stops at now, as last week's same hours do
  const until = Math.min(to.getTime(), Date.now())
  const share = Math.max(0.05, Math.min(1, (until - from) / 86400000))
  const net = Math.round(dayNet(from) * share)
  const count = Math.round(net / 172)
  return {
    from: from.toISOString(), to: to.toISOString(), ticketsSettled: count, net, grossSales: net + 120, netSales: net, netSalesExVat: Math.round(net / 1.14), discounts: 120, billDiscounts: 80, lineDiscounts: 40,
    loyaltyAndPromo: 0, changeGiven: 0, tenderTotals: [{ tender: 'Cash', amount: Math.round(net * 0.58), count: Math.round(count * 0.6), tendered: Math.round(net * 0.6) }, { tender: 'Card', amount: Math.round(net * 0.3), count: Math.round(count * 0.28), tendered: Math.round(net * 0.3) }, { tender: 'InstaPay', amount: Math.round(net * 0.12), count: Math.round(count * 0.12), tendered: Math.round(net * 0.12) }],
    cashTendered: Math.round(net * 0.6), byType: [{ type: 'Table', count: Math.round(count * 0.55), net: Math.round(net * 0.6) }, { type: 'Counter', count: Math.round(count * 0.45), net: Math.round(net * 0.4) }],
    byChannel: [{ channel: 'Pos', count: Math.round(count * 0.6), gross: Math.round(net * 0.62) }, { channel: 'Customer', count: Math.round(count * 0.4), gross: Math.round(net * 0.38) }],
    subtotal: Math.round(net / 1.14), serviceCharge: 0, vat: Math.round(net - net / 1.14), vatAdded: 0, refundVat: 0, deliveryFees: 0, refunds: 0, refundCount: 0, tabPayments: 0, tabPaymentCount: 0, tabPaymentTenderTotals: [], suggestedSales: 0, suggestedLines: 0,
  }
}

const HOURS = [0, 0, 0, 0, 0, 0, 0, 0, 4, 7, 9, 8, 10, 12, 9, 8, 11, 14, 17, 21, 24, 19, 12, 6]

function breakdown() {
  const sold = [[1, 412], [7, 366], [2, 301], [4, 288], [10, 214], [11, 187], [3, 160], [9, 122]]
  return {
    from: ago(30 * 86400), to: ago(0), offsetMinutes: 120, timeZone: 'Africa/Cairo',
    byHour: HOURS.map((share, hour) => ({ hour, count: share * 9, net: share * 1540 })),
    byWeekday: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, count: [380, 350, 340, 360, 470, 520, 410][weekday], net: [64000, 59000, 57500, 61000, 79500, 88000, 69000][weekday] })),
    byCashier: [{ name: 'Nour Hassan', count: 1420, net: 242000, discounts: 1900, voids: 4, refunds: 2, kind: 'Cashier' }, { name: 'Omar Adel', count: 1410, net: 236000, discounts: 1500, voids: 6, refunds: 3, kind: 'Cashier' }],
    byItem: sold.map(([id, qty]) => ({ description: MENU.find((m) => m[0] === id)[5], qty, amount: qty * MENU.find((m) => m[0] === id)[3], tickets: Math.round(qty * 0.8), catalogItemId: id })),
    byTaker: [],
  }
}

const profit = (query) => ({
  year: Number(query.get('year')) || new Date().getFullYear(), month: Number(query.get('month')) || new Date().getMonth() + 1,
  sales: 486200, refunds: 3100, netSales: 483100, vat: 59700, goods: 151400, waste: 4200, labour: 96000,
  expensesByCategory: [{ categoryId: 1, categoryName: t('Rent', 'الإيجار'), total: 45000 }, { categoryId: 2, categoryName: t('Utilities', 'المرافق'), total: 14800 }, { categoryId: 3, categoryName: t('Supplies', 'مستلزمات'), total: 12500 }],
  expenses: 72300, profit: 99500, primeCostRatio: 0.58, margin: 0.235, partnerShares: null, refundVat: 380, netVat: 59320, netSalesExVat: 423780, shrinkage: 0,
})

const lowStock = () => [
  { stockItemId: 1, name: t('Coffee beans', 'بن'), unit: 'kg', packSize: null, packName: null, autoSoldOut: true, isActive: true, onHand: 3.2, reorderLevel: 5, avgUnitCost: 900, isLow: true, value: 2880, lastCost: 900, lastCostAt: ago(4 * 86400) },
  { stockItemId: 2, name: t('Cocoa powder', 'كاكاو'), unit: 'kg', packSize: null, packName: null, autoSoldOut: false, isActive: true, onHand: 1.1, reorderLevel: 2, avgUnitCost: 420, isLow: true, value: 462, lastCost: 420, lastCostAt: ago(9 * 86400) },
]

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** What the café's server would say, or null for something this demo has no answer to */
function answer(method, path, query) {
  if (path === '/api/tenant') return json(tenant)
  if (path === '/api/branches') return json(branches)
  if (path === '/api/catalog/items') return json(items)
  if (path === '/api/catalog/categories') return json(categories)
  if (path === '/api/catalog/promotions/live') return json([])
  if (path === '/api/orders' && method === 'GET') return json({ pageIndex: 0, pageSize: 50, count: 0, data: [] })
  if (path === '/api/sales/payments/ahead') return json([])
  if (path === '/api/places') return json(places())
  if (path === '/api/shifts/current') return json(shift())
  if (/^\/api\/tickets\/pricing\/\d+$/.test(path)) return json({ branchId: 1, vatRate: 0.14, pricesIncludeVat: true, serviceChargeRate: 0, maxCashierDiscountRate: 0.2 })
  if (path === '/api/orders/pending') return json(pendingOrders())
  if (path === '/api/tickets/reports/daily') return json(dailyReport(query))
  if (path === '/api/tickets/reports/range') return json(rangeReport(query))
  if (path === '/api/tickets/reports/breakdown') return json(breakdown())
  if (path === '/api/finance/profit') return json(profit(query))
  if (path === '/api/stays/stats') return json({ days: [], places: [] })
  if (path === '/api/inventory/levels') return json(lowStock())
  if (path === '/api/orders/confirm') {
    takenAt = Date.now()
    return json({})
  }
  if (path === '/api/tickets/open') return json(openTickets())
  if (['/api/stays/open', '/api/reservations/open', '/api/orders/deliveries', '/api/kitchen/print-jobs', '/api/notifications/service-requests/pending'].includes(path)) return json([])
  if (path === '/api/kitchen/stations') {
    round = { at: Date.now(), ready: new Map() }
    return json(stations)
  }
  if (path === '/api/orders/kitchen') return json(kitchenOrders())
  const ready = path.match(/^\/api\/orders\/(\d+)(\/stations\/\d+)?\/ready$/)
  if (ready) {
    if (method === 'DELETE') round.ready.delete(Number(ready[1]))
    else round.ready.set(Number(ready[1]), new Date().toISOString())
    return json({})
  }
  return null
}

// The page asks for the signed-in member of staff to put in place (src/site_web/src/live/live-app.tsx)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'staff') event.ports[0]?.postMessage(staff(event.data.clientId))
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  const pic = url.pathname.match(/^\/api\/catalog\/items\/(\d+)\/pic$/)
  if (pic) return event.respondWith(fetch('/dishes/' + PHOTO.get(pic[1]) + '.jpg'))
  if (!/^\/(api|hub)\//.test(url.pathname)) return
  event.respondWith(answer(event.request.method, url.pathname, url.searchParams) ?? json({}, 404))
})
