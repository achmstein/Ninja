import { useAuth } from 'react-oidc-context'
import { useT } from '@/lib/i18n'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const t = useT()
  const auth = useAuth()

  const handleSignOut = () => {
    // Ends the Keycloak session and redirects back to the app afterwards
    auth.signoutRedirect()
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('signOut')}
      desc={t('signOutConfirmation')}
      confirmText={t('signOut')}
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
