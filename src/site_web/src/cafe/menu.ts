/**
 * The businesses the page runs: four made-up brands (the same four as the
 * films in marketing/video), each with its own menu, colour and wordmark.
 * The photos are the app's sample menu photos.
 */
export type Lang = 'en' | 'ar'
export type Words = Record<Lang, string>

export type Item = { id: string; name: Words; note: Words; price: number; cat: number }

export type BrandId = 'mellow' | 'smash' | 'zaytoun' | 'levelup'

export type Brand = {
  id: BrandId
  name: string
  kind: Words
  /** The colour its buttons wear, and its dock's deep shade */
  primary: string
  slab: string
  /** The font of its wordmark */
  logoFont: string
  logoItalic?: boolean
  logoUpper?: boolean
  categories: Words[]
  items: Item[]
}

const w = (en: string, ar: string): Words => ({ en, ar })

export const BRANDS: Brand[] = [
  {
    id: 'mellow',
    name: 'Mellow',
    kind: w('Café', 'كافيه'),
    primary: '#0f172a',
    slab: '#020617',
    logoFont: 'Pacifico',
    categories: [w('Coffee', 'قهوة'), w('Iced', 'ساقع'), w('Food', 'أكل'), w('Desserts', 'حلويات')],
    items: [
      { id: 'latte', name: w('Latte', 'لاتيه'), note: w('Double shot, steamed milk', 'دبل شوت ولبن'), price: 75, cat: 0 },
      { id: 'cappuccino', name: w('Cappuccino', 'كابتشينو'), note: w('Espresso, velvet foam', 'إسبريسو ورغوة ناعمة'), price: 70, cat: 0 },
      { id: 'flatwhite', name: w('Flat White', 'فلات وايت'), note: w('Two shots, thin foam', 'شوتين ورغوة خفيفة'), price: 70, cat: 0 },
      { id: 'mocha', name: w('Iced Mocha', 'آيس موكا'), note: w('Chocolate, espresso, cream', 'شوكولاتة وإسبريسو وكريمة'), price: 95, cat: 1 },
      { id: 'lemonade', name: w('Lemonade', 'ليمونادة'), note: w('Fresh lemon, ice', 'ليمون فريش وتلج'), price: 65, cat: 1 },
      { id: 'waffle', name: w('Waffle', 'وافل'), note: w('Belgian, chocolate drizzle', 'بلجيكي بصوص شوكولاتة'), price: 110, cat: 2 },
      { id: 'cake', name: w('Chocolate Cake', 'كيكة شوكولاتة'), note: w('Three layers, dark ganache', 'تلات طبقات وجاناش'), price: 120, cat: 3 },
    ],
  },
  {
    id: 'smash',
    name: 'Smash Lab',
    kind: w('Burger kitchen', 'مطبخ برجر'),
    primary: '#b91c1c',
    slab: '#2b0a0a',
    logoFont: 'Anton',
    logoUpper: true,
    categories: [w('Burgers', 'برجر'), w('Sides', 'جانبي'), w('Wraps', 'راب')],
    items: [
      { id: 'smash', name: w('Classic Smash', 'كلاسيك سماش'), note: w('Beef, cheddar, house sauce', 'لحم وشيدر وصوص البيت'), price: 165, cat: 0 },
      { id: 'double', name: w('Double Smash', 'دبل سماش'), note: w('Two patties, double cheese', 'قطعتين لحم ودبل جبنة'), price: 220, cat: 0 },
      { id: 'crispy', name: w('Crispy Chicken', 'كريسبي تشيكن'), note: w('Buttermilk fried, slaw', 'فراخ مقرمشة وكول سلو'), price: 175, cat: 0 },
      { id: 'cheesefries', name: w('Cheese Fries', 'بطاطس بالجبنة'), note: w('Cheddar sauce, jalapeño', 'صوص شيدر وهالبينو'), price: 85, cat: 1 },
      { id: 'rings', name: w('Onion Rings', 'حلقات بصل'), note: w('Crispy, smoky dip', 'مقرمشة بصوص مدخن'), price: 70, cat: 1 },
      { id: 'shawarma', name: w('Beef Shawarma', 'شاورما لحم'), note: w('Tahini, pickles, saj bread', 'طحينة ومخلل وعيش صاج'), price: 140, cat: 2 },
    ],
  },
  {
    id: 'zaytoun',
    name: 'Zaytoun',
    kind: w('Restaurant', 'مطعم'),
    primary: '#3f6212',
    slab: '#1a2e05',
    logoFont: 'Playfair Display',
    logoItalic: true,
    categories: [w('Grills', 'مشويات'), w('Mezze', 'مقبلات'), w('Sweets', 'حلو')],
    items: [
      { id: 'grill', name: w('Mixed Grill', 'مشكل مشاوي'), note: w('Kofta, tawook, lamb chops', 'كفتة وطاووق وريش'), price: 420, cat: 0 },
      { id: 'tawook', name: w('Shish Tawook', 'شيش طاووق'), note: w('Garlic sauce, grilled veg', 'تومية وخضار مشوي'), price: 260, cat: 0 },
      { id: 'kofta', name: w('Kofta', 'كفتة'), note: w('Charcoal grilled, tahini', 'على الفحم بالطحينة'), price: 240, cat: 0 },
      { id: 'fattoush', name: w('Fattoush', 'فتوش'), note: w('Sumac, crispy bread', 'سماق وعيش مقرمش'), price: 95, cat: 1 },
      { id: 'hummus', name: w('Hummus', 'حمص'), note: w('Olive oil, warm bread', 'زيت زيتون وعيش سخن'), price: 75, cat: 1 },
      { id: 'omali', name: w('Om Ali', 'أم علي'), note: w('Baked, nuts and cream', 'في الفرن بالمكسرات والقشطة'), price: 90, cat: 2 },
    ],
  },
  {
    id: 'levelup',
    name: 'Level Up',
    kind: w('PlayStation lounge', 'بلايستيشن'),
    primary: '#7c3aed',
    slab: '#1a0b33',
    logoFont: 'Bungee',
    logoUpper: true,
    categories: [w('Snacks', 'سناكس'), w('Drinks', 'مشروبات')],
    items: [
      { id: 'pizza', name: w('Mini Pizza', 'ميني بيتزا'), note: w('Mozzarella, pepperoni', 'موتزاريلا وببروني'), price: 120, cat: 0 },
      { id: 'nachos', name: w('Loaded Nachos', 'ناتشوز'), note: w('Cheese, salsa, jalapeño', 'جبنة وصلصة وهالبينو'), price: 110, cat: 0 },
      { id: 'hotdog', name: w('Hot Dog', 'هوت دوج'), note: w('Mustard, crispy onions', 'مسطردة وبصل مقرمش'), price: 80, cat: 0 },
      { id: 'popcorn', name: w('Popcorn', 'فشار'), note: w('Salted or caramel', 'مملح أو كراميل'), price: 45, cat: 0 },
      { id: 'gshake', name: w('Milkshake', 'ميلك شيك'), note: w('Oreo or strawberry', 'أوريو أو فراولة'), price: 95, cat: 1 },
      { id: 'mocktail', name: w('Blue Mocktail', 'موكتيل أزرق'), note: w('Blue curaçao, lime, soda', 'بلو كوراساو وليمون وصودا'), price: 75, cat: 1 },
    ],
  },
]

/** The dish the owner adds by asking the assistant; it joins the café's menu when they do */
export const ASKED_FOR: Item = {
  id: 'spanish',
  name: w('Spanish Latte', 'سبانش لاتيه'),
  note: w('Espresso, condensed milk', 'إسبريسو ولبن مكثف'),
  price: 85,
  cat: 0,
}

/** A brand as it stands: the café's menu carries the dish asked for once it has been added */
export function brandById(id: BrandId, added = false): Brand {
  const brand = BRANDS.find((b) => b.id === id) ?? BRANDS[0]
  return added && brand.id === 'mellow' ? { ...brand, items: [ASKED_FOR, ...brand.items] } : brand
}

const ALL = new Map([...BRANDS.flatMap((b) => b.items), ASKED_FOR].map((i) => [i.id, i]))

/** Any brand's item by its id; an order keeps its lines when the brand on show changes */
export const itemById = (id: string): Item => {
  const item = ALL.get(id)
  if (!item) throw new Error(`No item ${id}`)
  return item
}

export const photo = (id: string) => `/dishes/${id}.webp`
