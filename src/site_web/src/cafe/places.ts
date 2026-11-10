import type { Words } from './menu'

/** The places the page's Book tab lists: rooms on the clock and a table, some taken */
export type Place = { id: string; name: Words; note: Words; rate: number | null; state: 'free' | 'occupied' | 'reserved' }

export const PLACES: Place[] = [
  {
    id: 'room1',
    name: { en: 'PS5 Room 1', ar: 'أوضة PS5 رقم 1' },
    note: { en: 'PS5, up to 4 players', ar: 'PS5، لحد 4 لاعبين' },
    rate: 60,
    state: 'free',
  },
  {
    id: 'room2',
    name: { en: 'PS5 Room 2', ar: 'أوضة PS5 رقم 2' },
    note: { en: 'PS5, up to 4 players', ar: 'PS5، لحد 4 لاعبين' },
    rate: 60,
    state: 'occupied',
  },
  {
    id: 'garden',
    name: { en: 'Garden table', ar: 'ترابيزة الجنينة' },
    note: { en: 'Seats 6, outdoors', ar: '6 أفراد، في الهوا' },
    rate: null,
    state: 'free',
  },
  {
    id: 'vip',
    name: { en: 'VIP Room', ar: 'أوضة VIP' },
    note: { en: 'PS5, 75-inch screen', ar: 'PS5، شاشة 75 بوصة' },
    rate: 90,
    state: 'reserved',
  },
]

/** How long a place is held for a guest on the way, in minutes */
export const HOLD_MINUTES = 10
