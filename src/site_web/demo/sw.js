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
  auth: null,
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

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** What the café's server would say, or null for something this demo has no answer to */
function answer(method, path) {
  if (path === '/api/tenant') return json(tenant)
  if (path === '/api/branches') return json(branches)
  if (path === '/api/catalog/items') return json(items)
  if (path === '/api/catalog/categories') return json(categories)
  if (path === '/api/catalog/promotions/live') return json([])
  if (path === '/api/orders' && method === 'GET') return json({ pageIndex: 0, pageSize: 50, count: 0, data: [] })
  if (path === '/api/sales/payments/ahead') return json([])
  if (path === '/api/places') return json([])
  return null
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  const pic = url.pathname.match(/^\/api\/catalog\/items\/(\d+)\/pic$/)
  if (pic) return event.respondWith(fetch('/dishes/' + PHOTO.get(pic[1]) + '.jpg'))
  if (!/^\/(api|hub)\//.test(url.pathname)) return
  event.respondWith(answer(event.request.method, url.pathname) ?? json({}, 404))
})
