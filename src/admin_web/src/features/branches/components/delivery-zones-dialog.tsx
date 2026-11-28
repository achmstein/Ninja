import { lazy, Suspense, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ChevronDown, MapPinned, PenLine, Plus, Trash2 } from 'lucide-react'
import { type BranchResponse, type DeliveryZoneResponse } from '@ninja/api/tenant'
import { useCurrencyLabel } from '@/lib/currency'
import { useLocalized, useT } from '@/lib/i18n'
import { areaOf, type DeliveryArea, type LatLng } from '@/lib/maps'
import { formatEgp } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/error-state'
import { Field, FieldGrid } from '@/components/field'
import { isBlank, LocalizedFields, LocalizedInput, toLocalizedValue } from '@/components/localized-input'
import { setDeliveryZonesMutation } from '../api/mutations'
import { getDeliveryZonesOptions } from '../api/queries'
import {
  MAX_ZONES,
  parseDeliveryZones,
  type ZoneErrors,
  type ZoneInput,
  type ZoneShapeProblem,
} from '../delivery-zones'
import { Waiting } from './branch-map'

/** The map an area is drawn on, with terra-draw and the map library, in a chunk of its own */
const DeliveryAreaMap = lazy(() => import('./delivery-area-map'))

const NAME_PROBLEM_TEXT = {
  required: 'nameIsRequired',
  tooLong: 'deliveryZoneNameTooLong',
  duplicate: 'deliveryZoneNameDuplicate',
} as const

const SHAPE_PROBLEM_TEXT = {
  tooFew: 'deliveryAreaTooFew',
  tooMany: 'deliveryAreaTooMany',
  crosses: 'deliveryAreaCrosses',
  tooFar: 'deliveryAreaTooFar',
  needsLocation: 'deliveryAreaNeedsLocation',
} as const satisfies Record<ZoneShapeProblem, string>

/** A row of the list: the area as typed, and a key that follows it as it moves */
type Row = ZoneInput & { key: string }

interface DeliveryZonesDialogProps {
  branch: BranchResponse | null
  onOpenChange: (open: boolean) => void
}

const asText = (value: number | string | null | undefined) => (value == null ? '' : String(Number(value)))

const rowOf = (zone: DeliveryZoneResponse): Row => ({
  key: `saved-${zone.id}`,
  id: Number(zone.id),
  name: toLocalizedValue(zone.name),
  // A fee of nothing reads as the empty field its placeholder fills
  fee: Number(zone.fee) === 0 ? '' : asText(zone.fee),
  minimum: asText(zone.minimumOrder),
  minutes: asText(zone.etaMinutes),
  isOn: zone.isOn,
  shape: areaOf(zone.shape),
})

/**
 * A branch's named delivery areas, the way people here say where they live:
 * each with its own fee, and when the owner wants them a minimum order, about
 * how many minutes it takes, a switch to stop delivering there for a while and
 * its shape on the map. The list is saved whole, in its order: where two drawn
 * shapes overlap, the earlier one decides. Everywhere else the branch's own
 * reach and fee hold.
 */
export function DeliveryZonesDialog({ branch, onOpenChange }: DeliveryZonesDialogProps) {
  const t = useT()
  const branchId = Number(branch?.id ?? 0)
  const zonesQuery = useQuery({
    ...getDeliveryZonesOptions({ path: { branchId } }),
    enabled: branch != null,
  })

  return (
    <Dialog open={branch != null} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[92dvh] flex-col sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <MapPinned className='h-5 w-5' />
            {t('deliveryZonesTitle')}
          </DialogTitle>
          <DialogDescription>{t('deliveryZonesHint')}</DialogDescription>
        </DialogHeader>
        {branch &&
          (zonesQuery.isError ? (
            <ErrorState size='section' error={zonesQuery.error} onRetry={zonesQuery.refetch} />
          ) : zonesQuery.data ? (
            <ZonesForm
              key={String(branch.id)}
              branch={branch}
              saved={zonesQuery.data}
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <div className='space-y-2 py-2'>
              <Skeleton className='h-14' />
              <Skeleton className='h-14' />
            </div>
          ))}
      </DialogContent>
    </Dialog>
  )
}

