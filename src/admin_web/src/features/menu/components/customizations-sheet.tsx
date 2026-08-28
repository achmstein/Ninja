import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  type CatalogItemDto,
  type ItemCustomization,
  type ItemCustomizationDto,
} from '@/api/catalog'
import {
  createCustomizationMutation,
  deleteCustomizationMutation,
  getItemCustomizationsOptions,
  updateCustomizationMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { DeleteConfirmDialog } from './delete-confirm-dialog'

interface CustomizationsSheetProps {
  item: CatalogItemDto | null
  onOpenChange: (open: boolean) => void
}

// Free options show nothing — pricing only appears where it differs
function formatAdjustment(
  value: number,
  t: ReturnType<typeof useT>
): string {
  if (!value) return ''
  return `${value > 0 ? '+' : '−'}${Math.abs(value)} ${t('currency')}`
}

/** Tiny radio/checkbox glyph: shape mirrors what the customer will see
 *  (circle = pick one, square = pick several); filled = default choice. */
function ChoiceGlyph({
  multiple,
  selected,
}: {
  multiple: boolean
  selected: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'h-3 w-3 shrink-0 border transition-colors',
        multiple ? 'rounded-[3px]' : 'rounded-full',
        selected
          ? 'border-primary bg-primary'
          : 'border-muted-foreground/40'
      )}
    />
  )
}

