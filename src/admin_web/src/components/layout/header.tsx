import { useEffect, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { ChevronRight, SearchIcon } from 'lucide-react'
import { useBranchStore } from '@/stores/branch-store'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useSearch } from '@/context/search-provider'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { LanguageSwitch } from '@/components/language-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { sidebarData } from './data/sidebar-data'
import { LogoSlot } from './logo-slot'
import { navTrail } from './nav-active'

type HeaderProps = React.HTMLAttributes<HTMLElement>

/**
 * The one top bar, sticky on every page, as a console's: where you are
 * (the section and the page, as breadcrumbs) and "Go to…", the search that
 * opens any page or person, in the middle; the language, theme and account
 * at the end. On a phone the sidebar is behind the tab bar's More, so the
 * bar carries the business's logo and the branch instead, and the search is
 * an icon. It lifts on a soft shadow once the page scrolls under it.
 */
export function Header({ className, ...props }: HeaderProps) {
  const t = useT()
  const localized = useLocalized()
  const { setOpen } = useSearch()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const trail = navTrail(pathname, sidebarData.navGroups)
  const { branches } = useAllowedBranches()
  const branchId = useBranchStore((s) => s.branchId)
  const branch = branches.find((b) => Number(b.id) === branchId)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () =>
      setScrolled(
        (document.body.scrollTop || document.documentElement.scrollTop) > 8
      )
    document.addEventListener('scroll', onScroll, { passive: true })
    return () => document.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'peer/header bg-background/80 sticky top-0 z-40 h-14 w-[inherit] shrink-0 backdrop-blur-xl transition-shadow md:rounded-t-xl',
        scrolled ? 'shadow-xs' : 'shadow-none',
        className
      )}
      {...props}
    >
      <div className='flex h-full items-center gap-2 px-4 md:gap-3'>
        {/* A phone: the business and its branch; the menu is the tab bar's More */}
        <div className='flex min-w-0 items-center gap-2 md:hidden'>
          <LogoSlot nameClassName='text-sm' />
          {branches.length > 1 && branch && (
            <span className='text-muted-foreground truncate text-sm'>
              / {localized(branch.name)}
            </span>
          )}
        </div>

        <SidebarTrigger className='text-muted-foreground hidden size-8 md:inline-flex' />

        {trail && (
          <nav
            aria-label={t('navigation')}
            className='hidden min-w-0 items-center gap-1.5 text-sm md:flex'
          >
            {trail.group && (
              <>
                <span className='text-muted-foreground truncate'>
                  {t(trail.group)}
                </span>
                <ChevronRight className='text-muted-foreground/60 size-3.5 shrink-0 rtl:rotate-180' />
              </>
            )}
            <span className='truncate font-medium'>{t(trail.page)}</span>
          </nav>
        )}

        {/* "Go to…": a wide field on a desk, an icon on a phone */}
        <button
          type='button'
          onClick={() => setOpen(true)}
          className='bg-muted/60 text-muted-foreground hover:bg-muted mx-auto hidden h-9 w-full max-w-md items-center gap-2 rounded-lg px-3 text-sm shadow-xs transition-colors md:flex'
        >
          <SearchIcon className='size-4' />
          <span className='flex-1 text-start'>{t('goTo')}</span>
          <kbd className='bg-background rounded border px-1.5 font-mono text-[11px]'>
            Ctrl K
          </kbd>
        </button>

        <div className='ms-auto flex items-center gap-1 md:ms-0 md:gap-2'>
          <Button
            variant='ghost'
            size='icon'
            className='size-9 md:hidden'
            aria-label={t('goTo')}
            onClick={() => setOpen(true)}
          >
            <SearchIcon className='size-5' />
          </Button>
          <div className='hidden items-center gap-2 md:flex'>
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}
