import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Plus, X } from 'lucide-react'
import {
  type BundleDealDto,
  type CatalogItemDto,
  type CreateOrUpdateBundleDealRequest,
} from '@/api/catalog'
import {
  createBundleMutation,
  updateBundleMutation,
  uploadBundlePictureMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
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
  type LocalizedValue,
} from '@/components/localized-input'
import { formatEgp } from '@/features/orders/status'
import { bundlePictureUrl } from '../pictures'

interface BundleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bundle: BundleDealDto | null
  items: CatalogItemDto[]
  /** Used as the display order when creating a new bundle (append at the end) */
  existingCount: number
}

type BundleItemRow = {
  catalogItemId: number
  quantity: number
}

export function BundleDialog({
  open,
  onOpenChange,
  bundle,
  items,
  existingCount,
}: BundleDialogProps) {
  const t = useT()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>
            {bundle ? t('editBundle') : t('createBundle')}
          </DialogTitle>
        </DialogHeader>
        {/* Keyed so form state resets per bundle; closing unmounts and resets */}
        <BundleForm
          key={String(bundle?.id ?? 'new')}
          bundle={bundle}
          items={items}
          existingCount={existingCount}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  )
}

function BundleForm({
  bundle,
  items,
  existingCount,
  onOpenChange,
}: {
  bundle: BundleDealDto | null
  items: CatalogItemDto[]
  existingCount: number
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const isEditing = !!bundle
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState<LocalizedValue>(() =>
    toLocalizedValue(bundle?.name)
  )
  const [description, setDescription] = useState<LocalizedValue>(() =>
    toLocalizedValue(bundle?.description)
  )
  const [bundlePrice, setBundlePrice] = useState(
    Number(bundle?.bundlePrice ?? 0)
  )
  const [isActive, setIsActive] = useState(bundle?.isActive ?? true)
  const [rows, setRows] = useState<BundleItemRow[]>(
    bundle?.items?.length
      ? bundle.items.map((bundleItem) => ({
          catalogItemId: Number(bundleItem.catalogItemId),
          quantity: Number(bundleItem.quantity ?? 1),
        }))
      : [{ catalogItemId: 0, quantity: 1 }]
  )
  const [error, setError] = useState<string | null>(null)
  const [pictureFile, setPictureFile] = useState<File | null>(null)
  const [picturePreview, setPicturePreview] = useState<string | null>(
    bundle?.pictureUri ? bundlePictureUrl(bundle.id, bundle.pictureUri) : null
  )

  const createBundle = useMutation(createBundleMutation())
  const updateBundle = useMutation(updateBundleMutation())
  const uploadPicture = useMutation(uploadBundlePictureMutation())
  const isSaving =
    createBundle.isPending || updateBundle.isPending || uploadPicture.isPending

  const itemPrice = (catalogItemId: number) =>
    Number(items.find((i) => Number(i.id) === catalogItemId)?.price ?? 0)

  const validRows = rows.filter((row) => row.catalogItemId > 0)
  const originalPrice = validRows.reduce(
    (sum, row) => sum + itemPrice(row.catalogItemId) * row.quantity,
    0
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPictureFile(file)
    setPicturePreview(URL.createObjectURL(file))
  }

  const updateRow = (index: number, patch: Partial<BundleItemRow>) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.en.trim()) {
      setError(t('englishNameRequired'))
      return
    }
    if (validRows.length === 0) {
      setError(t('pickAtLeastOneItem'))
      return
    }
    if (bundlePrice <= 0) {
      setError(t('bundlePriceGreaterThanZero'))
      return
    }
    if (bundlePrice >= originalPrice) {
      setError(t('bundlePriceMustBeLess'))
      return
    }
    setError(null)

    const body: CreateOrUpdateBundleDealRequest = {
      name: fromLocalizedValue(name),
      description: fromLocalizedValue(description),
      bundlePrice,
      isActive,
      displayOrder: bundle?.displayOrder ?? existingCount,
      items: validRows.map((row) => ({
        catalogItemId: row.catalogItemId,
        quantity: row.quantity,
      })),
    }

    let bundleId = Number(bundle?.id ?? 0)
    try {
      if (isEditing) {
        await updateBundle.mutateAsync({
          path: { id: bundleId },
          body,
          query: { 'api-version': API_VERSION },
        })
      } else {
        const created = await createBundle.mutateAsync({
          body,
          query: { 'api-version': API_VERSION },
        })
        bundleId = Number((created as BundleDealDto | undefined)?.id ?? 0)
      }
    } catch {
      toast.error(t('failedToSaveBundle'))
      return
    }

    // The bundle is saved at this point — a photo problem must not read
    // as a failed save.
    if (pictureFile && bundleId) {
      try {
        await uploadPicture.mutateAsync({
          path: { id: bundleId },
          body: { file: pictureFile },
          query: { 'api-version': API_VERSION },
        })
      } catch (uploadError) {
        const detail =
          isAxiosError(uploadError) &&
          (uploadError.response?.data as { detail?: string } | undefined)
            ?.detail
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getBundles' }] })
        toast.error(
          detail
            ? t('bundleSavedPhotoRejected', { detail })
            : t('bundleSavedPhotoUploadFailed')
        )
        onOpenChange(false)
        return
      }
    }

    queryClient.invalidateQueries({ queryKey: [{ _id: 'getBundles' }] })
    toast.success(t('bundleSaved'))
    onOpenChange(false)
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {/* Picture */}
      <div className='flex items-center gap-4'>
        <button
          type='button'
          className='bg-muted hover:bg-muted/80 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border'
          onClick={() => fileInputRef.current?.click()}
          aria-label={
            picturePreview ? t('clickToReplacePhoto') : t('clickToAddPhoto')
          }
        >
          {picturePreview ? (
            <img
              src={picturePreview}
              alt=''
              className='h-full w-full object-cover'
            />
          ) : (
            <ImagePlus className='text-muted-foreground h-6 w-6' />
          )}
        </button>
        <div className='text-muted-foreground text-sm'>
          {picturePreview ? t('clickToReplacePhoto') : t('clickToAddPhoto')}
          <br />
          {t('photoHint')}
        </div>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/png,image/jpeg,image/webp'
          className='hidden'
          onChange={handleFileChange}
        />
      </div>

      <LocalizedFields>
        <LocalizedInput
          id='bundle-name'
          label={t('name')}
          value={name}
          onChange={setName}
        />
        <LocalizedInput
          id='bundle-description'
          label={t('description')}
          value={description}
          onChange={setDescription}
          multiline
          className='mt-4'
        />
      </LocalizedFields>

      {/* Items in the bundle */}
      <div className='space-y-2'>
        <Label>{t('items')}</Label>
        <div className='space-y-2'>
          {rows.map((row, index) => (
            <div
              key={index}
              className='grid grid-cols-[1fr_72px_32px] items-center gap-2'
            >
              <Select
                value={row.catalogItemId ? String(row.catalogItemId) : ''}
                onValueChange={(value) =>
                  updateRow(index, { catalogItemId: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('pickAnItem')} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={String(item.id)} value={String(item.id)}>
                      {localized(item.name)} · {formatEgp(item.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type='number'
                min='1'
                aria-label={t('quantity')}
                className='tabular-nums'
                value={row.quantity}
                onChange={(e) =>
                  updateRow(index, {
                    quantity: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
              />
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-8'
                aria-label={t('removeItem')}
                disabled={rows.length === 1}
                onClick={() =>
                  setRows((current) => current.filter((_, i) => i !== index))
                }
              >
                <X className='h-4 w-4' />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() =>
            setRows((current) => [
              ...current,
              { catalogItemId: 0, quantity: 1 },
            ])
          }
        >
          <Plus className='me-1 h-4 w-4' />
          {t('addItem')}
        </Button>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='bundlePrice'>
            {t('bundlePrice')} ({t('currency')})
          </Label>
          <Input
            id='bundlePrice'
            type='number'
            step='0.01'
            min='0'
            value={bundlePrice}
            onChange={(e) => setBundlePrice(parseFloat(e.target.value) || 0)}
          />
          {originalPrice > 0 && (
            <p className='text-muted-foreground text-xs'>
              {t('originalPrice')}: {formatEgp(originalPrice)}
              {bundlePrice > 0 && bundlePrice < originalPrice && (
                <>
                  {' · '}
                  {t('savesPercent', {
                    percent: Math.round(
                      (1 - bundlePrice / originalPrice) * 100
                    ),
                  })}
                </>
              )}
            </p>
          )}
        </div>
        <div className='flex items-center justify-between self-start'>
          <Label className='text-sm'>{t('bundleActive')}</Label>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      {error && <p className='text-destructive text-sm'>{error}</p>}

      <DialogFooter>
        <Button
          type='button'
          variant='outline'
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
        <Button type='submit' disabled={isSaving}>
          {isSaving && <Spinner className='me-2' />}
          {isEditing ? t('update') : t('create')}
        </Button>
      </DialogFooter>
    </form>
  )
}
