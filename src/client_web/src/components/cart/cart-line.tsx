import { useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { lineKey, useCart, type CartLine } from '@/lib/cart'
import { useLanguage, usePrice, useT } from '@/lib/i18n'
import { spring, springSoft } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { Odometer } from '@/components/ninja/odometer'
import { swipeRemoves } from '@/components/ninja/tray-model'

/**
 * One line of the order as a card of its own, the way the tray shows it:
 * its photo, what was chosen, a price that rolls with the count, and a
 * stepper. Swiped far enough either way (or flicked) it goes, with
 * the toast to put it back; stepping the last one down does the same.
 */
export function CartLineCard({ line }: { line: CartLine }) {
  const t = useT()
  const price = usePrice()
  const reduced = useReducedMotion()
  const language = useLanguage((s) => s.language)
  const setQuantity = useCart((s) => s.setQuantity)
  const add = useCart((s) => s.add)
  const x = useMotionValue(0)
  // The red under a card only shows once it moves, so no edge of it leaks round the corners
  const warn = useTransform(x, (v) => Math.min(1, Math.abs(v) / 48))
  const card = useRef<HTMLDivElement>(null)
  const [leaving, setLeaving] = useState(false)
  const key = lineKey(line)
  const name = language === 'ar' && line.nameAr ? line.nameAr : line.nameEn
  const options = line.customizations
    .map((c) => (language === 'ar' && c.optionNameAr ? c.optionNameAr : c.optionNameEn))
    .join(' · ')

  const remove = (direction: number) => {
    setLeaving(true)
    const done = () => {
      setQuantity(key, 0)
      // Gone with a flick is easy to regret: the toast puts it back
      toast.info(t('ninjaRemoved', { name }), { action: { label: t('ninjaUndo'), onClick: () => add(line) }, duration: 5000 })
    }
    if (reduced) return done()
    const width = card.current?.offsetWidth ?? 320
    void animate(x, direction * width, { duration: 0.18, ease: 'easeIn' }).then(done)
  }

  return (
    <motion.div
      layout='position'
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={springSoft}
      className='relative'
    >
      <motion.div aria-hidden style={{ opacity: warn }} className='bg-destructive absolute inset-0 flex rounded-[1.25rem] items-center justify-between px-5 text-white'>
        <Trash2 className='size-5' />
        <Trash2 className='size-5' />
      </motion.div>
      <motion.div
        ref={card}
        style={{ x }}
        drag={leaving ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          const width = card.current?.offsetWidth ?? 0
          if (swipeRemoves(info.offset.x, width, info.velocity.x)) remove(Math.sign(info.offset.x || info.velocity.x) || 1)
        }}
        className='surface relative flex touch-pan-y items-center gap-3 rounded-[1.25rem] p-2.5 pe-3'
      >
        <span className='bg-muted grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl text-lg font-bold'>
          {line.pictureUrl ? <img src={line.pictureUrl} alt='' className='size-full object-cover' draggable={false} /> : name.charAt(0)}
        </span>
        <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <span className='truncate text-[15px] font-semibold'>{name}</span>
          {options && <span className='text-muted-foreground truncate text-xs'>{options}</span>}
          {line.specialInstructions && <span className='text-muted-foreground truncate text-xs italic'>"{line.specialInstructions}"</span>}
          <Odometer value={price(line.price * line.quantity)} className='text-[15px] font-bold' />
        </span>
        <span className='bg-muted flex shrink-0 items-center rounded-full p-1'>
          <motion.button
            type='button'
            whileTap={reduced ? undefined : { scale: 0.85 }}
            transition={spring}
            aria-label={line.quantity === 1 ? t('ninjaRemove') : t('ninjaLess')}
            onClick={() => (line.quantity === 1 ? remove(-1) : setQuantity(key, line.quantity - 1))}
            className='grid size-8 place-items-center rounded-full'
          >
            {line.quantity === 1 ? <Trash2 className='size-3.5' /> : <Minus className='size-3.5' />}
          </motion.button>
          <Odometer value={String(line.quantity)} className='w-6 text-center text-[15px] font-bold' />
          <motion.button
            type='button'
            whileTap={reduced ? undefined : { scale: 0.85 }}
            transition={spring}
            aria-label={t('ninjaMore')}
            onClick={() => setQuantity(key, line.quantity + 1)}
            className='grid size-8 place-items-center rounded-full'
          >
            <Plus className='size-3.5' />
          </motion.button>
        </span>
      </motion.div>
    </motion.div>
  )
}
