import { createStore, type StoreApi } from 'zustand'
import type { CatalogItemDto } from '@/api/catalog'
import type { Flight } from './flights'

/**
 * The dish open in place; `from`, the photo it was opened from (the sheet's photo grows out of it and
 * goes back into it); `leaving` once it was added and its photo has taken off
 */
export type Tuning = { item: CatalogItemDto; from?: HTMLElement | null; leaving?: boolean }

/**
 * What changes on the menu while the customer uses it: the dish open, the
 * photos in the air, the tray, the category in view. Kept out of the menu
 * screen's own state so a tap or a scroll re-renders only the part that
 * shows it (the dish sheet, the flights, the dock, the tabs) and never the
 * whole menu, whose every render re-measured each shared layout on it.
 */
export type MenuScreenState = {
  tuning: Tuning | null
  flights: Flight[]
  /** Counts the dishes that reached the tray, which answers each with a bounce */
  bump: number
  /** The order sheet open */
  expanded: boolean
  /** On the whole menu: the category in view, as the jump bar lights it */
  section: number
  /** And the one the jump bar asked to scroll to; `n` tells two asks apart */
  jump: { index: number; n: number } | null
  /** What the screen reader is told (a dish added, the order placed) */
  announce: string
}

export type MenuScreenStore = StoreApi<MenuScreenState>

/** One per menu screen, made as it mounts, so nothing carries over from the last visit */
export const createMenuScreenStore = (): MenuScreenStore =>
  createStore<MenuScreenState>(() => ({
    tuning: null,
    flights: [],
    bump: 0,
    expanded: false,
    section: 0,
    jump: null,
    announce: '',
  }))
