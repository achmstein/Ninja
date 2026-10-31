import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { DECK_TOP, SHORT } from '@/components/ninja/shell/chrome'
import { LIST_STYLES } from './list/items'
import type { MenuList } from './list/items'
import type { MenuStyle } from './menu-style'

/**
 * The menu while it loads, in the shape the business's menu style will take:
 * the deck's card with the next one peeking, three small tiles a row, or the
 * list's own items (the classic rows, two photo tiles a row, the compact
 * lines, the wide magazine photos). Laid out with the real grid's padding and
 * each style's own classes (LIST_STYLES), so the menu lands where its
 * placeholder stood. The app's MenuSkeleton draws the same shapes.
 */
export function MenuSkeleton({ style }: { style: MenuStyle }) {
  if (style.kind === 'deck') {
    return (
      <div aria-hidden className='flex h-full flex-col gap-3 px-4 pb-14' style={{ paddingTop: DECK_TOP }}>
        <Skeleton className='min-h-0 flex-1 rounded-[28px]' />
        <Skeleton className='mx-6 h-5 shrink-0 rounded-[28px]' />
      </div>
    )
  }
  return (
    <div aria-hidden className='h-full overflow-hidden px-4 pt-[calc(var(--bar-h)+var(--page-top))] pb-6'>
      {/* The page's large title */}
      <Skeleton className='mb-5 h-8 w-2/5 rounded-full' />
      {[0.3, 0.42].map((heading, s) => (
        <section key={s} className='mb-7'>
          {/* A category's heading */}
          <Skeleton className='mb-3 h-5 rounded-full' style={{ width: `${heading * 100}%` }} />
          {style.kind === 'tiles' ? (
            <div className='grid grid-cols-3 gap-2.5'>
              {Array.from({ length: 6 }, (_, i) => (
                <Tile key={i} />
              ))}
            </div>
          ) : (
            <div className={LIST_STYLES[style.list].className}>
              {Array.from({ length: COUNT[style.list] }, (_, i) => (
                <Item key={i} list={style.list} index={i} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

/** How many of each a category shows while it loads: about a screen's worth */
const COUNT: Record<MenuList, number> = { row: 3, card: 4, compact: 4, hero: 2 }

/** Not every name is as long: the lines vary, as a real menu's do */
const NAME = ['62%', '48%', '70%', '55%']
const NOTE = ['85%', '70%', '78%', '60%']

function Item({ list, index }: { list: MenuList; index: number }) {
  switch (list) {
    // The square photo, the name, a line of what it is, the price's pill, the round button
    case 'row':
      return (
        <div className='flex items-center gap-3'>
          <Skeleton className={cn('shrink-0 rounded-[20px]', SHORT ? 'size-18' : 'size-20')} />
          <div className='flex min-w-0 flex-1 flex-col'>
            <Skeleton className='h-4 rounded-full' style={{ width: NAME[index] }} />
            <Skeleton className='mt-1.5 h-2.5 rounded-full' style={{ width: NOTE[index] }} />
            <Skeleton className='mt-2 h-[22px] w-16 rounded-full' />
          </div>
          <Skeleton className='size-10 shrink-0 rounded-full' />
        </div>
      )
    // A big 4:5 photo, the name and the price's pill under it
    case 'card':
      return (
        <div className='flex min-w-0 flex-col gap-2'>
          <Skeleton className='aspect-[4/5] w-full rounded-[24px]' />
          <div className='flex flex-col gap-2 px-1'>
            <Skeleton className='h-3.5 rounded-full' style={{ width: NAME[index] }} />
            <Skeleton className='h-[22px] w-16 rounded-full' />
          </div>
        </div>
      )
    // The name and its price on one line, what it is under, the button
    case 'compact':
      return (
        <div className='flex items-center gap-3 py-3'>
          <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
            <div className='flex items-center justify-between gap-3'>
              <Skeleton className='h-3.5 rounded-full' style={{ width: NAME[index] }} />
              <Skeleton className='h-3.5 w-12 shrink-0 rounded-full' />
            </div>
            <Skeleton className='h-2.5 rounded-full' style={{ width: NOTE[index] }} />
          </div>
          <Skeleton className='size-11 shrink-0 rounded-full' />
        </div>
      )
    // The magazine's wide 16:11 photo
    case 'hero':
      return <Skeleton className='aspect-[16/11] w-full rounded-[28px]' />
  }
}

/** The small tile: a 4:5 photo, its name and price under it in captions */
function Tile() {
  return (
    <div className='flex min-w-0 flex-col'>
      <Skeleton className='aspect-[4/5] w-full rounded-[20px]' />
      <Skeleton className='mt-1.5 h-2.5 w-4/5 rounded-full' />
      <Skeleton className='mt-1.5 h-2.5 w-2/5 rounded-full' />
    </div>
  )
}
