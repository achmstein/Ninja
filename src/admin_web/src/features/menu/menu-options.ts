import { type CatalogItemDto } from '@/api/catalog'
import { toNumber } from '@/lib/money'

// The item's customization options, in menu order, the shape the recipe
// editors work with: ids as strings, labels already localized.

export type MenuOption = {
  id: string
  label: string
  groupIndex: number
  index: number
  isDefault: boolean
}
export type MenuGroup = {
  id: string
  label: string
  allowMultiple: boolean
  options: MenuOption[]
}
export type MenuOptions = {
  groups: MenuGroup[]
  byId: Map<string, MenuOption>
}

export function menuOptionsOf(
  item: CatalogItemDto,
  localized: (
    t: { en?: string | null; ar?: string | null } | null | undefined
  ) => string
): MenuOptions {
  const byOrder = <T extends { displayOrder?: number | string }>(a: T, b: T) =>
    toNumber(a.displayOrder) - toNumber(b.displayOrder)
  const byId = new Map<string, MenuOption>()
  const groups: MenuGroup[] = [...(item.customizations ?? [])]
    .sort(byOrder)
    .map((group, groupIndex) => ({
      id: String(group.id),
      label: localized(group.name),
      allowMultiple: group.allowMultiple === true,
      options: [...(group.options ?? [])].sort(byOrder).map((option, index) => {
        const entry = {
          id: String(option.id),
          label: localized(option.name),
          groupIndex,
          index,
          isDefault: option.isDefault === true,
        }
        byId.set(entry.id, entry)
        return entry
      }),
    }))
    .filter((group) => group.options.length > 0)
  return { groups, byId }
}
