import { useT } from '@/lib/i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** First and last name side by side, as the phone app and the sign-up page ask for them */
export function NameFields({
  idPrefix,
  first,
  last,
  onFirst,
  onLast,
}: {
  idPrefix: string
  first: string
  last: string
  onFirst: (value: string) => void
  onLast: (value: string) => void
}) {
  const t = useT()
  return (
    <div className='grid grid-cols-2 gap-3'>
      <div className='space-y-2'>
        <Label htmlFor={`${idPrefix}First`}>{t('firstName')}</Label>
        <Input id={`${idPrefix}First`} autoComplete='given-name' value={first} onChange={(e) => onFirst(e.target.value)} />
      </div>
      <div className='space-y-2'>
        <Label htmlFor={`${idPrefix}Last`}>{t('lastName')}</Label>
        <Input id={`${idPrefix}Last`} autoComplete='family-name' value={last} onChange={(e) => onLast(e.target.value)} />
      </div>
    </div>
  )
}
