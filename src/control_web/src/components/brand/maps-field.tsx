import { useT } from '@/lib/i18n'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

/**
 * Whether the business uses Google Maps with the platform's keys: address
 * search when a customer or a cashier types a street, and Google's map in
 * its apps. Off by default, since every search is billed to Ninja; off, its
 * apps keep the free map and a pasted link, as they always had.
 * `available` false says the platform has no keys yet, so the switch waits.
 */
export function MapsField({
  id,
  checked,
  onChange,
  available = true,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  available?: boolean
}) {
  const t = useT()
  return (
    <div className='flex items-start justify-between gap-4'>
      <div className='grid gap-1'>
        <Label htmlFor={id}>{t('googleMaps')}</Label>
        <p className='text-muted-foreground text-xs'>{available ? t('googleMapsHint') : t('googleMapsNoKeys')}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
