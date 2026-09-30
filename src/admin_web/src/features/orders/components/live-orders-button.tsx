import { Link } from '@tanstack/react-router'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * The way from the history into the live queue. Quiet while nothing waits;
 * filled, pulsing and counting while orders wait for a confirm.
 */
export function LiveOrdersButton({ pendingCount }: { pendingCount: number }) {
  const t = useT()
  const waiting = pendingCount > 0
  return (
    <Button asChild variant={waiting ? 'default' : 'outline'}>
      <Link to='/orders/live'>
        <span className='relative flex size-2' aria-hidden>
          {waiting && (
            <span className='absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75 motion-reduce:hidden' />
          )}
          <span
            className={cn(
              'relative inline-flex size-2 rounded-full',
              waiting ? 'bg-current' : 'bg-muted-foreground/50'
            )}
          />
        </span>
        {t('liveOrders')}
        {waiting && (
          <Badge variant='secondary' className='h-5 px-1.5 tabular-nums'>
            {pendingCount}
          </Badge>
        )}
      </Link>
    </Button>
  )
}
