import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { getRealmRoles } from '@/config/oidc-config'
import { useFeatures, useIsCloudKitchen } from '@/lib/brand'
import { ArrowRight, ChevronRight, Laptop, Moon, Sun } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { useT } from '@/lib/i18n'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { sidebarData } from './layout/data/sidebar-data'
import { ScrollArea } from './ui/scroll-area'

export function CommandMenu() {
  const t = useT()
  const navigate = useNavigate()
  const auth = useAuth()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const isOwner = getRealmRoles(auth.user).includes('Owner')
  const features = useFeatures()
  const cloudKitchen = useIsCloudKitchen()

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  // Same gating as the sidebar: an admin must not be offered owner pages
  const groups = sidebarData.navGroups
    .filter((group) => !group.ownerOnly || isOwner)
    .filter((group) => !group.feature || features[group.feature])
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.items ||
          ((!item.feature || features[item.feature]) &&
            (!item.needsPlaces || !cloudKitchen))
      ),
    }))

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t('commandMenuPlaceholder')} />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pe-1'>
          <CommandEmpty>{t('noResultsFound')}</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group.title} heading={t(group.title)}>
              {group.items.map((navItem, i) => {
                if (navItem.url)
                  return (
                    <CommandItem
                      key={`${navItem.url}-${i}`}
                      // Localized value so typing in the UI language matches
                      value={t(navItem.title)}
                      onSelect={() => {
                        runCommand(() => navigate({ to: navItem.url }))
                      }}
                    >
                      <div className='flex size-4 items-center justify-center'>
                        <ArrowRight className='text-muted-foreground/80 size-2' />
                      </div>
                      {t(navItem.title)}
                    </CommandItem>
                  )

                return navItem.items?.map((subItem, i) => (
                  <CommandItem
                    key={`${navItem.title}-${subItem.url}-${i}`}
                    value={`${t(navItem.title)} ${t(subItem.title)}`}
                    onSelect={() => {
                      runCommand(() => navigate({ to: subItem.url }))
                    }}
                  >
                    <div className='flex size-4 items-center justify-center'>
                      <ArrowRight className='text-muted-foreground/80 size-2' />
                    </div>
                    {t(navItem.title)}{' '}
                    <ChevronRight className='rtl:rotate-180' />{' '}
                    {t(subItem.title)}
                  </CommandItem>
                ))
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading={t('theme')}>
            <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <Sun /> <span>{t('light')}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon className='scale-90' />
              <span>{t('dark')}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop />
              <span>{t('systemDefault')}</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
