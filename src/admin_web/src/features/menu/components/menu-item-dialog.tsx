import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ImagePlus, Loader2, SlidersHorizontal } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  type CatalogItem,
  type CatalogItemDto,
  type CatalogTypeDto,
} from '@/api/catalog'
import {
  createItemMutation,
  updateItemMutation,
  uploadItemPictureMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { itemPictureUrl } from '../columns'

interface MenuItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CatalogItemDto | null
  categories: CatalogTypeDto[]
  onManageCustomizations?: () => void
}

export function MenuItemDialog({
  open,
  onOpenChange,
  item,
  categories,
  onManageCustomizations,
}: MenuItemDialogProps) {
  const t = useT()
  const isEditing = !!item

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-[560px]'>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('editMenuItem') : t('addMenuItem')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('editMenuItemDescription')
              : t('addMenuItemDescription')}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so form state resets per item; closing unmounts and resets */}
        <MenuItemForm
          key={String(item?.id ?? 'new')}
          item={item}
          categories={categories}
          onOpenChange={onOpenChange}
          onManageCustomizations={onManageCustomizations}
        />
      </DialogContent>
    </Dialog>
  )
}

type FormState = {
  nameEn: string
  nameAr: string
  descriptionEn: string
  descriptionAr: string
  price: number
  catalogTypeId: number
  isAvailable: boolean
  isPopular: boolean
  isOnOffer: boolean
  offerPrice?: number
  preparationTimeMinutes?: number
}

