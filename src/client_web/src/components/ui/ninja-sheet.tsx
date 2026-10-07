import * as React from 'react'
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react'
import { ease, springSoft } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useKeyboardInset } from '@/lib/use-keyboard-inset'
import { usePullDown } from '@/lib/use-pull-down'
import { DOCK_EDGES } from '@/components/ninja/shell/chrome'

/**
 * The one way the customer app shows a sheet, a dialog or a question: the
 * menu dock's dark slab, floating off the screen's edges at the dock's own
 * margins. It rises out of the dock on a spring, where the thumb already
 * is, and goes back down into it; one opened from the top bar drops from
 * the bar instead. It is pulled away by its handle, or from anywhere on it
 * while what is in it is scrolled to the top. Everything in it is set in
 * the dark scheme (the `dark` class), so any part used inside reads on it.
 *
 * Radix keeps the focus trap, the escape key and the labels; this only
 * owns the movement, which is why each root keeps its open state here
 * (SheetOpen) for the presence below to animate the way out as well.
 */

export type SheetFrom = 'bottom' | 'top'

// The dock's own slab and action, with the dark scheme's other roles mixed from its two inks, so a
// sheet is the dock's material on either page and in the business's colour, not the dark page's.
// Inline, as the business's colours reach .dark in a <style> no utility would win over
const mix = (ink: number) => `color-mix(in oklab, var(--dock-slab-ink) ${ink}%, var(--dock-slab))`
const SLAB_SCHEME = {
  '--background': 'var(--dock-slab)',
  '--foreground': 'var(--dock-slab-ink)',
  '--card': mix(6),
  '--card-foreground': 'var(--dock-slab-ink)',
  '--popover': mix(8),
  '--popover-foreground': 'var(--dock-slab-ink)',
  '--muted': mix(10),
  '--accent': mix(10),
  '--accent-foreground': 'var(--dock-slab-ink)',
  '--muted-foreground': mix(62),
  '--border': mix(14),
  '--input': mix(18),
  '--primary': 'var(--dock-primary)',
  '--primary-foreground': 'var(--dock-primary-foreground)',
} as React.CSSProperties

export const SheetOpen = React.createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => {},
})

/** A root's open state, controlled or not, shared with its content */
export function useSheetRoot(open: boolean | undefined, defaultOpen: boolean | undefined, onOpenChange: ((open: boolean) => void) | undefined) {
  const [own, setOwn] = React.useState(defaultOpen ?? false)
  const current = open ?? own
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (open === undefined) setOwn(next)
      onOpenChange?.(next)
    },
    [open, onOpenChange]
  )
  return { open: current, setOpen }
}

type PrimitiveParts = {
  // Radix's Portal, Overlay and Content of the same family (Dialog or AlertDialog)
  Portal: React.ComponentType<{ forceMount?: true; children?: React.ReactNode }>
  Overlay: React.ComponentType<{ forceMount?: true; asChild?: boolean; children?: React.ReactNode }>
  Content: React.ComponentType<Record<string, unknown> & { forceMount?: true; asChild?: boolean; children?: React.ReactNode }>
}

export function SheetFrame({
  parts: { Portal, Overlay, Content },
  from = 'bottom',
  className,
  style,
  children,
  contentProps,
}: {
  parts: PrimitiveParts
  from?: SheetFrom
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
  /** Passed through to Radix's Content (aria labels, event handlers) */
  contentProps?: Record<string, unknown>
}) {
  const { open, setOpen } = React.useContext(SheetOpen)
  const reduced = useReducedMotion()
  const drag = useDragControls()
  const body = React.useRef<HTMLDivElement>(null)
  // From anywhere on its body too, while that is scrolled to its top (lib/use-pull-down.ts)
  usePullDown(body, open && from === 'bottom' && !reduced, { onStart: (e) => drag.start(e) })
  // iOS never resizes the layout viewport for the keyboard, so a sheet held
  // to the bottom would sit behind it; lift it by however much is covered
  const keyboardInset = useKeyboardInset(open && from === 'bottom')
  const away = from === 'bottom' ? { y: 72, scale: 0.96, opacity: 0 } : { y: -32, scale: 0.96, opacity: 0 }

  return (
    <AnimatePresence>
      {open && (
        <Portal forceMount>
          <Overlay asChild forceMount>
            <motion.div
              className='fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.22 } }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            />
          </Overlay>
          <Content asChild forceMount {...contentProps}>
            <motion.div
              className={cn(
                'dark bg-background text-foreground fixed z-50 mx-auto flex flex-col overflow-hidden rounded-[1.75rem] shadow-[0_24px_60px_-16px_rgb(0_0_0/0.55)] outline-none',
                from === 'bottom' ? 'max-h-[88svh]' : 'top-[calc(env(safe-area-inset-top)+4.5rem)] max-h-[calc(100svh-6rem)]'
              )}
              style={{
                ...SLAB_SCHEME,
                // As wide as the dock it opens over
                ...DOCK_EDGES,
                ...(from === 'bottom' && { bottom: keyboardInset > 0 ? keyboardInset + 8 : 'max(8px, env(safe-area-inset-bottom))' }),
                ...(keyboardInset > 0 && { maxHeight: `calc(100svh - ${keyboardInset + 16}px)` }),
                originY: from === 'bottom' ? 1 : 0,
              }}
              initial={reduced ? { opacity: 0 } : away}
              animate={{ y: 0, scale: 1, opacity: 1, transition: springSoft }}
              exit={reduced ? { opacity: 0 } : { ...away, transition: { duration: 0.2, ease: ease.exit } }}
              drag={from === 'bottom' && !reduced ? 'y' : false}
              dragListener={false}
              dragControls={drag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.04, bottom: 0.7 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 96 || info.velocity.y > 600) setOpen(false)
              }}
            >
              {from === 'bottom' && (
                // The handle the sheet is pulled down by; the rest of it scrolls and types as usual
                <div className='flex h-7 shrink-0 cursor-grab touch-none items-center justify-center' onPointerDown={(e) => drag.start(e)}>
                  <span className='bg-foreground/25 h-1 w-10 rounded-full' />
                </div>
              )}
              <div
                ref={body}
                className={cn('flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5', from === 'top' && 'pt-5', className)}
                style={style}
              >
                {children}
              </div>
            </motion.div>
          </Content>
        </Portal>
      )}
    </AnimatePresence>
  )
}

/** The action row under a question: full-width pills, the action on top */
export const sheetFooterClass = 'flex flex-col-reverse gap-2 pt-1'
// A sheet's title is a headline: the page under it keeps the title size, and a sheet reads as part of it
export const sheetTitleClass = 'heading text-headline'
export const pillAction = 'bg-primary text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-full text-body font-bold transition-transform active:scale-[0.98] disabled:opacity-50 motion-reduce:transform-none'
export const pillCancel = 'bg-muted text-foreground flex h-12 w-full items-center justify-center gap-2 rounded-full text-body font-semibold transition-transform active:scale-[0.98] motion-reduce:transform-none'
