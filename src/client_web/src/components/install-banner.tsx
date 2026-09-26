import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, X } from 'lucide-react'
import { preview } from '@/lib/preview'
import { useT } from '@/lib/i18n'
import { blurSwap, duration, ease, fade, springSoft } from '@/lib/motion'
import { useInstallPrompt } from '@/lib/use-install-prompt'
import { Button } from '@/components/ui/button'
import { IosInstallSteps } from './install-dialog'
import { useBrand, useBrandName } from '@/lib/brand'

const DISMISSED_KEY = 'ninja-install-dismissed'

/** Lets the page settle before the card arrives, so it never lands with the first paint. */
const ENTER_DELAY_MS = 1200

/** How long "Installed" stays before the card folds away. */
const INSTALLED_MS = 1400

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // Storage blocked: the banner simply comes back next visit
  }
}

type Phase = 'offer' | 'steps' | 'installed'

/**
 * Home-page nudge to install the PWA: the café's own app icon, the name and
 * one line on why. Android gets the native prompt and the card turns into
 * "Installed" before folding away; on iOS the card opens in place into
 * Safari's two steps. Never shown once installed, and "Not now" sticks on
 * this browser. It arrives a moment after the page, and leaves by folding
 * shut so the page below closes the gap.
 */
export function InstallBanner() {
  const t = useT()
  const brand = useBrand()
  const brandName = useBrandName()
  const reduced = useReducedMotion()
  const { canInstall, install, isStandalone, isIos } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [arrived, setArrived] = useState(false)
  const [phase, setPhase] = useState<Phase>('offer')
  const [gone, setGone] = useState(false)

  // Nothing to install from inside the control panel's preview frame
  const eligible = !preview.active && !isStandalone && !dismissed && (canInstall || isIos || phase === 'installed')

  useEffect(() => {
    if (!eligible) return
    const timer = setTimeout(() => setArrived(true), ENTER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [eligible])

  useEffect(() => {
    if (phase !== 'installed') return
    const timer = setTimeout(() => setGone(true), INSTALLED_MS)
    return () => clearTimeout(timer)
  }, [phase])

  const onInstall = async () => {
    if (!canInstall) {
      setPhase('steps')
      return
    }
    if ((await install()) === 'accepted') setPhase('installed')
  }

  const dismiss = () => {
    writeDismissed()
    setDismissed(true)
  }

  const show = eligible && arrived && !gone
  const swap = blurSwap(reduced)
  const icon = brand?.icons.appleTouch

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key='install'
          // Folds shut on the way out, so what sits below slides up into its place
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', height: 'auto' }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.98, filter: 'blur(4px)' }}
          transition={reduced ? fade : { ...springSoft, opacity: { duration: duration.base, ease: ease.enter } }}
          className='overflow-hidden'
        >
          <motion.section
            layout={!reduced}
            transition={springSoft}
            className='bg-card rounded-2xl border p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.18)]'
            style={{ borderRadius: 16 }}
          >
            <motion.div layout='position' className='flex items-center gap-3'>
              {/* The icon they will find on their home screen */}
              {icon ? (
                <img src={icon} alt='' className='size-11 shrink-0 rounded-[11px] object-cover shadow-sm' />
              ) : (
                <div className='bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-[11px] text-lg font-semibold'>
                  {brandName.slice(0, 1)}
                </div>
              )}

              <div className='min-w-0 flex-1'>
                <AnimatePresence mode='popLayout' initial={false}>
                  {phase === 'installed' ? (
                    <motion.p key='done' {...swap} className='flex items-center gap-1.5 text-[15px] font-semibold tracking-tight'>
                      <span className='flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white'>
                        <Check className='size-3.5' strokeWidth={3} />
                      </span>
                      {t('installed')}
                    </motion.p>
                  ) : (
                    <motion.div key='offer' {...swap}>
                      <p className='truncate text-[15px] leading-tight font-semibold tracking-tight'>
                        {t('installAppTitle', { name: brandName })}
                      </p>
                      <p className='text-muted-foreground mt-0.5 truncate text-xs'>{t('installAppSubtitle')}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {phase === 'offer' && (
                <Button size='sm' className='h-8 shrink-0 rounded-full px-4' onClick={() => void onInstall()}>
                  {canInstall ? t('install') : t('howTo')}
                </Button>
              )}
              {phase !== 'installed' && (
                <button
                  type='button'
                  onClick={dismiss}
                  aria-label={t('notNow')}
                  className='text-muted-foreground hover:text-foreground hover:bg-muted flex size-7 shrink-0 items-center justify-center rounded-full transition-colors'
                >
                  <X className='size-4' />
                </button>
              )}
            </motion.div>

            {/* iOS: the card opens into Safari's steps instead of a dialog */}
            <AnimatePresence initial={false}>
              {phase === 'steps' && (
                <motion.div
                  key='steps'
                  initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, height: 'auto', filter: 'blur(0px)' }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0, filter: 'blur(4px)' }}
                  transition={reduced ? fade : springSoft}
                  className='overflow-hidden'
                >
                  <div className='flex flex-col gap-3 pt-4 ps-1'>
                    <IosInstallSteps />
                    <Button variant='secondary' size='sm' className='h-8 self-end rounded-full px-4' onClick={() => setPhase('offer')}>
                      {t('gotIt')}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
