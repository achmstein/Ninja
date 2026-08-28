import { type LinkProps } from '@tanstack/react-router'
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
}

type SidebarData = {
  navGroups: NavGroup[]
}

export type { SidebarData, NavGroup, NavItem, NavCollapsible, NavLink }
