import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, Laptop, Moon, Sun } from 'lucide-react'
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
import { shownBy, useNavContext, visibleNav } from './layout/nav-visibility'
import { ScrollArea } from './ui/scroll-area'

export function CommandMenu() {
  const t = useT()
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  // The sidebar's own rules, from the one place both ask
  const nav = useNavContext()
  const groups = visibleNav(sidebarData.navGroups, nav)

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
                  return [
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
                    </CommandItem>,
                    // The page's other tabs, each found by its own name
                    ...(navItem.tabs ?? [])
                      .filter((tab) => shownBy(tab, nav))
                      .map((tab) => (
                        <CommandItem
                          key={String(tab.url)}
                          value={`${t(navItem.title)} ${t(tab.title)}`}
                          onSelect={() => {
                            runCommand(() => navigate({ to: tab.url }))
                          }}
                        >
                          <div className='flex size-4 items-center justify-center'>
                            <ArrowRight className='text-muted-foreground/80 size-2' />
                          </div>
                          {t(navItem.title)}{' '}
                          <ChevronRight className='rtl:rotate-180' />{' '}
                          {t(tab.title)}
                        </CommandItem>
                      )),
                  ]

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
