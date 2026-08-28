import { Coffee, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react'
import { type CatalogItemDto } from '@/api/catalog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ImageWithFallback } from '@/components/image-fallback'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { createAppColumnHelper } from '@/components/data-table'
import {
  type TranslationKey,
  type TranslateParams,
} from '@/lib/i18n'
import { formatEgp } from '@/features/orders/status'

const columnHelper = createAppColumnHelper<CatalogItemDto>()

// The DTO's pictureUri carries a `?v=<filename>` cache-buster that changes on
// every upload — carry it over so replaced images actually refresh.
function pictureVersion(pictureUri: string | null | undefined): string {
  const query = pictureUri?.split('?')[1]
  return query ? `?${query}` : ''
}

export function itemPictureUrl(
  id: number | string | undefined,
  pictureUri?: string | null
): string {
  return `/api/catalog/items/${id}/pic${pictureVersion(pictureUri)}`
}

export function bundlePictureUrl(
  id: number | string | undefined,
  pictureUri?: string | null
): string {
  return `/api/catalog/bundles/${id}/pic${pictureVersion(pictureUri)}`
}

type MenuColumnsCallbacks = {
  onEdit: (item: CatalogItemDto) => void
  onDelete: (item: CatalogItemDto) => void
  onCustomize: (item: CatalogItemDto) => void
  onToggleAvailability: (item: CatalogItemDto, isAvailable: boolean) => void
  t: (key: TranslationKey, params?: TranslateParams) => string
  localized: (
    text: { en?: string | null; ar?: string | null } | null | undefined
  ) => string
}

export function getMenuColumns({
  onEdit,
  onDelete,
  onCustomize,
  onToggleAvailability,
  t,
  localized,
}: MenuColumnsCallbacks) {
  return columnHelper.columns([
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          onClick={(e) => e.stopPropagation()}
          aria-label='Select row'
        />
      ),
      meta: { className: 'w-[36px]' },
    }),
    columnHelper.accessor(
      (row) => `${row.name?.en ?? ''} ${row.name?.ar ?? ''}`,
      {
        id: 'item',
        header: t('items'),
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className='flex items-center gap-3'>
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
              <div className='min-w-0'>
                <div className='flex items-center gap-2 font-medium'>
                  {localized(item.name) || '—'}
                  {item.isPopular && (
                    <Badge variant='secondary' className='text-xs'>
                      {t('popular')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )
        },
      }
    ),
    columnHelper.accessor((row) => String(row.catalogTypeId ?? ''), {
      id: 'category',
      header: t('category'),
      filterFn: 'inArray',
      cell: ({ row }) => (
        <Badge variant='outline'>
          {localized(row.original.catalogTypeName) || '—'}
        </Badge>
      ),
    }),
    columnHelper.accessor((row) => Number(row.effectivePrice ?? row.price ?? 0), {
      id: 'price',
      header: () => <div className='text-end'>{t('price')}</div>,
      sortFn: 'basic',
      cell: ({ row }) => {
        const item = row.original
        const onOffer =
          item.isOnOffer && Number(item.offerPrice ?? 0) < Number(item.price ?? 0)
        return (
          <div className='text-end tabular-nums'>
            {onOffer ? (
              <>
                <span className='font-medium'>
                  {formatEgp(item.offerPrice)}
                </span>{' '}
                <span className='text-muted-foreground text-xs line-through'>
                  {formatEgp(item.price)}
                </span>
              </>
            ) : (
              <span className='font-medium'>{formatEgp(item.price)}</span>
            )}
          </div>
        )
      },
    }),
    columnHelper.accessor((row) => Number(row.preparationTimeMinutes ?? 0), {
      id: 'prep',
      header: t('prepHeader'),
      sortFn: 'basic',
      cell: ({ row }) => {
        const minutes = row.original.preparationTimeMinutes
        return minutes ? t('prepMinutes', { minutes: Number(minutes) }) : '—'
      },
    }),
    columnHelper.accessor(
      (row) => (row.isAvailable ? 'available' : 'unavailable'),
      {
        id: 'availability',
        header: t('availableLabel'),
        filterFn: 'inArray',
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={row.original.isAvailable ?? false}
              onCheckedChange={(checked) =>
                onToggleAvailability(row.original, checked)
              }
              aria-label={`Toggle availability for ${row.original.name?.en}`}
            />
          </div>
        ),
      }
    ),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div
          className='flex justify-end gap-1'
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant='ghost'
            size='icon'
            className='size-8'
            aria-label={`Edit ${row.original.name?.en}`}
            onClick={() => onEdit(row.original)}
          >
            <Pencil className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='size-8'
            aria-label={`Customizations for ${row.original.name?.en}`}
            title='Customizations'
            onClick={() => onCustomize(row.original)}
          >
            <SlidersHorizontal className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='size-8'
            aria-label={`Delete ${row.original.name?.en}`}
            onClick={() => onDelete(row.original)}
          >
            <Trash2 className='text-destructive h-4 w-4' />
          </Button>
        </div>
      ),
      meta: { className: 'w-[124px]' },
    }),
  ])
}
