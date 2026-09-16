import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, X } from 'lucide-react'
import { type PlaceViewModel, type TariffRequest } from '@/api/spaces'
import {
  createPlaceMutation,
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
import { Input } from '@/components/ui/input'
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

const DEFAULT_ROUNDING = 15

type OptionDraft = {
  key: number
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
  rounding: string
): TariffRequest | null {
  const list = options.map((o) => ({
    code: o.code.trim(),
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
    Number.isInteger(Number(rounding)) &&
    Number(rounding) >= 1
  if (!valid) return null
  return { options: list, roundingMinutes: Number(rounding) }
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
 * One form for every kind of place: what it is, what it is called, and —
 * with Timed on — the rates its clock runs at. Mounted only while open, so
 * the fields always start from the current place without syncing state in
 * an effect. The kind is fixed once created.
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
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    place?.tariff
      ? tariffOptions(place.tariff).map((o) =>
          draft(o.code ?? '', toLocalizedValue(o.name), o.hourlyRate)
        )
      : defaultOptions(kind, places)
  )
  const [rounding, setRounding] = useState(() =>
    String(Number(place?.tariff?.roundingMinutes ?? DEFAULT_ROUNDING))
  )

  const create = useMutation(createPlaceMutation())
  const update = useMutation(updatePlaceMutation())
  const setTariff = useMutation(setPlaceTariffMutation())
  const isSaving = create.isPending || update.isPending || setTariff.isPending

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

  const changeKind = (next: number) => {
    setKind(next)
    // A fresh kind gets its own starting rates unless the rates were touched
    if (options.every((o) => o.rate === '')) {
      setOptions(defaultOptions(next, places))
    }
    if (!timed && next === PLACE_ROOM) setTimed(true)
  }

  const updateOption = (key: number, patch: Partial<OptionDraft>) =>
    setOptions((list) =>
      list.map((o) => (o.key === key ? { ...o, ...patch } : o))
    )

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
        // apart and only when something about the rates changed
        if (tariffChanged) {
          await setTariff.mutateAsync({ path: { id }, body: { tariff } })
        }
      } else {
        await create.mutateAsync({ body: { kind, ...details, tariff } })
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
          <DialogTitle>{t(isEditing ? 'editPlace' : 'newPlace')}</DialogTitle>
        </DialogHeader>

        {/* The rates list grows past a short laptop window; scroll the
            fields rather than pushing Save off screen */}
        <LocalizedFields>
          <div className='max-h-[65svh] space-y-4 overflow-y-auto px-1'>
            <div className='space-y-2'>
              <Label>{t('kind')}</Label>
              <ToggleGroup
                type='single'
                variant='outline'
                size='sm'
                value={String(kind)}
                onValueChange={(value) => value && changeKind(Number(value))}
                disabled={isEditing}
                className='w-full'
              >
                {placeKinds.map(({ kind: value }) => (
                  <ToggleGroupItem
                    key={value}
                    value={String(value)}
                    className='flex-1'
                  >
                    {t(placeKindKey[value])}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <LocalizedInput
              id='place-name'
              label={t('name')}
              value={name}
              onChange={setName}
            />

            <LocalizedInput
              id='place-description'
              label={t('description')}
              value={description}
              onChange={setDescription}
              multiline
              rows={2}
            />

            <div className='flex items-center justify-between gap-4 rounded-lg border px-3 py-2'>
              <div>
                <Label htmlFor='place-timed'>{t('timed')}</Label>
                <p className='text-muted-foreground text-xs'>
                  {timed ? t('time') : t('ordersOnly')}
                </p>
              </div>
              <Switch
                id='place-timed'
                checked={timed}
                onCheckedChange={setTimed}
              />
            </div>

            {timed && (
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <Label>{t('rateOptions')}</Label>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
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

                {options.map((option) => (
                  <div
                    key={option.key}
                    className='grid grid-cols-[5rem_1fr_5.5rem_auto] items-end gap-2'
                  >
                    <div className='space-y-1'>
                      <Label
                        htmlFor={`option-code-${option.key}`}
                        className='text-xs'
                      >
                        {t('optionCode')}
                      </Label>
                      <Input
                        id={`option-code-${option.key}`}
                        value={option.code}
                        onChange={(e) =>
                          updateOption(option.key, { code: e.target.value })
                        }
                        dir='ltr'
                        className='h-8'
                      />
                    </div>
                    <LocalizedInput
                      id={`option-name-${option.key}`}
                      label={<span className='text-xs'>{t('name')}</span>}
                      value={option.name}
                      onChange={(value) =>
                        updateOption(option.key, { name: value })
                      }
                      compact
                    />
                    <div className='space-y-1'>
                      <Label
                        htmlFor={`option-rate-${option.key}`}
                        className='text-xs'
                      >
                        {t('hourlyRate')}
                      </Label>
                      <Input
                        id={`option-rate-${option.key}`}
                        type='number'
                        inputMode='decimal'
                        min={0}
                        step='0.01'
                        value={option.rate}
                        onChange={(e) =>
                          updateOption(option.key, { rate: e.target.value })
                        }
                        dir='ltr'
                        className='h-8'
                      />
                    </div>
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

                <div className='space-y-1'>
                  <Label htmlFor='place-rounding' className='text-xs'>
                    {t('roundingMinutes')}
                  </Label>
                  <Input
                    id='place-rounding'
                    type='number'
                    inputMode='numeric'
                    min={1}
                    step='1'
                    value={rounding}
                    onChange={(e) => setRounding(e.target.value)}
                    dir='ltr'
                    className='h-8 w-28'
                  />
                </div>
              </div>
            )}
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
