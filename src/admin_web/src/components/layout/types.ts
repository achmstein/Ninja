import { type LinkProps } from '@tanstack/react-router'
import { type FeatureKey } from '@/lib/brand'
import { type TranslationKey } from '@/lib/i18n'

type BaseNavItem = {
  /** Translation key, rendered through t() */
  title: TranslationKey
  badge?: string
  icon?: React.ElementType
}

type NavLink = BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  items?: never
  /** Only shown to users holding the Owner realm role */
  ownerOnly?: boolean
  /** Only shown while the tenant has this feature switched on */
  feature?: FeatureKey
  /** About tables and rooms: not shown to a cloud kitchen, which has none */
  needsPlaces?: boolean
}

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: LinkProps['to'] | (string & {}) })[]
  url?: never
}

type NavItem = NavCollapsible | NavLink

type NavGroup = {
  title: TranslationKey
  items: NavItem[]
  /** Only shown to users holding the Owner realm role */
  ownerOnly?: boolean
  /** Only shown while the tenant has this feature switched on */
  feature?: FeatureKey
}

type SidebarData = {
  navGroups: NavGroup[]
}

export type { SidebarData, NavGroup, NavItem, NavCollapsible, NavLink }
