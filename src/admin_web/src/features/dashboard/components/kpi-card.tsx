import type { ReactNode } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** A change as a share of before: +0.124 is 12.4% up; null when there was nothing before to compare with */
export function changeOf(now: number, before: number): number | null {
  if (!Number.isFinite(now) || !Number.isFinite(before) || before <= 0)
    return null
  return (now - before) / before
}

/** "+12%", "−4%", "0%" */
export function formatChange(change: number, locale: string): string {
  const pct = Math.round(change * 100)
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : ''
  return `${sign}${new Intl.NumberFormat(locale).format(Math.abs(pct))}%`
}

/**
 * One number the owner looks at first, the way shadcn's dashboard shows one:
 * what it is, the number large, and under it how it moved since the
 * comparison (a badge, green up or red down, or flat) with a line saying
 * what it is against. The whole card opens the page behind the number.
 */
export function KpiCard({
  label,
  value,
  change,
  footer,
  tone = 'default',
  loading = false,
  to,
  search,
}: {
  label: string
  value: ReactNode
  /** The change against the comparison; undefined shows no badge */
  change?: number | null
  footer?: ReactNode
  /** A number that wants attention (orders waiting) reads in the warning colour */
  tone?: 'default' | 'warning'
  loading?: boolean
  to?: LinkProps['to']
  search?: LinkProps['search']
}) {
  const t = useT()
  const locale = useLocale()
  const up = change != null && change > 0.005
  const down = change != null && change < -0.005
  const body = (
    <Card
      className={cn(
        'from-primary/5 to-card @container/card h-full gap-3 bg-gradient-to-t py-4 shadow-xs transition-colors',
        to &&
          'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md'
      )}
    >
      <CardHeader className='px-4'>
        <CardDescription className='truncate'>{label}</CardDescription>
        <CardTitle
          className={cn(
            'text-xl font-semibold break-words tabular-nums @[220px]/card:text-2xl @[300px]/card:text-3xl',
            tone === 'warning' && 'text-warning-foreground dark:text-warning'
          )}
        >
          {loading ? <Skeleton className='h-8 w-24' /> : value}
        </CardTitle>
      </CardHeader>
      {/* The trend sits on the foot line rather than beside the number, so a
          half-width card on a phone keeps the number whole */}
      {(footer || (change !== undefined && !loading)) && (
        <CardFooter className='text-muted-foreground flex-wrap gap-x-2 gap-y-1 px-4 text-xs'>
          {change !== undefined && !loading && (
            <Badge
              variant={up ? 'success' : down ? 'danger' : 'muted'}
              className='gap-1 rounded-full'
            >
              {up ? <TrendingUp /> : down ? <TrendingDown /> : null}
              {change == null ? t('trendNew') : formatChange(change, locale)}
            </Badge>
          )}
          {footer && <span className='line-clamp-2'>{footer}</span>}
        </CardFooter>
      )}
    </Card>
  )
  return to ? (
    <Link
      to={to}
      search={search}
      className='block rounded-xl focus-visible:ring-2 focus-visible:outline-none'
    >
      {body}
    </Link>
  ) : (
    body
  )
}
