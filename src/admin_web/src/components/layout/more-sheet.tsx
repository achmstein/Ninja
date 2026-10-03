import { Link, useLocation } from '@tanstack/react-router'
import { Download, Settings, Share } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useInstallApp } from '@/lib/install-prompt'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { checkIsActive } from './nav-active'
import { useNavGroups } from './use-nav-groups'

/** An iPhone's Safari has no install offer: it says how, until it is installed */
function iosNeedsHint() {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios && !standalone
}

/**
 * Everything beyond the tab bar, on a phone: every page of the sidebar as
 * tiles under their group, rising from the bottom in the thumb's reach;
 * then the settings, and the way to install the admin as an app.
 */
export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const href = useLocation({ select: (location) => location.href })
  const groups = useNavGroups()
  const { canInstall, install } = useInstallApp()
  const close = () => onOpenChange(false)

  const row =
    'hover:bg-muted flex w-full items-center gap-3 rounded-lg px-3 py-3 text-start text-sm font-medium transition-colors'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='bottom'
        className='max-h-[88dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]'
      >
        <div
          aria-hidden
          className='bg-muted-foreground/30 mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full'
        />
        <SheetHeader className='border-b-0 pb-2'>
          <SheetTitle>{t('more')}</SheetTitle>
          <SheetDescription className='sr-only'>
            {t('navigation')}
          </SheetDescription>
        </SheetHeader>
        <div className='flex flex-col gap-5 px-4 pb-2'>
          {groups.map((group) => {
            const urls = group.items.map((item) => String(item.url))
            return (
              <section key={group.title} className='flex flex-col gap-2'>
                <h3 className='text-muted-foreground px-1 text-xs font-medium'>
                  {t(group.title)}
                </h3>
                <div className='grid grid-cols-3 gap-2'>
                  {group.items.map((item) => {
                    if (!item.url) return null
                    const active = checkIsActive(href, item, false, urls)
                    return (
                      <Link
                        key={String(item.url)}
                        to={item.url}
                        onClick={close}
                        className={cn(
                          'bg-card relative flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-center shadow-xs transition-colors',
                          active ? 'ring-primary ring-2' : 'hover:bg-muted/60'
                        )}
                      >
                        {item.icon && (
                          <item.icon className='text-muted-foreground size-5' />
                        )}
                        <span className='line-clamp-2 text-xs leading-tight font-medium'>
                          {t(item.title)}
                        </span>
                        {item.badge && (
                          <span className='bg-primary text-primary-foreground absolute end-2 top-2 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold tabular-nums'>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}

          <div className='bg-card flex flex-col rounded-xl p-1 shadow-xs'>
            <Link to='/settings' onClick={close} className={row}>
              <Settings className='text-muted-foreground size-5' />
              {t('settings')}
            </Link>
            {canInstall && (
              <button
                type='button'
                className={row}
                onClick={() => {
                  install()
                  close()
                }}
              >
                <Download className='text-muted-foreground size-5' />
                {t('installApp')}
              </button>
            )}
            {!canInstall && iosNeedsHint() && (
              <div className='flex items-start gap-3 px-3 py-3 text-sm'>
                <Share className='text-muted-foreground mt-0.5 size-5 shrink-0' />
                <div>
                  <div className='font-medium'>{t('installApp')}</div>
                  <div className='text-muted-foreground'>
                    {t('installAppIos')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
