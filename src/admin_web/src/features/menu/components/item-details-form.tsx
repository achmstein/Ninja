import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Sparkles, X } from 'lucide-react'
import {
  type CatalogItemDto,
  type CatalogTypeDto,
  type LocalizeResponse,
  type UpdateCatalogItemRequest,
} from '@/api/catalog'
import {
  createCustomizationMutation,
  createItemMutation,
  deleteItemPictureMutation,
  updateItemMutation,
  uploadItemPictureMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  fromLocalizedValue,
  LocalizedFields,
  LocalizedInput,
  toLocalizedValue,
  useDefaultLang,
  type Lang,
  type LocalizedValue,
} from '@/components/localized-input'
import { halfFilled, hasText } from '@/features/assist/helpers'
import { useCustomizationsAssist } from '@/features/assist/use-customizations-assist'
import {
  LOCALIZE_MENU_ITEM,
  useLocalizeAssist,
} from '@/features/assist/use-localize-assist'
import { itemPictureUrl } from '../pictures'
import {
  bodyFromDraft,
  DraftCard,
  fromProposal,
  type DraftGroup,
} from './customization-draft'

/** What the assistant filled in and the user has not edited since */
type Suggested = {
  name: Partial<Record<Lang, boolean>>
  description: Partial<Record<Lang, boolean>>
  category: boolean
}

const nothingSuggested: Suggested = {
  name: {},
  description: {},
  category: false,
}

// Sunday first, like DayOfWeek on the server; a Sunday to name them from
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const
const A_SUNDAY = Date.UTC(2023, 0, 1)

type FormState = {
  name: LocalizedValue
  description: LocalizedValue
  price: string
  catalogTypeId: number
  isPopular: boolean
  isOnOffer: boolean
  offerPrice: string
  /** A bit per weekday, Sunday first; 0 is every day */
  offerWeekdays: number
  offerFrom: string
  offerTo: string
  preparationTimeMinutes: string
}

const languages: Lang[] = ['en', 'ar']

/**
 * The form with what the assistant filled in — only into fields still
 * empty, since the user may have typed meanwhile — and the category when
 * one was wanted.
 */
function withLocalized(
  prev: FormState,
  result: LocalizeResponse,
  wantCategory: boolean
): FormState {
  const filled = new Set(result.filled)
  const next = {
    ...prev,
    name: { ...prev.name },
    description: { ...prev.description },
  }
  for (const l of languages) {
    if (filled.has(`name.${l}`) && !hasText(prev.name[l])) {
      next.name[l] = result.name[l] ?? ''
    }
    if (filled.has(`description.${l}`) && !hasText(prev.description[l])) {
      next.description[l] = result.description?.[l] ?? ''
    }
  }
  if (
    wantCategory &&
    filled.has('catalogTypeId') &&
    result.suggestedCatalogTypeId != null
  ) {
    next.catalogTypeId = Number(result.suggestedCatalogTypeId)
  }
  return next
}

type ItemDetailsFormProps = {
  /** `null` creates a new item */
  item: CatalogItemDto | null
  categories: CatalogTypeDto[]
  /** Category preselected for a new item (opened from that heading) */
  defaultCategoryId?: number
  /** Called with the saved item's id (a new one after create) */
  onSaved: (itemId: number) => void
  onCancel?: () => void
}

/**
 * The item itself: names, description, price, category, prep time, the
 * popular flag and the offer. The photo saves with the form. Values are the
 * chain-wide ones (`base` when the active branch overrides the price), so
 * editing here never writes a branch price into the menu.
 */
