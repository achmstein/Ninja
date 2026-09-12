import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  GripVertical,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
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
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  fromLocalizedValue,
  LocalizedFields,
  LocalizedInput,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'
import { DeleteConfirmDialog } from './delete-confirm-dialog'

type CustomizationsSectionProps = {
  item: CatalogItemDto
}

// Free options show nothing — pricing only appears where it differs
function formatAdjustment(value: number, t: ReturnType<typeof useT>): string {
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
        selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
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
      .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
      .map((option, index) => ({
        name: { en: option.name?.en ?? '', ar: option.name?.ar ?? null },
        priceAdjustment: Number(option.priceAdjustment ?? 0),
        isDefault: option.isDefault ?? false,
        displayOrder: index,
      })),
  }
}

/**
 * The groups a customer picks from (size, roast, extras), listed with their
 * options; groups edit inline and reorder by dragging the grip.
 */
export function CustomizationsSection({ item }: CustomizationsSectionProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const itemId = Number(item.id)

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

  return (
    <>
      <div>
        {isLoading ? (
          <div className='flex justify-center py-6'>
            <Spinner className='text-muted-foreground size-5' />
          </div>
        ) : sortedGroups.length === 0 && editing !== 'new' ? (
          <div className='text-muted-foreground flex flex-col items-center gap-2 py-6 text-center'>
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
                    Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
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
                    if (draggingId == null || draggingId === groupId) return
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
                            {group.isRequired ? t('required') : t('optional')}
                            {' · '}
                            {multiple ? t('multipleChoice') : t('singleChoice')}
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
                          {option.isOutOfStock && (
                            // Set by Inventory for the active branch;
                            // read-only here — it clears when the
                            // ingredient is back
                            <Badge
                              variant='outline'
                              className='text-destructive border-destructive/40 shrink-0'
                            >
                              {t('outOfStock')}
                            </Badge>
                          )}
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
  name: LocalizedValue
  priceAdjustment: number
  isDefault: boolean
}

const emptyOption: OptionRow = {
  name: { en: '', ar: '' },
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

  const [name, setName] = useState<LocalizedValue>(() =>
    toLocalizedValue(group?.name)
  )
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
            name: toLocalizedValue(option.name),
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
    if (!name.en.trim()) {
      setError(t('englishNameRequired'))
      return
    }
    const validOptions = options.filter((option) => option.name.en.trim())
    if (validOptions.length === 0) {
      setError(t('optionRequired'))
      return
    }
    setError(null)

    const body: ItemCustomization = {
      catalogItemId: itemId,
      name: fromLocalizedValue(name),
      isRequired,
      allowMultiple,
      displayOrder: group?.displayOrder ?? existingCount,
      options: validOptions.map((option, index) => ({
        name: fromLocalizedValue(option.name),
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
    <LocalizedFields>
      <div className='bg-muted/30 space-y-3 rounded-lg border p-3'>
        <LocalizedInput
          label={t('name')}
          value={name}
          onChange={setName}
          placeholder={{ en: 'Size', ar: 'الحجم' }}
          compact
          autoFocus
        />

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
          <div className='text-muted-foreground grid grid-cols-[1fr_64px_36px_28px] items-center gap-1.5 px-0.5 text-xs'>
            <span>{t('name')}</span>
            <span>± {t('currency')}</span>
            <span className='text-center'>{t('defaultOption')}</span>
            <span />
          </div>
          {options.map((option, index) => (
            <div
              key={index}
              className='grid grid-cols-[1fr_64px_36px_28px] items-center gap-1.5'
            >
              <LocalizedInput
                ariaLabel={t('name')}
                value={option.name}
                onChange={(name) => updateOption(index, { name })}
                placeholder={{ en: 'Small', ar: 'صغير' }}
                compact
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
          <Button
            type='button'
            size='sm'
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving && <Spinner className='me-1.5 size-3.5' />}
            {isEditing ? t('update') : t('add')}
          </Button>
        </div>
      </div>
    </LocalizedFields>
  )
}