function ZonesForm({
  branch,
  saved,
  onClose,
}: {
  branch: BranchResponse
  /** The list as it was when the dialog opened; what is typed after is the form's own */
  saved: DeliveryZoneResponse[]
  onClose: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<Row[]>(() => saved.map(rowOf))
  // One area is open at a time, so the list stays a list on a phone
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [addedKey, setAddedKey] = useState<string | null>(null)
  const [drawingKey, setDrawingKey] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Row | null>(null)
  const [tried, setTried] = useState(false)
  // Why the server would not keep the list, in its own words
  const [refusal, setRefusal] = useState('')
  const added = useRef(0)

  const centre: LatLng | null =
    branch.latitude != null && branch.longitude != null
      ? { lat: Number(branch.latitude), lng: Number(branch.longitude) }
      : null
  // The branch's own distance, faintly on the map, unless its own drawn area decides instead
  const radiusKm = (branch.deliveryArea?.length ?? 0) >= 3 ? 0 : Number(branch.deliveryRadiusKm ?? 0)

  const parsed = parseDeliveryZones(rows, centre)
  const errors: ZoneErrors[] = tried && !parsed.ok ? parsed.errors : []
  const tooMany = rows.length > MAX_ZONES

  const save = useMutation({
    ...setDeliveryZonesMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getDeliveryZones' }] })
      toast.success(t('deliveryZonesSaved'))
      onClose()
    },
    onError: (error) => {
      const detail =
        error.response?.status === 400 ? (error.response.data as { detail?: string } | undefined)?.detail : undefined
      if (detail) setRefusal(detail)
      else toast.error(t('deliveryZonesSaveFailed'))
    },
  })

  const open = (key: string | null) => {
    setOpenKey(key)
    setDrawingKey(null)
  }

  const change = (key: string, next: Partial<ZoneInput>) => {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...next } : r)))
    setRefusal('')
  }

  const add = () => {
    added.current += 1
    const key = `new-${added.current}`
    setRows((list) => [
      ...list,
      {
        key,
        id: null,
        name: { en: '', ar: '' },
        fee: '',
        minimum: '',
        minutes: '',
        isOn: true,
        shape: null,
      },
    ])
    setAddedKey(key)
    open(key)
  }

  const move = (index: number, by: -1 | 1) => {
    setRows((list) => {
      const next = [...list]
      const [moved] = next.splice(index, 1)
      next.splice(index + by, 0, moved)
      return next
    })
    setRefusal('')
  }

  const remove = (row: Row) => {
    setRows((list) => list.filter((r) => r.key !== row.key))
    if (openKey === row.key) open(null)
    setRemoving(null)
    setRefusal('')
  }

  // An area just added and still empty has nothing to lose: it goes without asking
  const askRemove = (row: Row) => (row.id == null && isBlank(row.name) && !row.shape ? remove(row) : setRemoving(row))

  const submit = () => {
    setTried(true)
    setRefusal('')
    if (!parsed.ok) {
      const wrong = parsed.errors.findIndex((e) => Object.keys(e).length > 0)
      if (wrong >= 0) open(rows[wrong].key)
      return
    }
    save.mutate({ path: { branchId: Number(branch.id) }, body: parsed.value })
  }

  return (
    <LocalizedFields>
      <div className='-mx-6 min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-1'>
        {rows.length === 0 ? (
          <p className='text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm'>
            {t('deliveryZonesEmpty')}
          </p>
        ) : (
          <ul className='divide-border/60 divide-y rounded-xl border'>
            {rows.map((row, index) => (
              <ZoneRow
                key={row.key}
                row={row}
                index={index}
                count={rows.length}
                open={openKey === row.key}
                drawing={drawingKey === row.key}
                focusName={addedKey === row.key}
                errors={errors[index] ?? {}}
                centre={centre}
                radiusKm={radiusKm}
                onToggle={() => open(openKey === row.key ? null : row.key)}
                onChange={(next) => change(row.key, next)}
                onDraw={() => setDrawingKey(row.key)}
                onMove={(by) => move(index, by)}
                onRemove={() => askRemove(row)}
              />
            ))}
          </ul>
        )}
        <Button type='button' variant='outline' size='sm' disabled={rows.length >= MAX_ZONES} onClick={add}>
          <Plus />
          {t('deliveryZoneAdd')}
        </Button>
        {(tooMany || refusal) && (
          <p role='alert' className='text-destructive text-sm'>
            {refusal || t('deliveryZonesTooMany')}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type='button' variant='outline' onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Spinner />}
          {t('save')}
        </Button>
      </DialogFooter>

      <ConfirmDialog
        open={removing != null}
        onOpenChange={(o) => {
          if (!o) setRemoving(null)
        }}
        title={t('deliveryZoneRemoveConfirm', {
          name: removing ? localized(removing.name) || t('deliveryZoneNew') : '',
        })}
        desc={t('deliveryZoneRemoveHint')}
        confirmText={t('remove')}
        destructive
        handleConfirm={() => removing && remove(removing)}
      />
    </LocalizedFields>
  )
}

