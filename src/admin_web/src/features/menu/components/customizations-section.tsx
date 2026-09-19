import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  GripVertical,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sparkles,
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
import { useCurrencyLabel } from '@/lib/currency'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
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
  LocalizedFields,
  LocalizedInput,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'
import { useCustomizationsAssist } from '@/features/assist/use-customizations-assist'
import {
  bodyFromDraft,
  ChoiceGlyph,
  DraftCard,
  emptyOption,
  formatAdjustment,
  fromProposal,
  type DraftGroup,
  type OptionRow,
} from './customization-draft'
import { DeleteConfirmDialog } from './delete-confirm-dialog'

type CustomizationsSectionProps = {
  item: CatalogItemDto
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
  const currency = useCurrencyLabel()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const itemId = Number(item.id)

  // null = browsing, 'new' = creating, number = editing that group id,
  // { draft } = editing one of the assistant's proposals before adding it
  const [editing, setEditing] = useState<
    number | 'new' | { draft: number } | null
  >(null)
  const [deletingGroup, setDeletingGroup] =
    useState<ItemCustomizationDto | null>(null)

  // The assistant's proposals wait here until each is added or discarded;
  // asking again replaces them
  const assist = useCustomizationsAssist()
  const [drafts, setDrafts] = useState<DraftGroup[]>([])
  const [addingDraft, setAddingDraft] = useState<number | 'all' | null>(null)
  const editingDraft =
    editing !== null && typeof editing === 'object' ? editing.draft : null

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
  const createGroup = useMutation(createCustomizationMutation())

  const askAssistant = async () => {
    try {
      const base = item.base ?? item
      const result = await assist.suggest({
        name: toLocalizedValue(item.name),
        description: toLocalizedValue(item.description),
        catalogTypeId: toNumber(item.catalogTypeId),
        price: toNumber(base.price),
        existingGroups: groups.map((group) => group.name),
      })
      setDrafts(result.groups.map(fromProposal))
      setEditing(null)
      if (result.groups.length === 0) toast.info(t('assistNothingToSuggest'))
      for (const warning of result.warnings) toast.warning(warning)
    } catch {
      // toasted by the hook
    }
  }

  const discardDraft = (index: number) =>
    setDrafts((prev) => prev.filter((_, i) => i !== index))

  /** Saves the proposals at these positions, in order, after the groups the item has */
  const addDrafts = async (indexes: number[]) => {
    setAddingDraft(indexes.length === 1 ? indexes[0] : 'all')
    const added: number[] = []
    try {
      for (const [k, index] of indexes.entries()) {
        await createGroup.mutateAsync({
          path: { id: itemId },
          body: bodyFromDraft(itemId, drafts[index], groups.length + k),
          query: { 'api-version': API_VERSION },
        })
        added.push(index)
      }
      toast.success(t('customizationSaved'))
    } catch {
      toast.error(t('failedToSaveCustomization'))
    } finally {
      setAddingDraft(null)
      if (added.length > 0) {
        setDrafts((prev) => prev.filter((_, i) => !added.includes(i)))
        invalidate()
      }
    }
  }

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
        ) : sortedGroups.length === 0 &&
          editing !== 'new' &&
          drafts.length === 0 ? (
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
                          <h4 className='truncate text-sm font-medium'>
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
                              currency
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

            {drafts.length > 0 && (
              <div
                className={cn(
                  'border-primary/30 bg-primary/5 space-y-3 rounded-lg border p-3',
                  (sortedGroups.length > 0 || editing === 'new') && 'mt-4'
                )}
              >
                <div className='flex items-center justify-between gap-2'>
                  <p className='text-primary flex items-center gap-1 text-xs'>
                    <Sparkles className='size-3 shrink-0' aria-hidden />
                    {t('assistSuggestedCustomizations')}
                  </p>
                  <div className='flex shrink-0 gap-1'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='text-muted-foreground h-7'
                      disabled={addingDraft != null}
                      onClick={() => setDrafts([])}
                    >
                      {t('discardAll')}
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      className='h-7'
                      disabled={addingDraft != null || editingDraft != null}
                      onClick={() => addDrafts(drafts.map((_, i) => i))}
                    >
                      {addingDraft === 'all' && (
                        <Spinner className='me-1.5 size-3.5' />
                      )}
                      {t('addAll')}
                    </Button>
                  </div>
                </div>
                {drafts.map((draft, index) =>
                  editingDraft === index ? (
                    <GroupEditor
                      key={index}
                      itemId={itemId}
                      group={null}
                      initial={draft}
                      existingCount={groups.length}
                      onDone={() => setEditing(null)}
                      onSaved={() => {
                        discardDraft(index)
                        invalidate()
                      }}
                    />
                  ) : (
                    <DraftCard
                      key={index}
                      draft={draft}
                      actions={
                        <DraftActions
                          name={localized(draft.name)}
                          adding={
                            addingDraft === index || addingDraft === 'all'
                          }
                          disabled={addingDraft != null}
                          onAdd={() => addDrafts([index])}
                          onEdit={() => setEditing({ draft: index })}
                          onDiscard={() => discardDraft(index)}
                        />
                      }
                    />
                  )
                )}
              </div>
            )}
          </div>
        )}

        {editing !== 'new' && (
          <div
            className={cn(
              'flex gap-2',
              (sortedGroups.length > 0 ||
                editing != null ||
                drafts.length > 0) &&
                'mt-6'
            )}
          >
            <Button
              variant='outline'
              className='text-muted-foreground hover:text-foreground flex-1 border-dashed'
              onClick={() => setEditing('new')}
            >
              <Plus className='me-2 h-4 w-4' />
              {t('addCustomization')}
            </Button>
            {assist.available && (
              <Button
                type='button'
                variant='outline'
                className='text-primary hover:text-primary border-dashed'
                title={t('assistSuggestCustomizations')}
                disabled={assist.isPending || addingDraft != null}
                onClick={askAssistant}
              >
                {assist.isPending ? (
                  <Spinner className='me-2 size-4' />
                ) : (
                  <Sparkles className='me-2 h-4 w-4' />
                )}
                {t('assistSuggest')}
              </Button>
            )}
          </div>
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

/** Add / edit / discard, on one of the assistant's proposals. */
function DraftActions({
  name,
  adding,
  disabled,
  onAdd,
  onEdit,
  onDiscard,
}: {
  name: string
  adding: boolean
  disabled: boolean
  onAdd: () => void
  onEdit: () => void
  onDiscard: () => void
}) {
  const t = useT()
  return (
    <>
      <Button
        type='button'
        size='sm'
        className='h-7'
        disabled={disabled}
        onClick={onAdd}
      >
        {adding && <Spinner className='me-1.5 size-3.5' />}
        {t('add')}
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-7'
        aria-label={`${t('edit')} ${name}`}
        disabled={disabled}
        onClick={onEdit}
      >
        <Pencil className='h-3.5 w-3.5' />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='hover:text-destructive size-7'
        aria-label={`${t('discard')} ${name}`}
        disabled={disabled}
        onClick={onDiscard}
      >
        <X className='h-3.5 w-3.5' />
      </Button>
    </>
  )
}

/** The group form, inline in the sheet where the group's card was. */
function GroupEditor({
  itemId,
  group,
  initial,
  existingCount,
  onDone,
  onSaved,
}: {
  itemId: number
  group: ItemCustomizationDto | null
  /** A new group's starting values (one of the assistant's proposals) */
  initial?: DraftGroup
  existingCount: number
  onDone: () => void
  onSaved: () => void
}) {
  const t = useT()
  const currency = useCurrencyLabel()
  const isEditing = !!group

  const [name, setName] = useState<LocalizedValue>(
    () => initial?.name ?? toLocalizedValue(group?.name)
  )
  const [isRequired, setIsRequired] = useState(
    initial?.isRequired ?? group?.isRequired ?? false
  )
  const [allowMultiple, setAllowMultiple] = useState(
    initial?.allowMultiple ?? group?.allowMultiple ?? false
  )
  const [options, setOptions] = useState<OptionRow[]>(
    initial?.options.length
      ? initial.options
      : group?.options?.length
        ? group.options
            .slice()
            .sort(
              (a, b) =>
                Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
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
    if (!options.some((option) => option.name.en.trim())) {
      setError(t('optionRequired'))
      return
    }
    setError(null)

    const body = bodyFromDraft(
      itemId,
      { name, isRequired, allowMultiple, options },
      Number(group?.displayOrder ?? existingCount)
    )

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
            <span>± {currency}</span>
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
