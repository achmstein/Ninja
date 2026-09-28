import type { ReactNode } from 'react'
import { useCanGoBack, useNavigate, useRouter, type LinkProps } from '@tanstack/react-router'
import { AnimatePresence, motion, MotionConfig, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { blurSwap, springOpen, springSoft } from '@/lib/motion'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { NinjaTopBar } from '../shell/top-bar'
import { pushTitleId } from './push'

/** How far the page scrolls before its large title has faded away, px */
const TITLE_FOLD = 44

/**
 * A page in the Ninja style. Its slim bar is the top of the page and
 * scrolls away with it, leaving a small screen whole to what is under it;
 * then a large title, which shrinks and fades as the page scrolls. A tab
 * page keeps the brand and the place chips in its bar; a pushed page
 * (`back`) has a way back instead,
 * to where it came from, or to `back` when it was opened fresh. `push`: the
 * row it was opened from gave it its name, which travels into the title and
 * back (./push.ts).
 */
export function NinjaPage({
  title,
  subtitle,
  action,
  back,
  className,
  children,
  fade,
  push,
}: {
  title: string
  subtitle?: ReactNode
  /** Beside the large title, at its end */
  action?: ReactNode
  back?: LinkProps['to']
  className?: string
  children: ReactNode
  /** How far the large title stays shown (1) or goes (0) besides the scroll: a page's camera moving past it */
  fade?: MotionValue<number>
  push?: string
}) {
  const { scrollY } = useScroll()

  return (
    <MotionConfig reducedMotion='user'>
      <NinjaTopBar chips={!back} start={back ? <BackButton to={back} /> : undefined} />
      {/* A phone's column on a wide screen too: cards this size read as one hand's worth */}
      {/* pb-24: room for the dock's bill row, which sits above the tabs while a bill or an order is on */}
      <div className={cn('mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-(--page-top) pb-24', className)}>
        <PageTitle title={title} subtitle={subtitle} action={action} scrollY={scrollY} fade={fade} push={push} />
        {children}
      </div>
    </MotionConfig>
  )
}

/**
 * A page's large title (and the line under it), the first thing under the
 * top bar on every tab, the menu's too. It shrinks and fades as `scrollY`
 * (the scroller it sits in) runs past it.
 */
export function PageTitle({
  title,
  subtitle,
  action,
  scrollY,
  fade,
  push,
  className,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  scrollY: MotionValue<number>
  fade?: MotionValue<number>
  push?: string
  className?: string
}) {
  const unfaded = useMotionValue(1)
  const opacity = useTransform([scrollY, fade ?? unfaded], ([y, f]: number[]) => Math.max(0, 1 - y / TITLE_FOLD) * f)
  const scale = useTransform(scrollY, [0, TITLE_FOLD], [1, 0.92])
  const swap = blurSwap(useReducedMotion())
  return (
    <motion.header style={{ opacity, scale }} className={cn('flex origin-[0%_50%] items-end justify-between gap-3 rtl:origin-[100%_50%]', className)}>
      <div className='min-w-0'>
        {/* A new title swaps in with a short blur, the page itself staying put */}
        <h1 className='heading text-[calc(2rem*var(--heading-scale))] leading-[1.1]'>
          <motion.span layoutId={push ? pushTitleId(push) : undefined} transition={springOpen} className='inline-block max-w-full align-top'>
            <AnimatePresence mode='popLayout' initial={false}>
              <motion.span key={title} className='block' {...swap}>
                {title}
              </motion.span>
            </AnimatePresence>
          </motion.span>
        </h1>
        {subtitle && <div className='text-muted-foreground mt-1 text-[15px]'>{subtitle}</div>}
      </div>
      {action && <div className='shrink-0'>{action}</div>}
    </motion.header>
  )
}

/** The way back from a pushed page: a round button */
function BackButton({ to }: { to: LinkProps['to'] }) {
  const t = useT()
  const navigate = useNavigate()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <button
      type='button'
      aria-label={t('back')}
      onClick={() => (canGoBack ? router.history.back() : navigate({ to }))}
      className='bg-muted/80 active:bg-muted -ms-1 grid size-10 shrink-0 place-items-center rounded-full transition-colors'
    >
      <ArrowLeft className='size-5 rtl:rotate-180' />
    </button>
  )
}

/**
 * Blocks that rise into place one after another when the page opens, so a
 * page arrives the way the menu's cards do rather than all at once.
 */
export function Rise({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial='hidden'
      animate='shown'
      variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.045 } } }}
    >
      {children}
    </motion.div>
  )
}

/** One block of a Rise */
export function RiseItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 14 }, shown: { opacity: 1, y: 0, transition: springSoft } }}
    >
      {children}
    </motion.div>
  )
}
