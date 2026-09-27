import { useT } from '@/lib/i18n'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

/**
 * Whether the café's customers may sign in with Google and Apple: the
 * platform's own apps (the consent screen says Ninja), through the hub
 * realm, so nothing is set up per café. Off leaves email and phone.
 */
export function SocialField({ id, checked, onChange }: { id: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const t = useT()
  return (
    <div className='flex items-start justify-between gap-4'>
      <div className='grid gap-1'>
        <Label htmlFor={id}>{t('socialSignIn')}</Label>
        <p className='text-muted-foreground text-xs'>{t('socialSignInHint')}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
