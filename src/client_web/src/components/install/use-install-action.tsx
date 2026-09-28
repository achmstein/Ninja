import { useState } from 'react'
import { preview } from '@/lib/preview'
import { useInstallPrompt } from '@/lib/use-install-prompt'
import { InstallDialog } from './install-dialog'

/**
 * Installing the app, where the phone can: the native prompt on Android and
 * desktop Chrome, Safari's two steps on an iPhone. Nothing where it is
 * already installed, or in the control panel's preview.
 */
export function useInstallAction() {
  const { canInstall, install, isStandalone, isIos } = useInstallPrompt()
  const [stepsOpen, setStepsOpen] = useState(false)
  const eligible = !preview.active && !isStandalone && (canInstall || isIos)
  const run = () => (canInstall ? void install() : setStepsOpen(true))
  const dialog = <InstallDialog open={stepsOpen} onOpenChange={setStepsOpen} />
  return { eligible, run, dialog }
}