export function ItemDetailsForm({
  item,
  categories,
  defaultCategoryId,
  onSaved,
  onCancel,
}: ItemDetailsFormProps) {
  const t = useT()
  const locale = useLocale()
  const weekdayName = (day: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
      new Date(A_SUNDAY + day * 86_400_000)
    )
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const isEditing = !!item
  const fileInputRef = useRef<HTMLInputElement>(null)

  const base = item?.base ?? item
  const [form, setForm] = useState<FormState>({
    name: toLocalizedValue(item?.name),
    description: toLocalizedValue(item?.description),
    price: base?.price != null ? String(Number(base.price)) : '',
    catalogTypeId: Number(
      item?.catalogTypeId ?? defaultCategoryId ?? categories[0]?.id ?? 0
    ),
    isPopular: item?.isPopular ?? false,
    isOnOffer: base?.isOnOffer ?? false,
    offerPrice: base?.offerPrice != null ? String(Number(base.offerPrice)) : '',
    offerWeekdays: Number(base?.offerWeekdays ?? 0),
    offerFrom: base?.offerFrom ?? '',
    offerTo: base?.offerTo ?? '',
    preparationTimeMinutes:
      item?.preparationTimeMinutes != null
        ? String(Number(item.preparationTimeMinutes))
        : '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  // A picked file waits for Save; `remove` deletes the stored photo on Save
  const [picture, setPicture] = useState<
    | { kind: 'keep' }
    | { kind: 'file'; file: File; url: string }
    | { kind: 'remove' }
  >({ kind: 'keep' })

  // One button asks the assistant for everything the item is missing: the
  // other language of the name, a description (translated when half there,
  // written when absent), a category on a new item nobody has picked one
  // for — and, still on a new item, the option groups it is ordered with,
  // which wait below the form and are saved with it. The form flips to the
  // language it filled so what came back is in view.
  const assist = useLocalizeAssist()
  const customizations = useCustomizationsAssist()
  const [lang, setLang] = useState<Lang>(useDefaultLang())
  const [suggested, setSuggested] = useState<Suggested>(nothingSuggested)
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [proposals, setProposals] = useState<DraftGroup[]>([])
  const wantCategory =
    !isEditing && defaultCategoryId == null && !categoryTouched
  const nameTyped = hasText(form.name.en) || hasText(form.name.ar)
  const wantsLocalize =
    !!halfFilled(form.name) ||
    !(hasText(form.description.en) && hasText(form.description.ar)) ||
    wantCategory
  const fillBlocker: 'assistNeedsName' | 'assistNothingMissing' | null =
    !nameTyped
      ? 'assistNeedsName'
      : isEditing && !wantsLocalize
        ? 'assistNothingMissing'
        : null
  const filling = assist.isPending || customizations.isPending

  const fillWithAssistant = async () => {
    let next = form
    try {
      if (wantsLocalize) {
        const result = await assist.localize({
          kind: LOCALIZE_MENU_ITEM,
          name: form.name,
          description: form.description,
          catalogTypeId: form.catalogTypeId || null,
          suggestCategory: wantCategory,
          suggestDescription: true,
        })
        const filled = new Set(result.filled)
        next = withLocalized(form, result, wantCategory)
        setForm((prev) => withLocalized(prev, result, wantCategory))
        setSuggested({
          name: { en: filled.has('name.en'), ar: filled.has('name.ar') },
          description: {
            en: filled.has('description.en'),
            ar: filled.has('description.ar'),
          },
          category: filled.has('catalogTypeId') && wantCategory,
        })
        // Show the language that was just filled in; a description written
        // in both stays on the one the user is typing in
        const source = halfFilled(form.name)
        if (source) setLang(source === 'en' ? 'ar' : 'en')
        for (const warning of result.warnings) toast.warning(warning)
      }
      if (!isEditing) {
        const result = await customizations.suggest({
          name: next.name,
          description: next.description,
          catalogTypeId: next.catalogTypeId || null,
          price: parseFloat(next.price) || 0,
        })
        setProposals(result.groups.map(fromProposal))
        if (result.groups.length === 0) toast.info(t('assistNothingToSuggest'))
        for (const warning of result.warnings) toast.warning(warning)
      }
    } catch {
      // toasted by the hooks
    }
  }

  const uploadPicture = useMutation(uploadItemPictureMutation())
  const deletePicture = useMutation(deleteItemPictureMutation())
  const createItem = useMutation(createItemMutation())
  const updateItem = useMutation(updateItemMutation())
  const createGroup = useMutation(createCustomizationMutation())
  const isSaving =
    createItem.isPending ||
    updateItem.isPending ||
    createGroup.isPending ||
    uploadPicture.isPending ||
    deletePicture.isPending

  const storedUrl = item?.pictureUri
    ? itemPictureUrl(item.id, item.pictureUri)
    : null
  const preview =
    picture.kind === 'file'
      ? picture.url
      : picture.kind === 'remove'
        ? null
        : storedUrl

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    const price = parseFloat(form.price)
    const offer = parseFloat(form.offerPrice)
    if (!form.name.en.trim()) next.name = t('englishNameRequired')
    if (!(price >= 0)) next.price = t('priceMustBePositive')
    if (form.isOnOffer) {
      if (!(offer > 0)) next.offerPrice = t('offerPriceRequired')
      else if (offer >= price) next.offerPrice = t('offerPriceMustBeLess')
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const body: UpdateCatalogItemRequest = {
      name: fromLocalizedValue(form.name),
      description: fromLocalizedValue(form.description),
      price: parseFloat(form.price),
      catalogTypeId: form.catalogTypeId,
      isAvailable: base?.isAvailable ?? true,
      isPopular: form.isPopular,
      isOnOffer: form.isOnOffer,
      offerPrice: form.isOnOffer ? parseFloat(form.offerPrice) : null,
      offerWeekdays: form.offerWeekdays || null,
      offerFrom: form.offerFrom && form.offerTo ? form.offerFrom : null,
      offerTo: form.offerFrom && form.offerTo ? form.offerTo : null,
      preparationTimeMinutes: form.preparationTimeMinutes
        ? parseInt(form.preparationTimeMinutes)
        : null,
    }

    let itemId = Number(item?.id ?? 0)
    try {
      if (isEditing) {
        await updateItem.mutateAsync({
          path: { id: itemId },
          body,
          query: { 'api-version': API_VERSION },
        })
      } else {
        const created = await createItem.mutateAsync({
          body: { ...body, name: fromLocalizedValue(form.name) },
          query: { 'api-version': API_VERSION },
        })
        itemId = Number((created as CatalogItemDto | undefined)?.id ?? 0)
      }
    } catch {
      toast.error(t('failedToSaveItem'))
      return
    }

    // The item is saved at this point — a problem with its option groups or
    // its photo must not read as a failed save.
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] })
    if (proposals.length > 0) {
      try {
        if (!itemId) throw new Error('no item id')
        for (const [index, draft] of proposals.entries()) {
          await createGroup.mutateAsync({
            path: { id: itemId },
            body: bodyFromDraft(itemId, draft, index),
            query: { 'api-version': API_VERSION },
          })
        }
        queryClient.invalidateQueries({
          queryKey: [{ _id: 'getItemCustomizations' }],
        })
      } catch {
        invalidate()
        toast.error(t('itemSavedCustomizationsFailed'))
        onSaved(itemId)
        return
      }
    }
    if (picture.kind !== 'keep') {
      if (!itemId) {
        invalidate()
        toast.error(t('itemSavedPhotoUploadFailed'))
        onSaved(itemId)
        return
      }
      try {
        if (picture.kind === 'file') {
          await uploadPicture.mutateAsync({
            path: { id: itemId },
            body: { file: picture.file },
            query: { 'api-version': API_VERSION },
          })
        } else {
          await deletePicture.mutateAsync({
            path: { id: itemId },
            query: { 'api-version': API_VERSION },
          })
        }
      } catch (error) {
        const detail =
          isAxiosError(error) &&
          (error.response?.data as { detail?: string } | undefined)?.detail
        invalidate()
        toast.error(
          detail
            ? t('itemSavedPhotoRejected', { detail })
            : t('itemSavedPhotoUploadFailed')
        )
        onSaved(itemId)
        return
      }
    }

    invalidate()
    toast.success(t('itemSaved'))
    setPicture({ kind: 'keep' })
    onSaved(itemId)
  }

  return (
    <LocalizedFields lang={lang} onLangChange={setLang}>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <div className='flex items-center gap-4'>
          <button
            type='button'
            className='bg-muted hover:bg-muted/80 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border'
            onClick={() => fileInputRef.current?.click()}
            aria-label={
              preview ? t('clickToReplacePhoto') : t('clickToAddPhoto')
            }
          >
            {preview ? (
              <img
                src={preview}
                alt=''
                className='h-full w-full object-cover'
              />
            ) : (
              <ImagePlus className='text-muted-foreground h-6 w-6' />
            )}
          </button>
          <div className='text-muted-foreground min-w-0 text-sm'>
            {preview ? t('clickToReplacePhoto') : t('clickToAddPhoto')}
            <br />
            {t('photoHint')}
            {preview && (
              <Button
                type='button'
                variant='link'
                size='sm'
                className='text-destructive h-auto px-0 pt-1'
                onClick={() =>
                  setPicture(
                    picture.kind === 'file'
                      ? { kind: 'keep' }
                      : { kind: 'remove' }
                  )
                }
              >
                <X className='me-1 h-3.5 w-3.5' />
                {t('removePhoto')}
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/png,image/jpeg,image/webp'
            className='hidden'
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                setPicture({
                  kind: 'file',
                  file,
                  url: URL.createObjectURL(file),
                })
              }
              e.target.value = ''
            }}
          />
        </div>

        <LocalizedInput
          id='item-name'
          label={t('name')}
          value={form.name}
          onChange={(name, typed) => {
            set('name', name)
            setSuggested((prev) => ({
              ...prev,
              name: { ...prev.name, [typed]: false },
            }))
          }}
          error={errors.name}
          suggested={suggested.name}
        />

        {assist.available && (
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='text-primary hover:text-primary'
              disabled={!!fillBlocker || filling}
              onClick={fillWithAssistant}
            >
              {filling ? (
                <Spinner className='me-2 size-4' />
              ) : (
                <Sparkles className='me-2 size-4' />
              )}
              {t('assistFillIn')}
            </Button>
            {fillBlocker && (
              <p className='text-muted-foreground text-xs'>{t(fillBlocker)}</p>
            )}
          </div>
        )}

        <LocalizedInput
          id='item-description'
          label={t('description')}
          value={form.description}
          onChange={(description, typed) => {
            set('description', description)
            setSuggested((prev) => ({
              ...prev,
              description: { ...prev.description, [typed]: false },
            }))
          }}
          suggested={suggested.description}
          multiline
        />

        <div className='grid grid-cols-3 gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='item-price'>
              {t('price')} ({t('currency')})
            </Label>
            <Input
              id='item-price'
              type='number'
              step='0.01'
              min='0'
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
            />
            {errors.price && (
              <p className='text-destructive text-sm'>{errors.price}</p>
            )}
          </div>
          <div className='space-y-2'>
            <Label htmlFor='item-category'>{t('category')}</Label>
            <Select
              value={String(form.catalogTypeId)}
              onValueChange={(value) => {
                set('catalogTypeId', parseInt(value))
                setCategoryTouched(true)
                setSuggested((prev) => ({ ...prev, category: false }))
              }}
            >
              <SelectTrigger
                id='item-category'
                className={cn(
                  suggested.category && 'border-primary ring-primary/20 ring-2'
                )}
                title={
                  suggested.category ? t('assistCategorySuggested') : undefined
                }
              >
                <SelectValue placeholder={t('selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={String(cat.id)} value={String(cat.id)}>
                    {localized(cat.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {suggested.category && (
              <p className='text-primary flex items-center gap-1 text-xs'>
                <Sparkles className='size-3' aria-hidden />
                {t('assistCategorySuggested')}
              </p>
            )}
          </div>
          <div className='space-y-2'>
            <Label htmlFor='item-prep'>{t('prepTimeShort')}</Label>
            <Input
              id='item-prep'
              type='number'
              min='0'
              placeholder={t('optional')}
              value={form.preparationTimeMinutes}
              onChange={(e) => set('preparationTimeMinutes', e.target.value)}
            />
          </div>
        </div>

        <div className='flex items-center justify-between'>
          <Label htmlFor='item-popular' className='text-sm'>
            {t('popular')}
          </Label>
          <Switch
            id='item-popular'
            checked={form.isPopular}
            onCheckedChange={(checked) => set('isPopular', checked)}
          />
        </div>

        <div className='space-y-3'>
          <div className='flex items-center justify-between gap-4'>
            <Label htmlFor='item-offer' className='text-sm'>
              {t('itemOnOffer')}
            </Label>
            <Switch
              id='item-offer'
              checked={form.isOnOffer}
              onCheckedChange={(checked) => set('isOnOffer', checked)}
            />
          </div>
          {form.isOnOffer && (
            <div className='space-y-2'>
              <Label htmlFor='item-offerPrice'>
                {t('offerPrice')} ({t('currency')})
              </Label>
              <Input
                id='item-offerPrice'
                type='number'
                step='0.01'
                min='0'
                className='w-40'
                value={form.offerPrice}
                onChange={(e) => set('offerPrice', e.target.value)}
              />
              {errors.offerPrice && (
                <p className='text-destructive text-sm'>{errors.offerPrice}</p>
              )}
              {/* When: any weekday off means the offer sleeps that day; the
                  hours are optional and may run past midnight */}
              <div className='flex flex-wrap gap-1'>
                {WEEKDAYS.map((day) => {
                  const bit = 1 << day
                  const on = form.offerWeekdays === 0 || (form.offerWeekdays & bit) !== 0
                  return (
                    <Button
                      key={day}
                      type='button'
                      size='sm'
                      variant={on ? 'secondary' : 'outline'}
                      className='h-8 w-11 px-0 text-xs'
                      onClick={() => {
                        const all = 127
                        const current = form.offerWeekdays === 0 ? all : form.offerWeekdays
                        const next = current ^ bit
                        set('offerWeekdays', next === all || next === 0 ? 0 : next)
                      }}
                    >
                      {weekdayName(day)}
                    </Button>
                  )
                })}
              </div>
              <div className='flex items-center gap-2'>
                <Input
                  type='time'
                  className='w-32'
                  aria-label={t('offerFrom')}
                  value={form.offerFrom}
                  onChange={(e) => set('offerFrom', e.target.value)}
                />
                <span className='text-muted-foreground text-xs'>–</span>
                <Input
                  type='time'
                  className='w-32'
                  aria-label={t('offerTo')}
                  value={form.offerTo}
                  onChange={(e) => set('offerTo', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {proposals.length > 0 && (
          <div className='border-primary/30 bg-primary/5 space-y-3 rounded-lg border p-3'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-primary flex items-center gap-1 text-xs'>
                <Sparkles className='size-3 shrink-0' aria-hidden />
                {t('assistProposedCustomizations')}
              </p>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='text-muted-foreground h-7 shrink-0'
                onClick={() => setProposals([])}
              >
                {t('discardAll')}
              </Button>
            </div>
            {proposals.map((draft, index) => (
              <DraftCard
                key={index}
                draft={draft}
                actions={
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='hover:text-destructive size-7'
                    aria-label={`${t('discard')} ${localized(draft.name)}`}
                    onClick={() =>
                      setProposals((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <X className='h-3.5 w-3.5' />
                  </Button>
                }
              />
            ))}
          </div>
        )}

        <div className='flex justify-end gap-2'>
          {onCancel && (
            <Button type='button' variant='outline' onClick={onCancel}>
              {t('cancel')}
            </Button>
          )}
          <Button type='submit' disabled={isSaving}>
            {isSaving && <Spinner className='me-2' />}
            {isEditing ? t('save') : t('addItem')}
          </Button>
        </div>
      </form>
    </LocalizedFields>
  )
}
