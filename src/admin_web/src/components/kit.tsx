import type { ComponentType, ReactNode } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import {
  AlertTriangle,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { SPRING } from '@/components/motion'

/**
 * The admin's composite pieces: what pages are built from, so every page
 * says the same kind of thing the same way. Each is a shadcn surface with
 * the premium theme; none is a library of its own.
 */

/* ───────────── Attention ───────────── */

/**
 * What needs someone now, said as a sentence at the top of a page: "3
 * orders are waiting, the oldest for 6 minutes". One line, its action at the
 * end; nothing when there is nothing.
 */
export function AttentionBanner({
  tone = 'warning',
  children,
  action,
  className,
}: {
  tone?: 'warning' | 'danger' | 'info'
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  const toneClass = {
    warning: 'bg-warning/10 ring-warning/30 [&_svg]:text-warning',
    danger: 'bg-destructive/8 ring-destructive/25 [&_svg]:text-destructive',
    info: 'bg-info/8 ring-info/25 [&_svg]:text-info',
  }[tone]
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      role='status'
      className={cn(
        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset',
        toneClass,
        className
      )}
    >
      <AlertTriangle className='size-4 shrink-0' />
      <div className='min-w-0 flex-1'>{children}</div>
      {action}
    </motion.div>
  )
}

/* ───────────── Metric tiles ───────────── */

/**
 * A number the page is about: what it is, the number, how it moved (green up,
 * red down, or flat; `goodWhenDown` for a cost), and its shape over the
 * period as a small line. In a MetricStrip, tiles share one surface.
 */
export function MetricTile({
  label,
  value,
  change,
  goodWhenDown = false,
  hint,
  trend,
  loading = false,
  to,
  search,
}: {
  label: ReactNode
  value: ReactNode
  /** As a share: 0.12 is +12% */
  change?: number | null
  goodWhenDown?: boolean
  hint?: ReactNode
  /** The period's values, oldest first, for the small line */
  trend?: number[]
  loading?: boolean
  to?: LinkProps['to']
  search?: LinkProps['search']
}) {
  const up = change != null && change > 0.005
  const down = change != null && change < -0.005
  const good = goodWhenDown ? down : up
  const bad = goodWhenDown ? up : down
  const body = (
    <div className='flex h-full flex-col gap-1 p-4'>
      <div className='text-muted-foreground truncate text-xs font-medium'>
        {label}
      </div>
      <div className='flex items-end justify-between gap-3'>
        <div className='text-2xl font-semibold tracking-tight tabular-nums'>
          {loading ? <Skeleton className='h-8 w-24' /> : value}
        </div>
        {trend && trend.length > 1 && !loading && (
          <Sparkline values={trend} tone={bad ? 'down' : 'up'} />
        )}
      </div>
      {(change != null || hint) && !loading && (
        <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          {change != null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium tabular-nums',
                good && 'text-success',
                bad && 'text-destructive'
              )}
            >
              {up ? (
                <TrendingUp className='size-3.5' />
              ) : down ? (
                <TrendingDown className='size-3.5' />
              ) : null}
              {`${change > 0 ? '+' : ''}${Math.round(change * 100)}%`}
            </span>
          )}
          {hint && <span className='truncate'>{hint}</span>}
        </div>
      )}
    </div>
  )
  return to ? (
    <Link
      to={to}
      search={search}
      className='hover:bg-muted/40 block transition-colors'
    >
      {body}
    </Link>
  ) : (
    body
  )
}

/** Tiles side by side on one surface, divided by hairlines: two a row on a phone */
export function MetricStrip({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-card grid grid-cols-2 overflow-hidden rounded-xl shadow-sm lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none',
        '[&>*]:border-border/60 [&>*]:border-b [&>*]:odd:border-e lg:[&>*]:border-e lg:[&>*]:border-b-0 lg:[&>*:last-child]:border-e-0',
        className
      )}
    >
      {children}
    </div>
  )
}

/** A period's values as a small line, its last point marked */
export function Sparkline({
  values,
  tone = 'up',
  className,
}: {
  values: number[]
  tone?: 'up' | 'down'
  className?: string
}) {
  const w = 72
  const h = 26
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const points = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - 2 - ((v - min) / span) * (h - 4),
  ])
  const d = points
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')
  const [lx, ly] = points[points.length - 1]
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn(
        'h-6.5 w-18 shrink-0 overflow-visible',
        tone === 'up' ? 'text-success' : 'text-destructive',
        className
      )}
      aria-hidden
    >
      <motion.path
        d={d}
        fill='none'
        stroke='currentColor'
        strokeWidth={1.75}
        strokeLinecap='round'
        strokeLinejoin='round'
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
      <circle cx={lx} cy={ly} r={2.25} fill='currentColor' />
    </svg>
  )
}

/* ───────────── Money bar ───────────── */

export type MoneyPart = {
  key: string
  label: ReactNode
  value: number
  display: ReactNode
  /** A Tailwind background for its colour, e.g. bg-chart-1 */
  color: string
}

/**
 * How a total splits (paid by cash, card, Talabat; spent on goods, wages,
 * the rest) as one bar of its parts and a legend with their amounts. Parts
 * of nothing are left out.
 */