function MenuItemForm({
  item,
  categories,
  onOpenChange,
  onManageCustomizations,
}: {
  item: CatalogItemDto | null
  categories: CatalogTypeDto[]
  onOpenChange: (open: boolean) => void
  onManageCustomizations?: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const isEditing = !!item
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>({
    nameEn: item?.name?.en ?? '',
    nameAr: item?.name?.ar ?? '',
    descriptionEn: item?.description?.en ?? '',
    descriptionAr: item?.description?.ar ?? '',
    price: Number(item?.price ?? 0),
    catalogTypeId: Number(item?.catalogTypeId ?? categories[0]?.id ?? 1),
    isAvailable: item?.isAvailable ?? true,
    isPopular: item?.isPopular ?? false,
    isOnOffer: item?.isOnOffer ?? false,
    offerPrice: item?.offerPrice ? Number(item.offerPrice) : undefined,
    preparationTimeMinutes: item?.preparationTimeMinutes
      ? Number(item.preparationTimeMinutes)
      : undefined,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pictureFile, setPictureFile] = useState<File | null>(null)
  const [picturePreview, setPicturePreview] = useState<string | null>(
    item?.pictureUri ? itemPictureUrl(item.id, item.pictureUri) : null
  )

  const uploadPicture = useMutation(uploadItemPictureMutation())
  const createItem = useMutation(createItemMutation())
  const updateItem = useMutation(updateItemMutation())

  const isSaving =
    createItem.isPending || updateItem.isPending || uploadPicture.isPending

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPictureFile(file)
    setPicturePreview(URL.createObjectURL(file))
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!form.nameEn.trim()) next.nameEn = t('englishNameRequired')
    if (form.price < 0) next.price = t('priceMustBePositive')
    if (form.isOnOffer) {
      if (!form.offerPrice || form.offerPrice <= 0) {
        next.offerPrice = t('offerPriceRequired')
      } else if (form.offerPrice >= form.price) {
        next.offerPrice = t('offerPriceMustBeLess')
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const body: CatalogItem = {
      id: item?.id,
      name: { en: form.nameEn.trim(), ar: form.nameAr.trim() || null },
      description: {
        en: form.descriptionEn.trim(),
        ar: form.descriptionAr.trim() || null,
      },
      price: form.price,
      catalogTypeId: form.catalogTypeId,
      isAvailable: form.isAvailable,
      isPopular: form.isPopular,
      isOnOffer: form.isOnOffer,
      offerPrice: form.isOnOffer ? (form.offerPrice ?? null) : null,
      preparationTimeMinutes: form.preparationTimeMinutes ?? null,
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
          body,
          query: { 'api-version': API_VERSION },
        })
        itemId = Number((created as CatalogItemDto | undefined)?.id ?? 0)
      }
    } catch {
      toast.error(t('failedToSaveItem'))
      return
    }

    // The item is saved at this point — a photo problem must not read as a
    // failed save.
    if (pictureFile && itemId) {
      try {
        await uploadPicture.mutateAsync({
          path: { id: itemId },
          body: { file: pictureFile },
          query: { 'api-version': API_VERSION },
        })
      } catch (uploadError) {
        const detail =
          isAxiosError(uploadError) &&
          (uploadError.response?.data as { detail?: string } | undefined)
            ?.detail
        queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] })
        toast.error(
          detail
            ? t('itemSavedPhotoRejected', { detail })
            : t('itemSavedPhotoUploadFailed')
        )
        onOpenChange(false)
        return
      }
    }

    queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] })
    toast.success(t('itemSaved'))
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

      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='nameEn'>{t('nameEnglish')}</Label>
          <Input
            id='nameEn'
            placeholder='Cappuccino'
            value={form.nameEn}
            onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
          />
          {errors.nameEn && (
            <p className='text-destructive text-sm'>{errors.nameEn}</p>
          )}
        </div>
        <div className='space-y-2'>
          <Label htmlFor='nameAr'>{t('nameArabic')}</Label>
          <Input
            id='nameAr'
            dir='rtl'
            placeholder='كابتشينو'
            value={form.nameAr}
            onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
          />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='descriptionEn'>{t('descriptionEnglish')}</Label>
          <Textarea
            id='descriptionEn'
            rows={2}
            value={form.descriptionEn}
            onChange={(e) =>
              setForm({ ...form, descriptionEn: e.target.value })
            }
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='descriptionAr'>{t('descriptionArabic')}</Label>
          <Textarea
            id='descriptionAr'
            dir='rtl'
            rows={2}
            value={form.descriptionAr}
            onChange={(e) =>
              setForm({ ...form, descriptionAr: e.target.value })
            }
          />
        </div>
      </div>

      <div className='grid grid-cols-3 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='price'>
            {t('price')} ({t('currency')})
          </Label>
          <Input
            id='price'
            type='number'
            step='0.01'
            min='0'
            value={form.price}
            onChange={(e) =>
              setForm({ ...form, price: parseFloat(e.target.value) || 0 })
            }
          />
          {errors.price && (
            <p className='text-destructive text-sm'>{errors.price}</p>
          )}
        </div>
        <div className='space-y-2'>
          <Label htmlFor='category'>{t('category')}</Label>
          <Select
            value={String(form.catalogTypeId)}
            onValueChange={(value) =>
              setForm({ ...form, catalogTypeId: parseInt(value) })
            }
          >
            <SelectTrigger id='category'>
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
        </div>
        <div className='space-y-2'>
          <Label htmlFor='prepTime'>{t('prepTimeShort')}</Label>
          <Input
            id='prepTime'
            type='number'
            min='0'
            placeholder={t('optional')}
            value={form.preparationTimeMinutes ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                preparationTimeMinutes: e.target.value
                  ? parseInt(e.target.value)
                  : undefined,
              })
            }
          />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='flex items-center justify-between rounded-lg border p-3'>
          <Label className='text-sm'>{t('availableLabel')}</Label>
          <Switch
            checked={form.isAvailable}
            onCheckedChange={(checked) =>
              setForm({ ...form, isAvailable: checked })
            }
          />
        </div>
        <div className='flex items-center justify-between rounded-lg border p-3'>
          <Label className='text-sm'>{t('popular')}</Label>
          <Switch
            checked={form.isPopular}
            onCheckedChange={(checked) =>
              setForm({ ...form, isPopular: checked })
            }
          />
        </div>
      </div>

      <div className='space-y-3 rounded-lg border p-3'>
        <div className='flex items-center justify-between'>
          <div className='space-y-0.5'>
            <Label className='text-sm'>{t('itemOnOffer')}</Label>
            <p className='text-muted-foreground text-xs'>{t('onOfferHint')}</p>
          </div>
          <Switch
            checked={form.isOnOffer}
            onCheckedChange={(checked) =>
              setForm({ ...form, isOnOffer: checked })
            }
          />
        </div>
        {form.isOnOffer && (
          <div className='space-y-2'>
            <Label htmlFor='offerPrice'>
              {t('offerPrice')} ({t('currency')})
            </Label>
            <Input
              id='offerPrice'
              type='number'
              step='0.01'
              min='0'
              value={form.offerPrice ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  offerPrice: e.target.value
                    ? parseFloat(e.target.value)
                    : undefined,
                })
              }
            />
            {errors.offerPrice && (
              <p className='text-destructive text-sm'>{errors.offerPrice}</p>
            )}
          </div>
        )}
      </div>

      {isEditing && onManageCustomizations && (
        <div className='flex items-center justify-between rounded-lg border p-3'>
          <div className='space-y-0.5'>
            <Label className='text-sm'>{t('customizations')}</Label>
            <p className='text-muted-foreground text-xs'>
              {item?.customizations?.length
                ? t('customizationGroupCount', {
                    count: item.customizations.length,
                  })
                : t('addCustomizationsHint')}
            </p>
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onManageCustomizations}
          >
            <SlidersHorizontal className='me-1 h-4 w-4' />
            {t('manage')}
          </Button>
        </div>
      )}

      <DialogFooter>
        <Button
          type='button'
          variant='outline'
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
        <Button type='submit' disabled={isSaving}>
          {isSaving && <Loader2 className='me-2 h-4 w-4 animate-spin' />}
          {isEditing ? t('update') : t('create')}
        </Button>
      </DialogFooter>
    </form>
  )
}
