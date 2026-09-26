import { useState, type ReactNode } from 'react'
import { useCanGoBack, useNavigate, useRouter, type LinkProps } from '@tanstack/react-router'
import { motion, MotionConfig, useMotionValueEvent, useScroll, useTransform } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { springSoft } from '@/lib/motion'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { NinjaTopBar } from '../ninja-top-bar'

/** How far the page scrolls before its large title has gone up into the bar, px */
const TITLE_FOLD = 44

/**
 * A page in the Ninja style. It keeps the slim see-through bar at the top
 * and opens on a large title, which shrinks and fades as the page scrolls
 * until the bar takes the title over. A tab page keeps the brand and the
 * place chips in its bar; a pushed page (`back`) has a way back instead,
 * to where it came from, or to `back` when it was opened fresh.
 */
export function NinjaPage({
  title,
  subtitle,
  action,
  back,
  className,
  children,
}: {
  title: string
  subtitle?: ReactNode
  /** Beside the large title, at its end */
  action?: ReactNode
  back?: LinkProps['to']
  className?: string
  children: ReactNode
}) {
  const { scrollY } = useScroll()
  const [folded, setFolded] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setFolded(y > TITLE_FOLD))
  const opacity = useTransform(scrollY, [0, TITLE_FOLD], [1, 0])
  const scale = useTransform(scrollY, [0, TITLE_FOLD], [1, 0.92])

  return (
    <MotionConfig reducedMotion='user'>
      <NinjaTopBar
        className='sticky top-[env(safe-area-inset-top)]'
        title={folded ? title : null}
        chips={!back}
        start={back ? <BackButton to={back} title={folded ? title : null} /> : undefined}
      />
      {/* A phone's column on a wide screen too: cards this size read as one hand's worth */}
      <div className={cn('mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-2 pb-6 md:pt-8', className)}>
        <motion.header style={{ opacity, scale }} className='flex origin-[0%_50%] items-end justify-between gap-3 rtl:origin-[100%_50%]'>
          <div className='min-w-0'>
            <h1 className='heading text-[calc(2rem*var(--heading-scale))] leading-[1.1]'>{title}</h1>
            {subtitle && <div className='text-muted-foreground mt-1 text-[15px]'>{subtitle}</div>}
          </div>
          {action && <div className='shrink-0'>{action}</div>}
        </motion.header>
        {children}
      </div>
    </MotionConfig>
  )
}

/** The way back from a pushed page: a round button, with the page's title beside it once the large one has gone. */
function BackButton({ to, title }: { to: LinkProps['to']; title: string | null }) {
  const t = useT()
  const navigate = useNavigate()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <>
      <button
        type='button'
        aria-label={t('back')}
        onClick={() => (canGoBack ? router.history.back() : navigate({ to }))}
        className='bg-muted/80 active:bg-muted -ms-1 grid size-10 shrink-0 place-items-center rounded-full transition-colors'
      >
        <ArrowLeft className='size-5 rtl:rotate-180' />
      </button>
      <motion.span
        className='heading truncate ps-1 text-[calc(1.05rem*var(--heading-scale))]'
        initial={false}
        animate={{ opacity: title ? 1 : 0, x: title ? 0 : -6 }}
        transition={springSoft}
        aria-hidden={!title}
      >
        {title}
      </motion.span>
    </>
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
