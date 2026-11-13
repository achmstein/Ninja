import { useState } from 'react'
import { MapPinned, X } from 'lucide-react'
import type { StaffDeliveryZone } from '@/api/ordering/types.gen'
import { Input } from '@/components/ui/input'
import { useBranchName } from '@/features/branch/use-branch-name'
import type { SaleZone } from '@/features/sale/cart'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { matchAreas } from './area-match'

/**
 * The area the caller says they live in, found by name among the named areas
 * the branches deliver to: typed in either language, a few shown as it is
 * typed, each with what delivering there costs and about how long it takes.
 * One switched off for a while (or whose branch paused) says so and takes a
 * second tap, as a paused branch does. Once picked it stands in the box with
 * a cross to take it off. Arrows and Enter pick, Escape closes the list.
 */
export function AreaPicker({
  id,
  zones,
  value,
  onPick,
  onClear,
}: {
  id: string
  zones: readonly StaffDeliveryZone[]
  /** The area picked, shown in the box; null to search */
  value: SaleZone | null
  onPick: (zone: StaffDeliveryZone) => void
  onClear: () => void
}) {
  const t = useT()
  const money = useMoney()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const branchName = useBranchName()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [armed, setArmed] = useState<number | null>(null)

  if (value) {
    return (
      <div className='border-primary bg-primary/5 flex h-12 items-center gap-2 rounded-md border ps-3 pe-1 text-base'>
        <MapPinned className='text-muted-foreground size-4 shrink-0' aria-hidden />
        <span className='min-w-0 flex-1 truncate font-medium'>
          <bdi>{localized(value.name)}</bdi>
        </span>
        <button
          type='button'
          id={id}
          aria-label={t('deliveryAreaClear')}
          className='text-muted-foreground hover:text-foreground hover:bg-muted flex size-10 shrink-0 items-center justify-center rounded-md'
          onClick={() => {
            setText('')
            setArmed(null)
            onClear()
          }}
        >
          <X className='size-4' aria-hidden />
        </button>
      </div>
    )
  }

  const found = matchAreas(zones, text, language)
  const severalBranches = new Set(zones.map((z) => toNumber(z.branchId))).size > 1
  const at = Math.min(active, Math.max(found.length - 1, 0))
  const listId = `${id}-areas`

  const pick = (zone: StaffDeliveryZone) => {
    const zoneId = toNumber(zone.zoneId)
    // Switched off for a while, or its branch stopped its customers' orders: asked once more
    if ((!zone.on || zone.branchPaused) && armed !== zoneId) {
      setArmed(zoneId)
      return
    }
    setArmed(null)
    setText('')
    setOpen(false)
    onPick(zone)
  }

  return (
    <div
      className='flex flex-col gap-1'
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      <Input
        id={id}
        role='combobox'
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete='list'
        aria-activedescendant={open && found.length > 0 ? `${listId}-${toNumber(found[at].zoneId)}` : undefined}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setActive(0)
          setArmed(null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) return setOpen(true)
            if (found.length === 0) return
            setArmed(null)
            setActive((at + (e.key === 'ArrowDown' ? 1 : found.length - 1)) % found.length)
          } else if (e.key === 'Enter') {
            // Never the form's own Enter: it picks the area shown, or nothing
            e.preventDefault()
            if (open && found.length > 0) pick(found[at])
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
            setArmed(null)
          }
        }}
        placeholder={t('deliveryAreaSearch')}
        className='h-12 text-base'
        maxLength={100}
        autoComplete='off'
      />
      {open &&
        (found.length === 0 ? (
          <p className='text-muted-foreground px-1 text-sm' role='status'>
            {t('deliveryAreaNone')}
          </p>
        ) : (
          <ul id={listId} className='flex flex-col rounded-md border' role='listbox' aria-label={t('deliveryAreaLabel')}>
            {found.map((zone, index) => {
              const zoneId = toNumber(zone.zoneId)
              const fee = toNumber(zone.fee)
              const off = !zone.on
              return (
                <li key={zoneId} role='presentation'>
                  <button
                    type='button'
                    id={`${listId}-${zoneId}`}
                    role='option'
                    aria-selected={index === at}
                    tabIndex={-1}
                    // The box keeps the focus, so the list stays open under the tap
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => pick(zone)}
                    className={cn('flex min-h-12 w-full items-center gap-2 px-3 py-2 text-start', index === at && 'bg-muted')}
                  >
                    <MapPinned className='text-muted-foreground size-4 shrink-0' aria-hidden />
                    <span className='min-w-0 flex-1'>
                      <bdi className='font-medium'>{localized(zone.name)}</bdi>
                      <span className='text-muted-foreground text-sm'>
                        {severalBranches && (
                          <>
                            {' · '}
                            <bdi>{branchName(toNumber(zone.branchId))}</bdi>
                          </>
                        )}
                        {' · '}
                        {fee > 0 ? t('callCentreFeeIs', { fee: money(fee) }) : t('deliveryFree')}
                        {zone.etaMinutes != null && <> · {t('deliveryAboutMinutes', { minutes: toNumber(zone.etaMinutes) })}</>}
                      </span>
                      {off && (
                        <span className='ms-1.5 text-sm font-medium text-amber-700 dark:text-amber-400'>
                          · {armed === zoneId ? t('deliveryAreaOffTapAgain') : t('deliveryAreaOff')}
                        </span>
                      )}
                      {zone.branchPaused && (
                        <span className='ms-1.5 text-sm font-medium text-amber-700 dark:text-amber-400'>
                          · {armed === zoneId && !off ? t('callCentreTapAgainPaused') : t('deliveryBranchPaused')}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ))}
    </div>
  )
}
