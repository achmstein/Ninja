/**
 * The page's words in English; ar.ts has the same shape, line for line
 * (plans/plans.test.ts checks). The page says little: each clip gets a title
 * of a few words and nothing under it. The titles are the film's own
 * (marketing/video/src/tour/Fast.tsx), so the page and the film say the same.
 */
export const en = {
  meta: {
    title: 'Ninja: everything your café runs on',
    description:
      'Ninja runs cafés, restaurants and game lounges: a menu guests order from at the table, bookings, a till, a kitchen screen, delivery, loyalty, stock, staff and the books, in one place and in your name.',
  },
  nav: {
    home: 'Ninja home',
    features: 'What it does',
    plans: 'Plans',
    apps: 'Apps',
    talk: 'Talk to us',
    other: 'العربية',
    otherHref: '/ar',
    otherLang: 'ar',
  },
  hero: {
    title: 'Everything your café runs on.',
    lead: 'One order, from the table to the door.',
    clip: 'An order going from a guest’s phone to the till, the kitchen and the rider',
  },
  reel: [
    {
      name: 'For your guests',
      clips: [
        { id: 'brand', title: 'Your app, in your name and colours.' },
        { id: 'pay', title: 'Pay at the table.' },
        { id: 'book', title: 'Book from the phone.' },
        { id: 'loyalty', title: 'Every visit earns points.' },
      ],
    },
    {
      name: 'For your team',
      clips: [
        { id: 'till', title: 'A till learned in a minute.' },
        { id: 'kitchen', title: 'The kitchen sees it instantly.' },
        { id: 'delivery', title: 'Your own riders deliver it.' },
      ],
    },
    {
      name: 'For you',
      clips: [
        { id: 'menu', title: 'Your menu, from a photo.' },
        { id: 'stock', title: 'Stock and recipes.' },
        { id: 'profit', title: 'Expenses, pay and profit.' },
        { id: 'branches', title: 'All your branches.' },
        { id: 'ask', title: 'Ask about your café.' },
      ],
    },
  ],
  plans: {
    title: 'Three plans. Add what you need.',
    names: { Free: 'Free', Starter: 'Starter', Pro: 'Pro' },
    included: 'Included',
    addon: 'Add-on',
    module: 'What you get',
    base: 'Menu, ordering, tables, till, branches, your brand',
    modules: {
      Reservations: 'Reservations',
      TimeBilling: 'Time billing',
      Loyalty: 'Loyalty points',
      Tabs: 'Customer tabs',
      Inventory: 'Stock',
      Finance: 'Finance',
      Payroll: 'Payroll',
      Kds: 'Kitchen screen',
      OnlinePayments: 'Online payments',
      Delivery: 'Delivery',
      Ai: 'Ninja AI',
      CallCentre: 'Call centre',
    },
    price: 'Ask us for a price. A demo comes with everything on.',
  },
  all: {
    summary: 'Everything it does, listed',
    groups: [
      {
        name: 'For guests',
        items: [
          'A menu with photos in five layouts',
          'Search, favourites and “your usual”',
          'Offers by weekday and hour',
          'Promo codes',
          'Order from the table’s code, no account',
          'Order ahead and collect',
          'Delivery to the door',
          'Live order status and rating',
          'Call a waiter, ask for the bill',
          'Pay or split the bill online',
          'Book a place, or hold one on the way',
          'Points, tiers and rewards',
          'Receipts and past bills',
          'Sign in with Google, Apple or email',
          'Arabic and English, light and dark',
        ],
      },
      {
        name: 'At the counter',
        items: [
          'A floor of tables, rooms and open bills',
          'Discounts, refunds, moving lines between bills',
          'Cash, card, InstaPay, tab and online',
          'Shifts, cash in and out, shift report',
          'Delivery orders taken by phone',
          'Sells without the internet',
          'Receipt printer and cash drawer',
        ],
      },
      {
        name: 'In the kitchen',
        items: ['A station for each part of the menu', 'Screen, printer or both', 'Colour by how long an order has waited', 'Ready in one tap'],
      },
      {
        name: 'Rooms and time',
        items: ['Rooms, tables and stations like pool', 'An hourly rate per number of players', 'Bookings and holds that expire by themselves', 'Food and time on one bill'],
      },
      {
        name: 'Delivery',
        items: ['Your own riders and their app', 'An area drawn on the map', 'A fee and a least order', 'Cash carried and settled', 'One call centre for every branch'],
      },
      {
        name: 'Stock and money',
        items: [
          'A recipe and a cost for every dish',
          'Purchases read from the supplier’s receipt',
          'Counts, waste and transfers',
          'Low-stock alerts, sold out by itself',
          'Expenses, suppliers and partners',
          'Profit and loss every month',
          'Pay, attendance and payslips',
        ],
      },
      {
        name: 'Your business',
        items: ['Branches with their own prices and hours', 'Your colours, type and logo', 'Codes to print for every table', 'Your own web address', 'Your own app in the stores'],
      },
      {
        name: 'Done for you by Ninja',
        items: ['A menu read from photos or a PDF', 'A photo for every dish', 'Names filled in and translated', 'A promotion designed from your photo', 'An assistant in Claude or ChatGPT'],
      },
    ],
  },
  cta: {
    title: 'See it on your own menu.',
    whatsapp: 'Message us on WhatsApp',
    whatsappText: 'Hello, I would like to see Ninja for my café.',
    email: 'Email us',
    subject: 'Ninja for my café',
  },
  footer: { rights: '© 2026 Ninja', privacy: 'Privacy', terms: 'Terms', support: 'Support', apps: 'Apps' },
}

export type Content = typeof en
