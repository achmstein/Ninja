import type { ComponentType } from 'react'
import { CompactRow } from './compact-row'
import type { ItemProps, MenuList } from './use-item'
import { HeroCard } from './hero-card'
import { PhotoTile } from './photo-tile'
import { Row } from './row'

export type { MenuList } from './use-item'

/** Each menu style's item, and how its category lays them out */
export const LIST_STYLES: Record<MenuList, { Item: ComponentType<ItemProps>; className: string }> = {
  row: { Item: Row, className: 'flex flex-col gap-4' },
  card: { Item: PhotoTile, className: 'grid grid-cols-2 gap-x-3 gap-y-5' },
  compact: { Item: CompactRow, className: 'divide-border/60 flex flex-col divide-y' },
  hero: { Item: HeroCard, className: 'flex flex-col gap-4' },
}
