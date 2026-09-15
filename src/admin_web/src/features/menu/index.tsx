import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  Coffee,
  CookingPot,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  ScanLine,
  Search,
  Tag,
  Trash2,
} from 'lucide-react'
import { type CatalogItemDto, type CatalogTypeDto } from '@/api/catalog'
import {
  deleteCategoryMutation,
  deleteItemMutation,
  listCategoriesOptions,
  listCategoriesQueryKey,
  listItemsOptions,
  listItemsQueryKey,
  reorderCategoriesMutation,
  reorderItemsMutation,
  toggleItemAvailabilityMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { SCAN_ACCEPT } from '@/lib/image'
import { formatEgp, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ImageWithFallback } from '@/components/image-fallback'
import { Grip, Sortable } from '@/components/sortable'
import {
  type StockRuleBadge,
  useStockRuleBadges,
} from '@/features/inventory/stock-rules'
import { CategoryDialog } from './components/category-dialog'
import { DeleteConfirmDialog } from './components/delete-confirm-dialog'
import { ItemSheet, type ItemSheetState } from './components/item-sheet'
import { MenuReviewSheet } from './components/menu-review-sheet'
import { MenuPage } from './menu-page'
import { itemPictureUrl } from './pictures'
import { useMenuScan } from './use-menu-scan'

const route = getRouteApi('/_authenticated/menu/')

const ITEMS_KEY = listItemsQueryKey({ query: { 'api-version': API_VERSION } })
const CATEGORIES_KEY = listCategoriesQueryKey({
  query: { 'api-version': API_VERSION },
})

const NO_ITEMS: CatalogItemDto[] = []
const NO_CATEGORIES: CatalogTypeDto[] = []

type Section = {
  /** `null` for items whose category no longer exists */
  category: CatalogTypeDto | null
  items: CatalogItemDto[]
}

/**
 * The menu as customers see it: every category in display order with its
 * items under it. Categories are managed from their heading, items open
 * on click, both are reordered by dragging the grip; the only other control
 * on a row is the availability switch.
 */
export function MenuManagement() {
  const t = useT()
  const localized = useLocalized()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()

  const [sheet, setSheet] = useState<ItemSheetState>(null)
  const [deleteItem, setDeleteItem] = useState<CatalogItemDto | null>(null)
  const [categoryDialog, setCategoryDialog] = useState<{
    category: CatalogTypeDto | null
  } | null>(null)
  const [deleteCategory, setDeleteCategory] = useState<CatalogTypeDto | null>(
    null
  )

  // A photo of a menu becomes a proposal the review sheet turns into
  // categories and items; hidden when the assistant is not set up
  const scan = useMenuScan()
  const scanInputRef = useRef<HTMLInputElement>(null)

  const itemsQuery = useQuery(
    listItemsOptions({ query: { 'api-version': API_VERSION } })
  )
  const items = itemsQuery.data ?? NO_ITEMS
  // Which items the storeroom tracks, and what a sale of each costs here
  const prices = useMemo(
    () =>
      new Map(items.map((item) => [toNumber(item.id), toNumber(item.price)])),
    [items]
  )
  const stockRules = useStockRuleBadges(prices)
  const categoriesQuery = useQuery(
    listCategoriesOptions({ query: { 'api-version': API_VERSION } })
  )
  const categories = categoriesQuery.data ?? NO_CATEGORIES
  const orderedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) => toNumber(a.displayOrder) - toNumber(b.displayOrder)
      ),
    [categories]
  )

  const query = (search.q ?? '').trim().toLowerCase()
  const sections = useMemo<Section[]>(() => {
    const matches = (item: CatalogItemDto) =>
      !query ||
      (item.name?.en ?? '').toLowerCase().includes(query) ||
      (item.name?.ar ?? '').toLowerCase().includes(query)
    const byOrder = (a: CatalogItemDto, b: CatalogItemDto) =>
      toNumber(a.displayOrder) - toNumber(b.displayOrder) ||
      localized(a.name).localeCompare(localized(b.name))
    const known = new Set(categories.map((c) => toNumber(c.id)))
    const result: Section[] = orderedCategories.map((category) => ({
      category,
      items: items
        .filter((i) => toNumber(i.catalogTypeId) === toNumber(category.id))
        .filter(matches)
        .sort(byOrder),
    }))
    const orphans = items
      .filter((i) => !known.has(toNumber(i.catalogTypeId)))
      .filter(matches)
      .sort(byOrder)
    if (orphans.length > 0) result.push({ category: null, items: orphans })
    // While searching, only categories with a hit are worth the space
    return query ? result.filter((s) => s.items.length > 0) : result
  }, [items, categories, orderedCategories, query, localized])

  const invalidateItems = () =>
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] })
  const invalidateCategories = () =>
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listCategories' }] })

  // Availability flips optimistically: update the cached list first, roll
  // back if the server rejects it.
  const toggleAvailability = useMutation({
    ...toggleItemAvailabilityMutation(),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ITEMS_KEY })
      const previous = queryClient.getQueryData<CatalogItemDto[]>(ITEMS_KEY)
      queryClient.setQueryData<CatalogItemDto[]>(ITEMS_KEY, (old) =>
        old?.map((item) =>
          Number(item.id) === variables.path.id
            ? { ...item, isAvailable: variables.body?.isAvailable ?? false }
            : item
        )
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ITEMS_KEY, context.previous)
      }
      toast.error(t('failedToUpdateAvailability'))
    },
    onSettled: () => invalidateItems(),
  })

  const deleteItemMut = useMutation({
    ...deleteItemMutation(),
    onSuccess: () => {
      invalidateItems()
      toast.success(t('itemDeleted'))
      setDeleteItem(null)
      setSheet(null)
    },
    onError: () => toast.error(t('failedToDeleteItem')),
  })

  const deleteCategoryMut = useMutation({
    ...deleteCategoryMutation(),
    onSuccess: () => {
      invalidateCategories()
      toast.success(t('categoryDeletedSuccess'))
      setDeleteCategory(null)
    },
    onError: () => toast.error(t('failedToDeleteCategory')),
  })

  // Reorders are applied to the cache as the drop lands, so nothing snaps
  // back while the request is in flight; a failure refetches the truth.
  const reorderCategoriesMut = useMutation({
    ...reorderCategoriesMutation(),
    onError: () => {
      toast.error(t('somethingWentWrong'))
      invalidateCategories()
    },
  })

  const reorderItemsMut = useMutation({
    ...reorderItemsMutation(),
    onError: () => {
      toast.error(t('somethingWentWrong'))
      invalidateItems()
    },
  })

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a plain click on the
    // grip does nothing surprising
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const onCategoryDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = orderedCategories.findIndex((c) => `cat-${c.id}` === active.id)
    const to = orderedCategories.findIndex((c) => `cat-${c.id}` === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(orderedCategories, from, to).map(
      (c, displayOrder) => ({ ...c, displayOrder })
    )
    queryClient.setQueryData<CatalogTypeDto[]>(CATEGORIES_KEY, next)
    reorderCategoriesMut.mutate({
      body: {
        items: next.map((c) => ({ id: c.id, displayOrder: c.displayOrder })),
      },
      query: { 'api-version': API_VERSION },
    })
  }

  const onItemDragEnd = (section: Section, { active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = section.items.findIndex((i) => `item-${i.id}` === active.id)
    const to = section.items.findIndex((i) => `item-${i.id}` === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(section.items, from, to).map((i, displayOrder) => ({
      ...i,
      displayOrder,
    }))
    const order = new Map(next.map((i) => [toNumber(i.id), i.displayOrder]))
    queryClient.setQueryData<CatalogItemDto[]>(ITEMS_KEY, (old) =>
      old?.map((i) =>
        order.has(toNumber(i.id))
          ? { ...i, displayOrder: order.get(toNumber(i.id)) }
          : i
      )
    )
    reorderItemsMut.mutate({
      body: {
        items: next.map((i) => ({ id: i.id, displayOrder: i.displayOrder })),
      },
      query: { 'api-version': API_VERSION },
    })
  }

  const setAvailable = (item: CatalogItemDto, isAvailable: boolean) =>
    toggleAvailability.mutate({
      path: { id: Number(item.id) },
      body: { isAvailable },
      query: { 'api-version': API_VERSION },
    })

  const openItem = (item: CatalogItemDto) =>
    setSheet({ mode: 'edit', itemId: toNumber(item.id) })
  const newItem = (categoryId?: number) =>
    setSheet({ mode: 'create', categoryId })

  // A filtered list has no complete order to save, so dragging waits
  const dragDisabled = query !== ''

  return (
    <>
      <MenuPage
        tab='menu'
        actions={
          <>
            {scan.available && (
              <>
                <Button
                  variant='outline'
                  disabled={scan.isScanning}
                  onClick={() => scanInputRef.current?.click()}
                >
                  {scan.isScanning ? (
                    <Spinner className='me-2' />
                  ) : (
                    <ScanLine className='me-2 h-4 w-4' />
                  )}
                  {scan.isScanning ? t('readingMenu') : t('scanMenu')}
                </Button>
                {/* No `capture`: the native chooser offers the camera and
                    the gallery, and a menu often arrives as a photo */}
                <input
                  ref={scanInputRef}
                  type='file'
                  accept={SCAN_ACCEPT}
                  className='hidden'
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) void scan.scanFile(file)
                  }}
                />
              </>
            )}
            <Button
              variant='outline'
              onClick={() => setCategoryDialog({ category: null })}
            >
              <Tag className='me-2 h-4 w-4' />
              {t('addCategory')}
            </Button>
            <Button onClick={() => newItem()}>
              <Plus className='me-2 h-4 w-4' />
              {t('addItem')}
            </Button>
          </>
        }
      >
        <div className='relative w-full sm:w-80'>
          <Search className='text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2' />
          <Input
            value={search.q ?? ''}
            onChange={(e) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  q: e.target.value || undefined,
                }),
              })
            }
            placeholder={t('searchItemsPlaceholder')}
            className='h-9 ps-8'
          />
        </div>

        {itemsQuery.isError || categoriesQuery.isError ? (
          <ErrorState
            error={itemsQuery.error ?? categoriesQuery.error}
            onRetry={() => {
              itemsQuery.refetch()
              categoriesQuery.refetch()
            }}
          />
        ) : itemsQuery.isLoading || categoriesQuery.isLoading ? (
          <div className='space-y-6'>
            {[...Array(3)].map((_, i) => (
              <div key={i} className='space-y-2'>
                <Skeleton className='h-6 w-40' />
                <Skeleton className='h-14' />
                <Skeleton className='h-14' />
              </div>
            ))}
          </div>
        ) : sections.length === 0 ? (
          <EmptyState
            icon={Coffee}
            title={query ? t('noItemsFound') : t('noCategoriesYet')}
            action={
              query ? undefined : (
                <Button
                  variant='outline'
                  onClick={() => setCategoryDialog({ category: null })}
                >
                  <Tag className='me-2 h-4 w-4' />
                  {t('addCategory')}
                </Button>
              )
            }
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onCategoryDragEnd}
          >
            <SortableContext
              items={sections.map((s) =>
                s.category ? `cat-${s.category.id}` : 'orphans'
              )}
              strategy={verticalListSortingStrategy}
            >
              <div className='flex flex-col gap-8'>
                {sections.map((section) => {
                  const category = section.category
                  const categoryId =
                    category != null ? toNumber(category.id) : undefined
                  return (
                    <Sortable
                      key={categoryId ?? 'orphans'}
                      id={category ? `cat-${category.id}` : 'orphans'}
                      as='section'
                      disabled={dragDisabled || !category}
                      className='rounded-md'
                    >
                      {(activator, grip) => (
                        <>
                          <div className='flex items-center gap-1 border-b pb-2'>
                            {category && !dragDisabled && (
                              <Grip
                                activator={activator}
                                grip={grip}
                                label={t('dragToReorder')}
                              />
                            )}
                            <h2 className='text-base font-semibold'>
                              {category
                                ? localized(category.name)
                                : t('uncategorized')}
                            </h2>
                            <span className='text-muted-foreground ms-1 text-sm tabular-nums'>
                              {section.items.length}
                            </span>
                            {category && (
                              <div className='ms-auto flex items-center gap-1'>
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  onClick={() => newItem(categoryId)}
                                >
                                  <Plus className='me-1.5 h-4 w-4' />
                                  {t('addItem')}
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      className='size-8'
                                      aria-label={t('actions')}
                                    >
                                      <MoreHorizontal className='h-4 w-4' />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align='end'>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setCategoryDialog({ category })
                                      }
                                    >
                                      <Pencil className='h-4 w-4' />
                                      {t('editCategory')}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant='destructive'
                                      disabled={section.items.length > 0}
                                      onClick={() =>
                                        setDeleteCategory(category)
                                      }
                                    >
                                      <Trash2 className='h-4 w-4' />
                                      {t('deleteCategory')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>

                          {section.items.length === 0 ? (
                            <p className='text-muted-foreground py-4 text-sm'>
                              {t('emptyCategory')}
                            </p>
                          ) : (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(event) =>
                                onItemDragEnd(section, event)
                              }
                            >
                              <SortableContext
                                items={section.items.map((i) => `item-${i.id}`)}
                                strategy={verticalListSortingStrategy}
                              >
                                <ul className='divide-y'>
                                  {section.items.map((item) => (
                                    <MenuRow
                                      key={toNumber(item.id)}
                                      item={item}
                                      stockRule={stockRules.get(
                                        toNumber(item.id)
                                      )}
                                      draggable={!!category && !dragDisabled}
                                      onOpen={() => openItem(item)}
                                      onAvailable={(checked) =>
                                        setAvailable(item, checked)
                                      }
                                    />
                                  ))}
                                </ul>
                              </SortableContext>
                            </DndContext>
                          )}
                        </>
                      )}
                    </Sortable>
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </MenuPage>

      <ItemSheet
        state={sheet}
        items={items}
        categories={orderedCategories}
        onStateChange={setSheet}
        onDelete={setDeleteItem}
      />

      {scan.proposal && (
        <MenuReviewSheet
          proposal={scan.proposal}
          categories={orderedCategories}
          onOpenChange={(open) => {
            if (!open) scan.clearProposal()
          }}
        />
      )}

      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={() => setDeleteItem(null)}
        onConfirm={() =>
          deleteItem &&
          deleteItemMut.mutate({
            path: { id: Number(deleteItem.id) },
            query: { 'api-version': API_VERSION },
          })
        }
        itemName={localized(deleteItem?.name)}
        isLoading={deleteItemMut.isPending}
      />

      <CategoryDialog
        open={categoryDialog !== null}
        onOpenChange={(open) => {
          if (!open) setCategoryDialog(null)
        }}
        category={categoryDialog?.category ?? null}
      />

      <ConfirmDialog
        open={deleteCategory !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteCategory(null)
        }}
        destructive
        title={t('deleteCategory')}
        desc={localized(deleteCategory?.name)}
        confirmText={t('delete')}
        isLoading={deleteCategoryMut.isPending}
        handleConfirm={() =>
          deleteCategory &&
          deleteCategoryMut.mutate({
            path: { id: Number(deleteCategory.id) },
            query: { 'api-version': API_VERSION },
          })
        }
      />
    </>
  )
}

type MenuRowProps = {
  item: CatalogItemDto
  /** Set when the storeroom tracks the item */
  stockRule: StockRuleBadge | undefined
  draggable: boolean
  onOpen: () => void
  onAvailable: (checked: boolean) => void
}

/** One item: grip, the row itself opens it, and the availability switch */
function MenuRow({
  item,
  stockRule,
  draggable,
  onOpen,
  onAvailable,
}: MenuRowProps) {
  const t = useT()
  const localized = useLocalized()
  const onOffer = item.isOnOffer && item.offerPrice != null
  const description = localized(item.description)

  return (
    <Sortable
      id={`item-${item.id}`}
      as='li'
      disabled={!draggable}
      className={cn(
        'hover:bg-accent/50 -mx-2 flex items-center gap-2 rounded-md px-2',
        !item.isAvailable && 'text-muted-foreground'
      )}
    >
      {(activator, grip) => (
        <>
          {draggable && (
            <Grip
              activator={activator}
              grip={grip}
              label={t('dragToReorder')}
            />
          )}
          <button
            type='button'
            className='flex min-w-0 flex-1 items-center gap-3 py-2 text-start'
            onClick={onOpen}
          >
            <ImageWithFallback
              src={
                item.pictureUri
                  ? itemPictureUrl(item.id, item.pictureUri)
                  : null
              }
              className='h-10 w-10 shrink-0 rounded-md'
              fallbackIcon={
                <Coffee className='text-muted-foreground h-4 w-4' />
              }
            />
            <div className='min-w-0 flex-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='truncate font-medium'>
                  {localized(item.name) || '—'}
                </span>
                {item.isPopular && (
                  <Badge variant='secondary'>{t('popular')}</Badge>
                )}
                {item.isOutOfStock && (
                  <Badge variant='destructive'>{t('outOfStock')}</Badge>
                )}
                {stockRule && (
                  <Badge
                    variant='outline'
                    className={cn(
                      'gap-1 font-normal',
                      stockRule.overTarget &&
                        'border-destructive text-destructive'
                    )}
                    title={
                      stockRule.kind === 'unit'
                        ? t('soldAsUnitBadge')
                        : t('usesIngredientsBadge')
                    }
                  >
                    {stockRule.kind === 'unit' ? (
                      <Package className='size-3' aria-hidden />
                    ) : (
                      <CookingPot className='size-3' aria-hidden />
                    )}
                    {t('tracked')}
                    {stockRule.foodCost !== null && (
                      <span className='tabular-nums'>
                        · {stockRule.foodCost}%{stockRule.incomplete && '+'}
                      </span>
                    )}
                  </Badge>
                )}
              </div>
              {description && (
                <div className='text-muted-foreground truncate text-xs'>
                  {description}
                </div>
              )}
            </div>
            <div className='shrink-0 text-end tabular-nums'>
              <div className='font-medium'>
                {formatEgp(onOffer ? item.offerPrice : item.price)}
              </div>
              {onOffer && (
                <div className='text-muted-foreground text-xs line-through'>
                  {formatEgp(item.price)}
                </div>
              )}
            </div>
          </button>

          <Switch
            checked={!!item.isAvailable}
            onCheckedChange={onAvailable}
            aria-label={`${t('availability')}: ${localized(item.name)}`}
            className='me-1'
          />
        </>
      )}
    </Sortable>
  )
}
