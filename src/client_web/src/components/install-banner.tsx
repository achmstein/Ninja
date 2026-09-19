import { useState } from 'react'
import { preview } from '@/lib/preview'
import { BorderBeam } from 'border-beam'
import { X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useInstallPrompt } from '@/lib/use-install-prompt'
import { Button } from '@/components/ui/button'
import { InstallDialog } from './install-dialog'
import { useBrandName } from '@/lib/brand'

const DISMISSED_KEY = 'ninja-install-dismissed'

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
  const brandName = useBrandName()
  const { canInstall, install, isStandalone, isIos } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [howOpen, setHowOpen] = useState(false)

  // Nothing to install from inside the control panel's preview frame
  if (preview.active || isStandalone || dismissed || !(canInstall || isIos)) return null

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
      {/* Compact strip wrapped in the border-beam effect (no icon — the app
          mark already sits in the top bar). */}
      <BorderBeam size='md' colorVariant='colorful' theme='auto' borderRadius={10}>
        <div className='bg-card flex items-center gap-2.5 rounded-[10px] border px-3 py-2'>
          <p className='font-display-ar text-primary min-w-0 flex-1 text-lg leading-tight'>
            {t('installAppTitle', { name: brandName })}
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
      </BorderBeam>
      <InstallDialog open={howOpen} onOpenChange={setHowOpen} />
    </>
  )
}