/** Rebuilds the full replace-all-options body the update endpoint expects. */
function bodyFromDto(
  itemId: number,
  group: ItemCustomizationDto,
  displayOrder: number
): ItemCustomization {
  return {
    catalogItemId: itemId,
    name: { en: group.name?.en ?? '', ar: group.name?.ar ?? null },
    isRequired: group.isRequired ?? false,
    allowMultiple: group.allowMultiple ?? false,
    displayOrder,
    options: (group.options ?? [])
      .slice()
      .sort(
        (a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
      )
      .map((option, index) => ({
        name: { en: option.name?.en ?? '', ar: option.name?.ar ?? null },
        priceAdjustment: Number(option.priceAdjustment ?? 0),
        isDefault: option.isDefault ?? false,
        displayOrder: index,
      })),
  }
}

export function CustomizationsSheet({
  item,
  onOpenChange,
}: CustomizationsSheetProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const itemId = Number(item?.id ?? 0)

  // null = browsing, 'new' = creating, number = editing that group id
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [deletingGroup, setDeletingGroup] =
    useState<ItemCustomizationDto | null>(null)

  // Drag-to-reorder: grip arms the drag, drop persists the new order
  const [dragArmedId, setDragArmedId] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dropTargetId, setDropTargetId] = useState<number | null>(null)
  // Applied immediately on drop so the list doesn't jump back while saving
  const [localOrder, setLocalOrder] = useState<number[] | null>(null)

  const { data: groups = [], isLoading } = useQuery({
    ...getItemCustomizationsOptions({
      path: { id: itemId },
      query: { 'api-version': API_VERSION },
    }),
    enabled: !!item,
  })

  const sortedGroups = [...groups].sort((a, b) => {
    if (localOrder) {
      const ai = localOrder.indexOf(Number(a.id))
      const bi = localOrder.indexOf(Number(b.id))
      if (ai !== -1 && bi !== -1) return ai - bi
    }
    return Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
  })

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: [{ _id: 'getItemCustomizations' }],
    })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] })
  }

  const deleteGroup = useMutation({
    ...deleteCustomizationMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('customizationDeleted'))
      setDeletingGroup(null)
    },
    onError: () => toast.error(t('failedToDeleteCustomization')),
  })

  const reorderGroup = useMutation(updateCustomizationMutation())

  const handleDrop = async (targetId: number) => {
    const fromId = draggingId
    setDraggingId(null)
    setDropTargetId(null)
    setDragArmedId(null)
    if (fromId == null || fromId === targetId) return

    const ids = sortedGroups.map((g) => Number(g.id))
    const next = ids.filter((id) => id !== fromId)
    next.splice(next.indexOf(targetId), 0, fromId)
    setLocalOrder(next)

    try {
      // Persist only the groups whose position actually changed
      await Promise.all(
        next.map((id, index) => {
          const group = sortedGroups.find((g) => Number(g.id) === id)!
          if (Number(group.displayOrder ?? 0) === index) return null
          return reorderGroup.mutateAsync({
            path: { id: itemId, customizationId: id },
            body: bodyFromDto(itemId, group, index),
            query: { 'api-version': API_VERSION },
          })
        })
      )
      invalidate()
      toast.success(t('orderSavedSuccess'))
    } catch {
      setLocalOrder(null)
      invalidate()
      toast.error(t('failedToSaveOrder'))
    }
  }

  const closeSheet = (open: boolean) => {
    if (!open) {
      setEditing(null)
      setLocalOrder(null)
    }
    onOpenChange(open)
  }

  return (
    <>
      <Sheet open={!!item} onOpenChange={closeSheet}>
        <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg'>
          <SheetHeader className='pb-2'>
            <SheetTitle>{t('customizations')}</SheetTitle>
            <SheetDescription>
              {t('customizationsSheetDescription', {
                name: localized(item?.name) || t('thisItem'),
              })}
            </SheetDescription>
          </SheetHeader>

          <div className='flex-1 px-4 pb-6'>
            {isLoading ? (
              <div className='flex justify-center py-16'>
                <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
              </div>
            ) : sortedGroups.length === 0 && editing !== 'new' ? (
              <div className='text-muted-foreground flex flex-col items-center gap-2 py-16 text-center'>
                <SlidersHorizontal className='h-8 w-8 opacity-30' />
                <p className='text-sm font-medium'>{t('noCustomizations')}</p>
                <p className='text-xs'>{t('addCustomizationsHint')}</p>
              </div>
            ) : (
              <div className='flex flex-col'>
                {sortedGroups.map((group, index) => {
                  const groupId = Number(group.id)
                  const multiple = group.allowMultiple ?? false
                  const options = (group.options ?? [])
                    .slice()
                    .sort(
                      (a, b) =>
                        Number(a.displayOrder ?? 0) -
                        Number(b.displayOrder ?? 0)
                    )

                  if (editing === groupId) {
                    return (
                      <div key={groupId}>
                        {index > 0 && <Separator className='my-4' />}
                        <GroupEditor
                          itemId={itemId}
                          group={group}
                          existingCount={groups.length}
                          onDone={() => setEditing(null)}
                          onSaved={invalidate}
                        />
                      </div>
                    )
                  }

                  return (
                    <div
                      key={groupId}
                      className={cn(
                        'group/card',
                        draggingId === groupId && 'opacity-40'
                      )}
                      draggable={dragArmedId === groupId}
                      onDragStart={() => setDraggingId(groupId)}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDropTargetId(null)
                        setDragArmedId(null)
                      }}
                      onDragOver={(e) => {
                        if (draggingId == null || draggingId === groupId)
                          return
                        e.preventDefault()
                        setDropTargetId(groupId)
                      }}
                      onDragLeave={() =>
                        setDropTargetId((current) =>
                          current === groupId ? null : current
                        )
                      }
                      onDrop={() => handleDrop(groupId)}
                    >
                      {index > 0 && <Separator className='my-4' />}
                      <div
                        className={cn(
                          '-mx-1 rounded-md px-1 transition-colors',
                          dropTargetId === groupId && 'bg-primary/5'
                        )}
                      >
                        <div className='flex items-start justify-between gap-2'>
                          <div className='flex min-w-0 items-start gap-1.5'>
                            {/* Grip arms native drag for this group only */}
                            <button
                              type='button'
                              aria-label={t('reorder')}
                              className='text-muted-foreground/40 hover:text-muted-foreground mt-0.5 cursor-grab active:cursor-grabbing'
                              onMouseDown={() => setDragArmedId(groupId)}
                              onMouseUp={() => setDragArmedId(null)}
                            >
                              <GripVertical className='h-4 w-4' />
                            </button>
                            <div className='min-w-0'>
                              <h4 className='truncate text-sm font-semibold'>
                                {localized(group.name)}
                              </h4>
                              <p className='text-muted-foreground text-xs'>
                                {group.isRequired
                                  ? t('required')
                                  : t('optional')}
                                {' · '}
                                {multiple
                                  ? t('multipleChoice')
                                  : t('singleChoice')}
                              </p>
                            </div>
                          </div>
                          <div className='flex shrink-0 gap-0.5 opacity-40 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100'>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='size-7'
                              aria-label={`${t('edit')} ${localized(group.name)}`}
                              onClick={() => setEditing(groupId)}
                            >
                              <Pencil className='h-3.5 w-3.5' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='hover:text-destructive size-7'
                              aria-label={`${t('delete')} ${localized(group.name)}`}
                              onClick={() => setDeletingGroup(group)}
                            >
                              <Trash2 className='h-3.5 w-3.5' />
                            </Button>
                          </div>
                        </div>

                        <div className='mt-2.5 flex flex-col gap-2 ps-[22px]'>
                          {options.map((option) => (
                            <div
                              key={String(option.id)}
                              className='flex items-center gap-2.5 text-sm'
                            >
                              <ChoiceGlyph
                                multiple={multiple}
                                selected={option.isDefault ?? false}
                              />
                              <span className='min-w-0 flex-1 truncate'>
                                {localized(option.name)}
                              </span>
                              <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
                                {formatAdjustment(
                                  Number(option.priceAdjustment ?? 0),
                                  t
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {editing === 'new' && (
                  <div>
                    {sortedGroups.length > 0 && <Separator className='my-4' />}
                    <GroupEditor
                      itemId={itemId}
                      group={null}
                      existingCount={groups.length}
                      onDone={() => setEditing(null)}
                      onSaved={invalidate}
                    />
                  </div>
                )}
              </div>
            )}

            {editing !== 'new' && (
              <Button
                variant='outline'
                className={cn(
                  'text-muted-foreground hover:text-foreground w-full border-dashed',
                  (sortedGroups.length > 0 || editing != null) && 'mt-6'
                )}
                onClick={() => setEditing('new')}
              >
                <Plus className='me-2 h-4 w-4' />
                {t('addCustomization')}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DeleteConfirmDialog
        open={!!deletingGroup}
        onOpenChange={() => setDeletingGroup(null)}
        onConfirm={() =>
          deletingGroup &&
          deleteGroup.mutate({
            path: { id: itemId, customizationId: Number(deletingGroup.id) },
            query: { 'api-version': API_VERSION },
          })
        }
        title={t('deleteCustomizationConfirm')}
        itemName={localized(deletingGroup?.name)}
        isLoading={deleteGroup.isPending}
      />
    </>
  )
}

type OptionRow = {
  nameEn: string
  nameAr: string
  priceAdjustment: number
  isDefault: boolean
}

const emptyOption: OptionRow = {
  nameEn: '',
  nameAr: '',
  priceAdjustment: 0,
  isDefault: false,
}

/** The group form, inline in the sheet where the group's card was. */
function GroupEditor({
  itemId,
  group,
  existingCount,
  onDone,
  onSaved,
}: {
  itemId: number
  group: ItemCustomizationDto | null
  existingCount: number
  onDone: () => void
  onSaved: () => void
}) {
  const t = useT()
  const isEditing = !!group

  const [nameEn, setNameEn] = useState(group?.name?.en ?? '')
  const [nameAr, setNameAr] = useState(group?.name?.ar ?? '')
  const [isRequired, setIsRequired] = useState(group?.isRequired ?? false)
  const [allowMultiple, setAllowMultiple] = useState(
    group?.allowMultiple ?? false
  )
  const [options, setOptions] = useState<OptionRow[]>(
    group?.options?.length
      ? group.options
          .slice()
          .sort(
            (a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
          )
          .map((option) => ({
            nameEn: option.name?.en ?? '',
            nameAr: option.name?.ar ?? '',
            priceAdjustment: Number(option.priceAdjustment ?? 0),
            isDefault: option.isDefault ?? false,
          }))
      : [{ ...emptyOption }]
  )
  const [error, setError] = useState<string | null>(null)

  const createGroup = useMutation(createCustomizationMutation())
  const updateGroup = useMutation(updateCustomizationMutation())
  const isSaving = createGroup.isPending || updateGroup.isPending

  const updateOption = (index: number, patch: Partial<OptionRow>) => {
    setOptions((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  // Single-choice groups can only have one default option
  const setDefault = (index: number, isDefault: boolean) => {
    setOptions((rows) =>
      rows.map((row, i) => ({
        ...row,
        isDefault:
          i === index ? isDefault : allowMultiple ? row.isDefault : false,
      }))
    )
  }

  const handleSubmit = async () => {
    if (!nameEn.trim()) {
      setError(t('englishNameRequired'))
      return
    }
    const validOptions = options.filter((option) => option.nameEn.trim())
    if (validOptions.length === 0) {
      setError(t('optionRequired'))
      return
    }
    setError(null)

    const body: ItemCustomization = {
      catalogItemId: itemId,
      name: { en: nameEn.trim(), ar: nameAr.trim() || null },
      isRequired,
      allowMultiple,
      displayOrder: group?.displayOrder ?? existingCount,
      options: validOptions.map((option, index) => ({
        name: { en: option.nameEn.trim(), ar: option.nameAr.trim() || null },
        priceAdjustment: option.priceAdjustment,
        isDefault: option.isDefault,
        displayOrder: index,
      })),
    }

    try {
      if (isEditing) {
        await updateGroup.mutateAsync({
          path: { id: itemId, customizationId: Number(group.id) },
          body,
          query: { 'api-version': API_VERSION },
        })
      } else {
        await createGroup.mutateAsync({
          path: { id: itemId },
          body,
          query: { 'api-version': API_VERSION },
        })
      }
      onSaved()
      toast.success(t('customizationSaved'))
      onDone()
    } catch {
      toast.error(t('failedToSaveCustomization'))
    }
  }

  return (
    <div className='bg-muted/30 space-y-3 rounded-lg border p-3'>
      <div className='grid grid-cols-2 gap-2'>
        <div className='space-y-1'>
          <Label className='text-xs'>{t('nameEnglish')}</Label>
          <Input
            className='h-8'
            placeholder='Size'
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            autoFocus
          />
        </div>
        <div className='space-y-1'>
          <Label className='text-xs'>{t('nameArabic')}</Label>
          <Input
            className='h-8'
            dir='rtl'
            placeholder='الحجم'
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
          />
        </div>
      </div>

      <div className='flex gap-4'>
        <label className='flex items-center gap-2 text-sm'>
          <Switch checked={isRequired} onCheckedChange={setIsRequired} />
          {t('required')}
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <Switch
            checked={allowMultiple}
            onCheckedChange={(checked) => {
              setAllowMultiple(checked)
              // Collapsing to single-choice keeps only the first default
              if (!checked) {
                setOptions((rows) => {
                  const firstDefault = rows.findIndex((row) => row.isDefault)
                  return rows.map((row, i) => ({
                    ...row,
                    isDefault: i === firstDefault,
                  }))
                })
              }
            }}
          />
          {t('allowMultiple')}
        </label>
      </div>

      <div className='space-y-1.5'>
        <div className='text-muted-foreground grid grid-cols-[1fr_1fr_64px_36px_28px] items-center gap-1.5 px-0.5 text-xs'>
          <span>{t('english')}</span>
          <span>{t('arabic')}</span>
          <span>± {t('currency')}</span>
          <span className='text-center'>{t('defaultOption')}</span>
          <span />
        </div>
        {options.map((option, index) => (
          <div
            key={index}
            className='grid grid-cols-[1fr_1fr_64px_36px_28px] items-center gap-1.5'
          >
            <Input
              className='h-8'
              placeholder='Small'
              value={option.nameEn}
              onChange={(e) => updateOption(index, { nameEn: e.target.value })}
            />
            <Input
              className='h-8'
              dir='rtl'
              placeholder='صغير'
              value={option.nameAr}
              onChange={(e) => updateOption(index, { nameAr: e.target.value })}
            />
            <Input
              className='h-8 tabular-nums'
              type='number'
              step='0.5'
              value={option.priceAdjustment}
              onChange={(e) =>
                updateOption(index, {
                  priceAdjustment: parseFloat(e.target.value) || 0,
                })
              }
            />
            <div className='flex justify-center'>
              <Checkbox
                checked={option.isDefault}
                onCheckedChange={(checked) => setDefault(index, !!checked)}
                aria-label={t('defaultOption')}
              />
            </div>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='size-7'
              aria-label={t('removeOption')}
              disabled={options.length === 1}
              onClick={() =>
                setOptions((rows) => rows.filter((_, i) => i !== index))
              }
            >
              <X className='h-3.5 w-3.5' />
            </Button>
          </div>
        ))}
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='text-muted-foreground h-7'
          onClick={() => setOptions((rows) => [...rows, { ...emptyOption }])}
        >
          <Plus className='me-1 h-3.5 w-3.5' />
          {t('addOption')}
        </Button>
      </div>

      {error && <p className='text-destructive text-xs'>{error}</p>}

      <div className='flex justify-end gap-2 pt-1'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={onDone}
          disabled={isSaving}
        >
          {t('cancel')}
        </Button>
        <Button type='button' size='sm' onClick={handleSubmit} disabled={isSaving}>
          {isSaving && <Loader2 className='me-1.5 h-3.5 w-3.5 animate-spin' />}
          {isEditing ? t('update') : t('add')}
        </Button>
      </div>
    </div>
  )
}