/**
 * One area: closed, its name and what it asks on one line with its switch;
 * open, its fields, its shape on the map, and where it sits in the list.
 */
function ZoneRow({
  row,
  index,
  count,
  open,
  drawing,
  focusName,
  errors,
  centre,
  radiusKm,
  onToggle,
  onChange,
  onDraw,
  onMove,
  onRemove,
}: {
  row: Row
  index: number
  count: number
  open: boolean
  drawing: boolean
  /** Just added: its name takes the cursor */
  focusName: boolean
  errors: ZoneErrors
  centre: LatLng | null
  radiusKm: number
  onToggle: () => void
  onChange: (next: Partial<ZoneInput>) => void
  onDraw: () => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const currency = useCurrencyLabel()
  const id = `zone-${row.key}`
  const name = localized(row.name).trim()
  const wrong = Object.keys(errors).length > 0

  const number = (text: string) => {
    const value = Number(text.trim().replace(',', '.'))
    return text.trim() !== '' && Number.isFinite(value) ? value : null
  }
  const fee = number(row.fee) ?? 0
  const minimum = number(row.minimum)
  const minutes = number(row.minutes)
  const summary = [
    row.isOn ? null : t('deliveryZonePaused'),
    fee > 0 ? formatEgp(fee) : t('deliveryFree'),
    minimum != null && minimum > 0 ? t('deliveryMinimumShort', { amount: formatEgp(minimum) }) : null,
    minutes != null ? t('minutesShort', { count: minutes }) : null,
    row.shape ? t('onTheMap') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li>
      <div className='flex items-center gap-3 px-3.5 py-3'>
        <button
          type='button'
          aria-expanded={open}
          aria-controls={`${id}-fields`}
          onClick={onToggle}
          className='flex min-w-0 flex-1 items-center gap-2.5 text-start'
        >
          <ChevronDown
            className={cn('text-muted-foreground size-4 shrink-0 transition-transform', open && 'rotate-180')}
          />
          <span className='min-w-0 flex-1'>
            <span className={cn('block truncate text-sm font-medium', (!name || !row.isOn) && 'text-muted-foreground')}>
              {name || t('deliveryZoneNew')}
            </span>
            <span className={cn('block truncate text-xs', wrong ? 'text-destructive' : 'text-muted-foreground')}>
              {wrong ? t('deliveryZoneNeedsFix') : summary}
            </span>
          </span>
        </button>
        <Switch
          checked={row.isOn}
          aria-label={t('deliveryZoneOn', {
            name: name || t('deliveryZoneNew'),
          })}
          onCheckedChange={(isOn) => onChange({ isOn })}
        />
      </div>

      {open && (
        <div id={`${id}-fields`} className='space-y-4 px-3.5 pt-1 pb-4'>
          <LocalizedInput
            id={`${id}-name`}
            label={t('deliveryZoneName')}
            value={row.name}
            onChange={(next) => onChange({ name: next })}
            autoFocus={focusName}
            error={errors.name ? t(NAME_PROBLEM_TEXT[errors.name]) : undefined}
          />
          <FieldGrid>
            <Field
              label={`${t('deliveryFee')} (${currency})`}
              htmlFor={`${id}-fee`}
              error={errors.fee ? t('deliveryAmountInvalid') : undefined}
            >
              <Input
                id={`${id}-fee`}
                type='number'
                inputMode='decimal'
                min={0}
                step='1'
                placeholder='0'
                value={row.fee}
                aria-invalid={errors.fee || undefined}
                onChange={(e) => onChange({ fee: e.target.value })}
              />
            </Field>
            <Field
              label={`${t('deliveryMinimumOrder')} (${currency})`}
              htmlFor={`${id}-minimum`}
              error={errors.minimum ? t('deliveryAmountInvalid') : undefined}
            >
              <Input
                id={`${id}-minimum`}
                type='number'
                inputMode='decimal'
                min={0}
                step='1'
                placeholder={t('deliveryZoneMinimumAsBranch')}
                value={row.minimum}
                aria-invalid={errors.minimum || undefined}
                onChange={(e) => onChange({ minimum: e.target.value })}
              />
            </Field>
            <Field
              label={t('deliveryZoneMinutes')}
              htmlFor={`${id}-minutes`}
              error={errors.minutes ? t('deliveryZoneMinutesInvalid') : undefined}
            >
              <Input
                id={`${id}-minutes`}
                type='number'
                inputMode='numeric'
                min={5}
                max={240}
                step='5'
                placeholder={t('optional')}
                value={row.minutes}
                aria-invalid={errors.minutes || undefined}
                onChange={(e) => onChange({ minutes: e.target.value })}
              />
            </Field>
          </FieldGrid>

          <ZoneShape
            row={row}
            drawing={drawing}
            problem={errors.shape}
            centre={centre}
            radiusKm={radiusKm}
            onDraw={onDraw}
            onChange={(shape) => onChange({ shape })}
          />

          <div className='flex items-center justify-between gap-2'>
            <div className='flex items-center'>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label={t('moveUp')}
                disabled={index === 0}
                onClick={() => onMove(-1)}
              >
                <ArrowUp className='h-4 w-4' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label={t('moveDown')}
                disabled={index === count - 1}
                onClick={() => onMove(1)}
              >
                <ArrowDown className='h-4 w-4' />
              </Button>
            </div>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-destructive hover:text-destructive'
              onClick={onRemove}
            >
              <Trash2 />
              {t('deliveryZoneRemove')}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

/** The area's shape: said in a line with a button to draw it, or the map it is drawn on */
function ZoneShape({
  row,
  drawing,
  problem,
  centre,
  radiusKm,
  onDraw,
  onChange,
}: {
  row: Row
  drawing: boolean
  problem: ZoneShapeProblem | undefined
  centre: LatLng | null
  radiusKm: number
  onDraw: () => void
  onChange: (shape: DeliveryArea | null) => void
}) {
  const t = useT()

  return (
    <div className='space-y-2'>
      {!centre ? (
        <p
          role={problem === 'needsLocation' ? 'alert' : undefined}
          className={cn('text-xs', problem === 'needsLocation' ? 'text-destructive' : 'text-muted-foreground')}
        >
          {t('deliveryAreaNeedsLocation')}
        </p>
      ) : drawing ? (
        <Suspense
          fallback={
            <div className='bg-muted relative h-64 rounded-lg border'>
              <Waiting />
            </div>
          }
        >
          <DeliveryAreaMap centre={centre} radiusKm={radiusKm} initial={row.shape} onChange={onChange} />
        </Suspense>
      ) : (
        <div className='flex flex-wrap items-center gap-2'>
          <Button type='button' variant='outline' size='sm' onClick={onDraw}>
            <PenLine />
            {row.shape ? t('deliveryZoneOnMapEdit') : t('deliveryZoneDraw')}
          </Button>
          {row.shape ? (
            <Button type='button' variant='ghost' size='sm' onClick={() => onChange(null)}>
              {t('deliveryZoneRemoveShape')}
            </Button>
          ) : (
            <p className='text-muted-foreground text-xs'>{t('deliveryZoneNotDrawn')}</p>
          )}
        </div>
      )}
      {/* A shape kept from before the branch lost its place on the map can still be taken off */}
      {!centre && row.shape && (
        <Button type='button' variant='ghost' size='sm' onClick={() => onChange(null)}>
          {t('deliveryZoneRemoveShape')}
        </Button>
      )}
      {problem && problem !== 'needsLocation' && (
        <p role='alert' className='text-destructive text-sm'>
          {t(SHAPE_PROBLEM_TEXT[problem])}
        </p>
      )}
    </div>
  )
}
