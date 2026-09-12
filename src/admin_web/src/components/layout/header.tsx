import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { LanguageSwitch } from '@/components/language-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

type HeaderProps = React.HTMLAttributes<HTMLElement>

/**
 * The one top bar, rendered once by the authenticated layout and sticky on
 * every page: sidebar trigger, global search and the theme/language/account
 * controls. The active branch is the switcher in the sidebar; page titles
 * and actions live in each page's PageHeader.
 */
export function Header({ className, ...props }: HeaderProps) {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      setOffset(document.body.scrollTop || document.documentElement.scrollTop)
    }
    document.addEventListener('scroll', onScroll, { passive: true })
    return () => document.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'peer/header sticky top-0 z-50 h-16 w-[inherit] shrink-0',
        offset > 10 ? 'shadow' : 'shadow-none',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'relative flex h-full items-center gap-3 p-4 sm:gap-4',
          offset > 10 &&
            'after:bg-background/20 after:absolute after:inset-0 after:-z-10 after:backdrop-blur-lg'
        )}
      >
        <SidebarTrigger variant='outline' className='max-md:scale-125' />
        <Separator orientation='vertical' className='h-6' />
        <Search />
        <div className='ms-auto flex items-center gap-2 sm:gap-3'>
          <LanguageSwitch />
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}
