import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, X } from 'lucide-react'
import { type PlaceViewModel, type TariffRequest } from '@/api/spaces'
import {
  createPlaceMutation,
  setPlaceReservableMutation,
  setPlaceTariffMutation,
  updatePlaceMutation,
} from '@/api/spaces/@tanstack/react-query.gen'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  fromLocalizedValue,
  LocalizedFields,
  LocalizedInput,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'
import { PLACE_ROOM, placeKindKey, placeKinds, tariffOptions } from '../status'
import { problemDetail } from '../use-places'
import { PlaceKindIcon } from './place-kind-icon'

const DEFAULT_ROUNDING = 15
const ROUNDING_CHOICES = [5, 10, 15, 30, 60]

type OptionDraft = {
  key: number
  /** Kept for a rate the place already has — stays and requests name it —
   *  and derived from the English name for a new one */
  code: string
  name: LocalizedValue
  rate: string
}

let nextKey = 1
const draft = (
  code: string,
  name: LocalizedValue,
  rate: number | string | undefined
): OptionDraft => ({
  key: nextKey++,
  code,
  name,
  rate: rate == null || Number(rate) === 0 ? '' : String(Number(rate)),
})

/** "Single Player" → "single-player": the code a new rate goes by. */
function codeFor(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The rates a new place starts with: a room gets the single/multi pair, a
 * table or station one standard rate. The prices come from the last place
 * of that kind that has them, so adding "Room 6" is just a name.
 */
function defaultOptions(kind: number, places: PlaceViewModel[]): OptionDraft[] {
  const rateOf = (code: string) =>
    [...places]
      .reverse()
      .flatMap((p) => tariffOptions(p.tariff))
      .find((o) => o.code === code)?.hourlyRate
  if (kind === PLACE_ROOM) {
    return [
      draft('single', { en: 'Single', ar: 'سنجل' }, rateOf('single')),
      draft('multi', { en: 'Multi', ar: 'مالتي' }, rateOf('multi')),
    ]
  }
  return [draft('standard', { en: 'Standard', ar: 'عادي' }, rateOf('standard'))]
}

function toTariff(
  options: OptionDraft[],
  rounding: number
): TariffRequest | null {
  const list = options.map((o) => ({
    code: o.code || codeFor(o.name.en),
    name: fromLocalizedValue(o.name),
    hourlyRate: Number(o.rate),
  }))
  const codes = new Set(list.map((o) => o.code))
  const valid =
    list.length > 0 &&
    codes.size === list.length &&
    list.every(
      (o) =>
        o.code.length > 0 &&
        o.name.en.length > 0 &&
        Number.isFinite(o.hourlyRate) &&
        o.hourlyRate > 0
    ) &&
    Number.isInteger(rounding) &&
    rounding >= 1
  if (!valid) return null
  return { options: list, roundingMinutes: rounding }
}

/** The tariff as the server would echo it, for a before/after compare. */
function tariffKey(tariff: TariffRequest | null): string {
  if (!tariff) return ''
  return JSON.stringify({
    rounding: Number(tariff.roundingMinutes),
    options: tariff.options.map((o) => [
      o.code,
      o.name.en ?? '',
      o.name.ar ?? '',
      Number(o.hourlyRate),
    ]),
  })
}

interface PlaceDialogProps {
  /** The place being edited, or null when adding a new one. */
  place: PlaceViewModel | null
  /** Every place of the branch, for the rates a new one starts with. */
  places: PlaceViewModel[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * One form for every kind of place, top to bottom in the order the admin
 * thinks: what it is, what it is called, and whether time is charged —
 * with the rates as a plain list of name and price, the code derived from
 * the name, and the rounding as a choice rather than a number. Mounted only
 * while open, so the fields always start from the current place without
 * syncing state in an effect. The kind is fixed once created.
 */
export function PlaceDialog({
  place,
  places,
  open,
  onOpenChange,
}: PlaceDialogProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const isEditing = place !== null

  const [kind, setKind] = useState<number>(() =>
    Number(place?.kind ?? PLACE_ROOM)
  )
  const [name, setName] = useState<LocalizedValue>(() =>
    toLocalizedValue(place?.name)
  )
  const [description, setDescription] = useState<LocalizedValue>(() =>
    toLocalizedValue(place?.description)
  )
  const [timed, setTimed] = useState(() =>
    place ? Boolean(place.isTimed) : kind === PLACE_ROOM
  )
  // Whether customers can book it: on by default with a clock, the
  // owner's call without one (a restaurant books tables, a café does not)
  const [reservable, setReservable] = useState(() =>
    place ? Boolean(place.reservable) : kind === PLACE_ROOM
  )
  const [reservableTouched, setReservableTouched] = useState(false)
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    place?.tariff
      ? tariffOptions(place.tariff).map((o) =>
          draft(o.code ?? '', toLocalizedValue(o.name), o.hourlyRate)
        )
      : defaultOptions(kind, places)
  )
  const [rounding, setRounding] = useState(() =>
    Number(place?.tariff?.roundingMinutes ?? DEFAULT_ROUNDING)
  )

  const create = useMutation(createPlaceMutation())
  const update = useMutation(updatePlaceMutation())
  const setTariff = useMutation(setPlaceTariffMutation())
  const setReservableFlag = useMutation(setPlaceReservableMutation())
  const isSaving =
    create.isPending ||
    update.isPending ||
    setTariff.isPending ||
    setReservableFlag.isPending

  const tariff = timed ? toTariff(options, rounding) : null
  const canSave = name.en.trim().length > 0 && (!timed || tariff !== null)

  const originalTariff = tariffKey(
    place?.tariff
      ? {
          options: tariffOptions(place.tariff).map((o) => ({
            code: o.code ?? '',
            name: fromLocalizedValue(toLocalizedValue(o.name)),
            hourlyRate: Number(o.hourlyRate ?? 0),
          })),
          roundingMinutes: Number(
            place.tariff.roundingMinutes ?? DEFAULT_ROUNDING
          ),
        }
      : null
  )
  const tariffChanged = tariffKey(tariff) !== originalTariff
  const reservableChanged = Boolean(place?.reservable) !== reservable

  const changeKind = (next: number) => {
    setKind(next)
    // A fresh kind gets its own starting rates unless the rates were touched
    if (options.every((o) => o.rate === '')) {
      setOptions(defaultOptions(next, places))
    }
    if (!timed && next === PLACE_ROOM) changeTimed(true)
  }

  // A clock brings bookings with it unless the owner already decided
  const changeTimed = (next: boolean) => {
    setTimed(next)
    if (next && !reservableTouched) setReservable(true)
  }

  const updateOption = (key: number, patch: Partial<OptionDraft>) =>
    setOptions((list) =>
      list.map((o) => (o.key === key ? { ...o, ...patch } : o))
    )

  // A rounding the place already has that is not one of the usual choices
  // stays offered, so editing never silently changes it
  const roundingChoices = ROUNDING_CHOICES.includes(rounding)
    ? ROUNDING_CHOICES
    : [...ROUNDING_CHOICES, rounding].sort((a, b) => a - b)

  const handleSave = async () => {
    const hasDescription = description.en.trim().length > 0
    const details = {
      name: fromLocalizedValue(name),
      description: hasDescription ? fromLocalizedValue(description) : null,
    }

    try {
      if (isEditing) {
        const id = Number(place.id)
        await update.mutateAsync({ path: { id }, body: details })
        // Only the tariff route knows about a running stay, so it is sent
        // apart and only when something about the rates changed; likewise
        // the reservable switch, which refuses while a reservation is open
        if (tariffChanged) {
          await setTariff.mutateAsync({ path: { id }, body: { tariff } })
        }
        if (reservableChanged) {
          await setReservableFlag.mutateAsync({
            path: { id },
            body: { reservable },
          })
        }
      } else {
        await create.mutateAsync({
          body: { kind, ...details, tariff, reservable },
        })
      }
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
      toast.success(t('placeSaved'))
      onOpenChange(false)
    } catch (error) {
      toast.error(problemDetail(error, t('failedToSavePlace')))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {isEditing && (
              <PlaceKindIcon
                kind={kind}
                className='text-muted-foreground size-5'
              />
            )}
            {t(isEditing ? 'editPlace' : 'newPlace')}
          </DialogTitle>
        </DialogHeader>

        {/* The rates list grows past a short laptop window; scroll the
            fields rather than pushing Save off screen */}
        <LocalizedFields>
          <div className='-mx-1 max-h-[65svh] space-y-5 overflow-y-auto px-1'>
            {/* The kind first: it decides what the rest of the form is */}
            <div className='space-y-4'>
              {!isEditing && (
                <div className='space-y-2'>
                  <Label>{t('kind')}</Label>
                  {/* The same segmented strip the dashboard and the stock
                      panel use, three equal segments wide */}
                  <ToggleGroup
                    type='single'
                    variant='outline'
                    value={String(kind)}
                    onValueChange={(value) =>
                      value && changeKind(Number(value))
                    }
                    className='w-full'
                    aria-label={t('kind')}
                  >
                    {placeKinds.map(({ kind: value }) => (
                      <ToggleGroupItem
                        key={value}
                        value={String(value)}
                        className='flex-1 px-3'
                      >
                        <PlaceKindIcon kind={value} className='size-4' />
                        {t(placeKindKey[value])}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              )}

              <LocalizedInput
                id='place-name'
                label={t('name')}
                value={name}
                onChange={setName}
                autoFocus={!isEditing}
              />

              <LocalizedInput
                id='place-description'
                label={t('description')}
                value={description}
                onChange={setDescription}
                multiline
                rows={2}
              />
            </div>

            {/* Time: off means the place only takes orders */}
            <div className='rounded-lg border'>
              <div className='flex items-center justify-between gap-4 px-3 py-2.5'>
                <Label htmlFor='place-timed' className='cursor-pointer'>
                  {t('chargedByTheHour')}
                </Label>
                <Switch
                  id='place-timed'
                  checked={timed}
                  onCheckedChange={changeTimed}
                />
              </div>

              {timed && (
                <div className='space-y-4 border-t px-3 py-3'>
                  <div className='space-y-2'>
                    {/* Column heads once, not a label per cell */}
                    <div className='text-muted-foreground grid grid-cols-[1fr_8rem_2rem] gap-2 px-0.5 text-xs'>
                      <span>{t('rateOptions')}</span>
                      <span>{t('hourlyRate')}</span>
                      <span />
                    </div>

                    {options.map((option) => (
                      <div
                        key={option.key}
                        className='grid grid-cols-[1fr_8rem_2rem] items-center gap-2'
                      >
                        <LocalizedInput
                          id={`option-name-${option.key}`}
                          ariaLabel={t('rateOptions')}
                          value={option.name}
                          onChange={(value) =>
                            updateOption(option.key, { name: value })
                          }
                          compact
                        />
                        <InputGroup className='h-8'>
                          <InputGroupInput
                            id={`option-rate-${option.key}`}
                            type='number'
                            inputMode='decimal'
                            min={0}
                            step='0.01'
                            value={option.rate}
                            aria-label={t('hourlyRate')}
                            onChange={(e) =>
                              updateOption(option.key, {
                                rate: e.target.value,
                              })
                            }
                            dir='ltr'
                          />
                          <InputGroupAddon align='inline-end'>
                            <InputGroupText>{t('perHour')}</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='size-8'
                          aria-label={t('remove')}
                          disabled={options.length <= 1}
                          onClick={() =>
                            setOptions((list) =>
                              list.filter((o) => o.key !== option.key)
                            )
                          }
                        >
                          <X className='h-4 w-4' />
                        </Button>
                      </div>
                    ))}

                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='-ms-2'
                      onClick={() =>
                        setOptions((list) => [
                          ...list,
                          draft('', { en: '', ar: '' }, undefined),
                        ])
                      }
                    >
                      <Plus className='me-1 h-4 w-4' />
                      {t('addRateOption')}
                    </Button>
                  </div>

                  <div className='flex items-center justify-between gap-4'>
                    <Label>{t('roundTimeTo')}</Label>
                    <ToggleGroup
                      type='single'
                      variant='outline'
                      size='sm'
                      value={String(rounding)}
                      onValueChange={(value) =>
                        value && setRounding(Number(value))
                      }
                    >
                      {roundingChoices.map((minutes) => (
                        <ToggleGroupItem
                          key={minutes}
                          value={String(minutes)}
                          className='px-2.5 tabular-nums'
                        >
                          {t('minutesShort', { count: minutes })}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                </div>
              )}
            </div>

            {/* Bookings: with a clock or without one */}
            <div className='flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5'>
              <div className='min-w-0'>
                <Label htmlFor='place-reservable' className='cursor-pointer'>
                  {t('takesReservations')}
                </Label>
                <p className='text-muted-foreground text-xs'>
                  {t('takesReservationsHint')}
                </p>
              </div>
              <Switch
                id='place-reservable'
                checked={reservable}
                onCheckedChange={(next) => {
                  setReservableTouched(true)
                  setReservable(next)
                }}
              />
            </div>
          </div>
        </LocalizedFields>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !canSave}>
            {isSaving && <Loader2 className='me-2 h-4 w-4 animate-spin' />}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
