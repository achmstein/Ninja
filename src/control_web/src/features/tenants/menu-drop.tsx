import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { FileText, RotateCcw, Upload } from 'lucide-react'
import { scanMenuForNewTenantMutation } from '@/api/control/@tanstack/react-query.gen'
import { useT } from '@/lib/i18n'
import { MENU_ACCEPT, MENU_MAX_PAGES, menuPages } from '@/lib/menu-pages'
import { problemDetail } from '@/lib/problem'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { fromProposal, includedCount, menuText as text, type DropCategory, type DropItem } from './menu-review'

type MenuDropProps = {
  /** The business's languages: a one-language business's menu is read in that language only */
  languages: 'both' | 'en' | 'ar'
  menu: DropCategory[] | null
  onMenu: (menu: DropCategory[] | null) => void
}

/**
 * The new business's menu, read while its form is filled: a PDF or photos dropped
 * here are read by the platform's AI (the admin's menu scan, the same), the
 * dishes and prices appear to tick and fix, and what is ticked goes into the
 * catalog as soon as the business's stack is up.
 */
export function MenuDrop({ languages, menu, onMenu }: MenuDropProps) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pages, setPages] = useState<string[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const scan = useMutation(scanMenuForNewTenantMutation())

  // The page thumbnails' URLs go when the pages do
  useEffect(() => () => pages.forEach((url) => URL.revokeObjectURL(url)), [pages])

  const read = async (files: File[]) => {
    if (files.length === 0) return
    setProblem(null)
    setPreparing(true)
    let prepared
    try {
      prepared = await menuPages(files)
    } catch {
      setPreparing(false)
      setProblem(t('menuDropUnreadable'))
      return
    }
    setPreparing(false)
    if (prepared.pages.length === 0) {
      setProblem(t('menuDropNotAMenu'))
      return
    }
    setPages(prepared.pages.map((page) => URL.createObjectURL(page)))
    scan.mutate(
      { body: { files: prepared.pages, languages } },
      {
        onSuccess: (proposal) => {
          const read = fromProposal(proposal)
          if (read.every((c) => c.items.length === 0)) {
            setProblem(proposal.notes || t('menuDropNothingRead'))
            return
          }
          onMenu(read)
          if (prepared.leftOut > 0)
            setProblem(t('menuDropLeftOut', { count: String(prepared.leftOut), max: String(MENU_MAX_PAGES) }))
        },
        onError: (e) => setProblem(problemDetail(e) || t('menuDropFailed')),
      }
    )
  }

  const reset = () => {
    onMenu(null)
    setPages([])
    setProblem(null)
    scan.reset()
  }

  const busy = preparing || scan.isPending

  return (
    <div className='flex flex-col gap-3'>
      <input
        ref={input}
        type='file'
        multiple
        accept={MENU_ACCEPT}
        className='hidden'
        onChange={(e) => {
          void read(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <AnimatePresence mode='popLayout' initial={false}>
        {busy ? (
          <Reading key='reading' pages={pages} preparing={preparing} />
        ) : menu ? (
          <Review key='review' menu={menu} onMenu={onMenu} onReset={reset} />
        ) : (
          <motion.button
            key='drop'
            type='button'
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, scale: dragging ? 1.02 : 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              void read(Array.from(e.dataTransfer.files))
            }}
            className={cn(
              'flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            )}
          >
            <motion.span
              className='bg-muted grid size-14 place-items-center rounded-2xl'
              animate={dragging ? { y: -4, rotate: -6 } : { y: 0, rotate: 0 }}
            >
              <Upload className='text-muted-foreground size-6' />
            </motion.span>
            <span className='font-semibold'>{t('menuDropTitle')}</span>
            <span className='text-muted-foreground max-w-56 text-sm'>
              {t('menuDropHint', { max: String(MENU_MAX_PAGES) })}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
      {problem && (
        <Alert variant={menu ? 'default' : 'destructive'}>
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/**
 * The pages being read: each one shown, a bright band sweeping down it over and over, the next page a beat
 * behind, as if read one after the other. Still under reduced motion.
 */
function Reading({ pages, preparing }: { pages: string[]; preparing: boolean }) {
  const t = useT()
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className='flex min-h-72 flex-col gap-4 rounded-xl border p-4'
    >
      <div className={cn('grid gap-2', pages.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
        {(pages.length > 0 ? pages : [null]).map((url, i) => (
          <motion.div
            key={url ?? 'preparing'}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            className='bg-muted relative aspect-[3/4] overflow-hidden rounded-md border'
          >
            {url ? (
              <img src={url} alt='' className='h-full w-full object-cover opacity-80' />
            ) : (
              <FileText className='text-muted-foreground/50 absolute inset-0 m-auto size-10' />
            )}
            {!reduced && (
              <motion.div
                aria-hidden
                className='pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-sky-400/45 to-transparent'
                initial={{ top: '-20%' }}
                animate={{ top: ['-20%', '100%'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.35, repeatDelay: 0.3 }}
              />
            )}
          </motion.div>
        ))}
      </div>
      <div className='flex items-center gap-2 text-sm'>
        <motion.span
          className='bg-primary size-2 rounded-full'
          animate={reduced ? undefined : { opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        {preparing ? t('menuDropPreparing') : t('menuDropReading', { count: String(pages.length) })}
      </div>
    </motion.div>
  )
}

/** The dishes read, by section, to untick or fix the price of; each section and dish arriving in turn. */
function Review({
  menu,
  onMenu,
  onReset,
}: {
  menu: DropCategory[]
  onMenu: (menu: DropCategory[]) => void
  onReset: () => void
}) {
  const t = useT()
  const reduced = useReducedMotion()
  const dishes = includedCount(menu)
  const update = (categoryKey: string, itemKey: string, change: Partial<DropItem>) =>
    onMenu(
      menu.map((c) =>
        c.key !== categoryKey ? c : { ...c, items: c.items.map((i) => (i.key === itemKey ? { ...i, ...change } : i)) }
      )
    )
  let order = 0

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className='flex flex-col gap-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='text-sm'>
          <span className='font-semibold tabular-nums'>{t('menuDropDishes', { count: String(dishes) })}</span>
          <span className='text-muted-foreground'> · {t('menuDropCategories', { count: String(menu.length) })}</span>
        </div>
        <Button type='button' variant='ghost' size='sm' onClick={onReset}>
          <RotateCcw />
          {t('menuDropAgain')}
        </Button>
      </div>
      <div className='max-h-[calc(100dvh-14rem)] space-y-4 overflow-y-auto pe-1'>
        {menu.map((category) => (
          <div key={category.key} className='space-y-1.5'>
            <motion.div
              initial={reduced ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(order++ * 0.03, 0.6) }}
              className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'
            >
              {text(category.name)}
            </motion.div>
            {category.items.map((item) => (
              <motion.label
                key={item.key}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: item.include ? 1 : 0.5, y: 0 }}
                transition={{ delay: Math.min(order++ * 0.03, 0.6) }}
                className='hover:bg-muted/50 flex items-center gap-2 rounded-md px-1.5 py-1'
              >
                <Checkbox
                  checked={item.include}
                  onCheckedChange={(on) => update(category.key, item.key, { include: on === true })}
                />
                <span className='min-w-0 flex-1 text-sm'>
                  <span className='block truncate'>{text(item.name)}</span>
                  {item.choice && (
                    <span className='text-muted-foreground block truncate text-xs tabular-nums'>
                      {item.choice.options.map((o) => `${text(o.name)} ${Number(o.price)}`).join(' · ')}
                    </span>
                  )}
                </span>
                {!item.choice && (
                  <Input
                    type='number'
                    inputMode='decimal'
                    min={0}
                    step='any'
                    aria-label={t('menuDropPrice')}
                    value={item.price}
                    onChange={(e) => update(category.key, item.key, { price: e.target.value })}
                    className='h-8 w-20 text-end tabular-nums'
                  />
                )}
              </motion.label>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
