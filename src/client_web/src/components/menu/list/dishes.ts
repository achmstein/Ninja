import type { ComponentType } from 'react'
import { CompactRow } from './compact-row'
import type { DishProps, MenuList } from './use-dish'
import { HeroCard } from './hero-card'
import { PhotoTile } from './photo-tile'
import { Row } from './row'

export type { MenuList } from './use-dish'

/** Each menu style's dish, and how its category lays them out */
export const LIST_STYLES: Record<MenuList, { Dish: ComponentType<DishProps>; className: string }> = {
  row: { Dish: Row, className: 'flex flex-col gap-4' },
  card: { Dish: PhotoTile, className: 'grid grid-cols-2 gap-x-3 gap-y-5' },
  compact: { Dish: CompactRow, className: 'divide-border/60 flex flex-col divide-y' },
  hero: { Dish: HeroCard, className: 'flex flex-col gap-4' },
}