export function MoneyBar({
  parts,
  className,
}: {
  parts: MoneyPart[]
  className?: string
}) {
  const shown = parts.filter((p) => p.value > 0)
  const total = shown.reduce((sum, p) => sum + p.value, 0)
  if (total <= 0) return null
  return (
    <div className={cn('grid gap-3', className)}>
      <div className='bg-muted flex h-2.5 gap-0.5 overflow-hidden rounded-full'>
        {shown.map((p, i) => (
          <motion.span
            key={p.key}
            className={cn(
              'h-full first:rounded-s-full last:rounded-e-full',
              p.color
            )}
            initial={{ width: 0 }}
            animate={{ width: `${(p.value / total) * 100}%` }}
            transition={{ ...SPRING, delay: i * 0.05 }}
          />
        ))}
      </div>
      <div className='grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]'>
        {shown.map((p) => (
          <div key={p.key} className='flex items-center gap-2'>
            <span className={cn('size-2 shrink-0 rounded-full', p.color)} />
            <span className='text-muted-foreground truncate'>{p.label}</span>
            <span className='ms-auto font-medium tabular-nums'>
              {p.display}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────────── The sheet ───────────── */

/**
 * Anything a page opens (an order, a bill, a dish, a person, a shift) in one
 * shape: a header with what it is, a line under it, its state and its key
 * figures; the sections; its actions pinned at the bottom in reach. From
 * the side on a desk, rising from the bottom on a phone.
 */
export function EntitySheet({
  open,
  onOpenChange,
  title,
  subtitle,
  status,
  figures,
  children,
  actions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  subtitle?: ReactNode
  status?: ReactNode
  figures?: { label: ReactNode; value: ReactNode; tone?: string }[]
  children: ReactNode
  actions?: ReactNode
}) {
  const isMobile = useIsMobile()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-0 p-0 shadow-lg sm:max-w-md',
          isMobile && 'max-h-[92dvh] rounded-t-2xl'
        )}
      >
        {isMobile && (
          <div className='bg-muted-foreground/30 mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full' />
        )}
        <SheetHeader className='border-border/60 gap-3 border-b p-5'>
          <div className='flex items-start justify-between gap-3 pe-6'>
            <div className='min-w-0'>
              <SheetTitle className='text-lg tracking-tight'>
                {title}
              </SheetTitle>
              {subtitle && (
                <SheetDescription className='mt-0.5'>
                  {subtitle}
                </SheetDescription>
              )}
            </div>
            {status}
          </div>
          {figures && figures.length > 0 && (
            <div
              className='bg-muted/40 grid divide-x overflow-hidden rounded-lg text-center rtl:divide-x-reverse'
              style={{
                gridTemplateColumns: `repeat(${figures.length}, minmax(0, 1fr))`,
              }}
            >
              {figures.map((f, i) => (
                <div key={i} className='px-2 py-2'>
                  <div className='text-muted-foreground text-[11px]'>
                    {f.label}
                  </div>
                  <div className={cn('font-semibold tabular-nums', f.tone)}>
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SheetHeader>
        <div className='flex-1 space-y-5 overflow-y-auto p-5'>{children}</div>
        {actions && (
          <div className='border-border/60 bg-muted/30 flex gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'>
            {actions}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** A titled part of a sheet or a page: small spaced capitals over its content */
export function Section({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('grid gap-2', className)}>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='text-muted-foreground text-[11px] font-semibold tracking-wider uppercase'>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/* ───────────── Settings ───────────── */

/** A card of settings, each a row: as a console lays them out */
export function SettingsCard({
  title,
  description,
  children,
  danger = false,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  danger?: boolean
  className?: string
}) {
  return (
    <section
      className={cn(
        'bg-card overflow-hidden rounded-xl shadow-sm',
        danger && 'ring-destructive/30 ring-1',
        className
      )}
    >
      {title && (
        <div className='border-border/60 border-b px-5 py-4'>
          <h2 className='font-semibold tracking-tight'>{title}</h2>
          {description && (
            <p className='text-muted-foreground mt-0.5 text-sm'>
              {description}
            </p>
          )}
        </div>
      )}
      <div className='divide-border/60 divide-y'>{children}</div>
    </section>
  )
}

/**
 * One setting: what it is and a line of what it does on one side, its
 * control on the other; on a phone the control drops under the text when
 * it is wide. `to` makes the whole row a way into its own page.
 */
export function SettingRow({
  title,
  description,
  control,
  icon: Icon,
  to,
}: {
  title: ReactNode
  description?: ReactNode
  control?: ReactNode
  icon?: ComponentType<{ className?: string }>
  to?: LinkProps['to']
}) {
  const body = (
    <div className='flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4'>
      {Icon && (
        <span className='bg-muted grid size-9 shrink-0 place-items-center rounded-lg'>
          <Icon className='text-muted-foreground size-4' />
        </span>
      )}
      <div className='min-w-[12rem] flex-1'>
        <div className='text-sm font-medium'>{title}</div>
        {description && (
          <div className='text-muted-foreground mt-0.5 text-sm'>
            {description}
          </div>
        )}
      </div>
      {control}
      {to && (
        <ChevronRight className='text-muted-foreground size-4 rtl:rotate-180' />
      )}
    </div>
  )
  return to ? (
    <Link to={to} className='hover:bg-muted/40 block transition-colors'>
      {body}
    </Link>
  ) : (
    body
  )
}
