import { useState } from 'react'
import { X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useInstallPrompt } from '@/lib/use-install-prompt'
import { Button } from '@/components/ui/button'
import { InstallDialog } from './install-dialog'

const DISMISSED_KEY = 'chillax-install-dismissed'

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

/** Home-page nudge to install the PWA. Android gets the native prompt, iOS
 *  the share-sheet walkthrough. Never shown once installed, and "Not now"
 *  sticks on this browser. */
export function InstallBanner() {
  const t = useT()
  const { canInstall, install, isStandalone, isIos } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [howOpen, setHowOpen] = useState(false)

  // TEMPORARY (revert after review): always render the banner on prod so its
  // look can be reviewed. Real guard:
  // if (isStandalone || dismissed || !(canInstall || isIos)) return null
  void isStandalone
  void dismissed
  void isIos

  const onInstall = () => {
    if (canInstall) void install()
    else setHowOpen(true)
  }

  const dismiss = () => {
    writeDismissed()
    setDismissed(true)
  }

  return (
    <>
      {/* Compact strip; the traveling border beam is the eye-catch (no icon —
          the app mark already sits in the top bar). */}
      <div className='border-beam bg-card relative flex items-center gap-2.5 rounded-[10px] border px-3 py-2 shadow-sm'>
        <p className='font-display-ar text-primary min-w-0 flex-1 text-lg leading-tight'>
          {t('installAppTitle')}
        </p>
        <Button size='sm' className='h-8 shrink-0' onClick={onInstall}>
          {canInstall ? t('install') : t('howTo')}
        </Button>
        <button
          type='button'
          onClick={dismiss}
          aria-label={t('notNow')}
          className='text-muted-foreground hover:text-foreground shrink-0'
        >
          <X className='size-4' />
        </button>
      </div>
      <InstallDialog open={howOpen} onOpenChange={setHowOpen} />
    </>
  )
}
