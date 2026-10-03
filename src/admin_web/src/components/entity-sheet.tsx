import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type SheetTab = {
  value: string
  label: ReactNode
  /** A count beside the label (customizations, pairings) */
  badge?: number
  disabled?: boolean
  hidden?: boolean
}

type EntitySheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  subtitle?: ReactNode
  /** A StatusChip beside the title */
  status?: ReactNode
  /** Something the header carries at its end (Print) */
  headerAction?: ReactNode
  /** The key figures, as a strip under the title */
  figures?: { label: ReactNode; value: ReactNode; tone?: string }[]
  /** Tabs under the title; the children are then the TabsContent panels */
  tabs?: {
    items: SheetTab[]
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
  }
  /** A row under the header that stays put (a search over a list) */
  toolbar?: ReactNode
  /** forms and records; wide for a review of many lines */
  size?: 'default' | 'wide'
  /** The children are Sections, which carry their own padding */
  flush?: boolean
  /** The way out of it, on the footer's start side (Delete, Mark left) */
  danger?: ReactNode
  /** Its actions, on the footer's end side: Cancel, then the main one */
  actions?: ReactNode
  /** What the footer says beside the actions (3 of 12 picked) */
  footerNote?: ReactNode
  children: ReactNode
  className?: string
}

type Slots = { start: HTMLElement | null; end: HTMLElement | null }
const SlotsContext = createContext<Slots>({ start: null, end: null })

/**
 * Anything a page opens (an order, a bill, a dish, a person, a shift) in one
 * shape. The header says what it is: its title, a line under it, its state,
 * its key figures, its tabs. The body scrolls. The footer stays in reach:
 * the way out of it (Delete) on the start side, Cancel and the main action
 * on the end side. From the side on a desk, rising from the bottom on a
 * phone.
 */
export function EntitySheet({
  open,
  onOpenChange,
  title,
  subtitle,
  status,
  headerAction,
  figures,
  tabs,
  toolbar,
  size = 'default',
  flush = false,
  danger,
  actions,
  footerNote,
  children,
  className,
}: EntitySheetProps) {
  const [start, setStart] = useState<HTMLElement | null>(null)
  const [end, setEnd] = useState<HTMLElement | null>(null)

  const header = (
    <SheetHeader className='gap-3'>
      <div className='flex items-start gap-3 pe-8'>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <SheetTitle>{title}</SheetTitle>
            {status}
          </div>
          {subtitle ? (
            <SheetDescription className='mt-0.5'>{subtitle}</SheetDescription>
          ) : (
            <SheetDescription className='sr-only'>{title}</SheetDescription>
          )}
        </div>
        {headerAction}
      </div>
      {figures && figures.length > 0 && (
        <div
          className='bg-muted/50 grid divide-x overflow-hidden rounded-lg text-center rtl:divide-x-reverse'
          style={{
            gridTemplateColumns: `repeat(${figures.length}, minmax(0, 1fr))`,
          }}
        >
          {figures.map((f, i) => (
            <div key={i} className='px-2 py-2'>
              <div className='text-muted-foreground text-xs'>{f.label}</div>
              <div className={cn('font-semibold tabular-nums', f.tone)}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
      )}
      {tabs && (
        <TabsList className='w-full justify-start overflow-x-auto'>
          {tabs.items
            .filter((tab) => !tab.hidden)
            .map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                disabled={tab.disabled}
              >
                {tab.label}
                {tab.badge ? (
                  <Badge
                    variant='secondary'
                    className='h-5 min-w-5 rounded-full px-1.5 text-[11px] tabular-nums'
                  >
                    {tab.badge}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
        </TabsList>
      )}
    </SheetHeader>
  )

  const body = (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-y-auto',
        !flush && 'gap-5 p-5'
      )}
    >
      {children}
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          'overflow-hidden',
          size === 'wide' ? 'sm:max-w-3xl' : 'sm:max-w-xl',
          className
        )}
      >
        <SlotsContext.Provider value={{ start, end }}>
          {tabs ? (
            <Tabs
              value={tabs.value}
              defaultValue={tabs.defaultValue}
              onValueChange={tabs.onValueChange}
              className='flex min-h-0 flex-1 flex-col gap-0'
            >
              {header}
              {toolbar}
              {body}
            </Tabs>
          ) : (
            <>
              {header}
              {toolbar}
              {body}
            </>
          )}
          {/* Shown once anything is in it: a prop, or a SheetActions portal */}
          <div className='border-border/60 bg-background hidden items-center gap-2 border-t p-4 has-[[data-sheet-slot]>*]:flex'>
            <div
              ref={setStart}
              data-sheet-slot=''
              className='flex items-center gap-2 empty:hidden'
            >
              {danger}
            </div>
            <span className='text-muted-foreground min-w-0 flex-1 truncate text-sm'>
              {footerNote}
            </span>
            <div
              ref={setEnd}
              data-sheet-slot=''
              className='flex items-center gap-2 empty:hidden'
            >
              {actions}
            </div>
          </div>
        </SlotsContext.Provider>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Puts a part's actions into its sheet's footer, from wherever the part is
 * drawn: a tab's Save, a form's Cancel. `side='start'` is the way out of it
 * (Delete). Rendered only while the part is, so a tab's actions leave with
 * the tab.
 */
export function SheetActions({
  side = 'end',
  children,
}: {
  side?: 'start' | 'end'
  children: ReactNode
}) {
  const slots = useContext(SlotsContext)
  const target = side === 'start' ? slots.start : slots.end
  return target ? createPortal(children, target) : null
}
