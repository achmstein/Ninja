import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Coffee, X } from 'lucide-react'
import { type CatalogItemDto } from '@/api/catalog'
import { setItemPairingsMutation } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Combobox } from '@/components/combobox'
import { ImageWithFallback } from '@/components/image-fallback'
import { itemPictureUrl } from '../pictures'

/** Catalog refuses more; a handful is a suggestion, more is the menu again. */
export const MAX_PAIRINGS = 4

type PairingsSectionProps = {
  item: CatalogItemDto
  /** The whole menu, to pick from and to show what is picked */
  items: CatalogItemDto[]
}

/**
 * What this item suggests alongside it ("goes well with"), in the order the
 * customer app, the cart and the till show them. Saved as a whole list, so
 * adding, removing and reordering are one change the owner saves once.
 */
export function PairingsSection({ item, items }: PairingsSectionProps) {
  const saved = (item.pairedItemIds ?? []).map(toNumber)
  // Keyed on what is saved, so a save or a refetch starts the list over from it
  return (
    <PairingsForm
      key={saved.join(',')}
      item={item}
      items={items}
      saved={saved}
    />
  )
}

function PairingsForm({
  item,
  items,
  saved,
}: PairingsSectionProps & { saved: number[] }) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const itemId = toNumber(item.id)
  const byId = new Map(items.map((i) => [toNumber(i.id), i]))
  // A paired item deleted since drops out on its own; Catalog already dropped it
  const [ids, setIds] = useState(() => saved.filter((id) => byId.has(id)))

  const save = useMutation({
    ...setItemPairingsMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] })
      toast.success(t('pairingsSaved'))
    },
    onError: () => toast.error(t('somethingWentWrong')),
  })

  const dirty = ids.join(',') !== saved.join(',')
  const full = ids.length >= MAX_PAIRINGS
  const options = items
    .filter((i) => toNumber(i.id) !== itemId && !ids.includes(toNumber(i.id)))
    .map((i) => ({
      value: String(i.id),
      label: localized(i.name) || '—',
      hint: localized(i.catalogTypeName) || undefined,
    }))

  const move = (index: number, by: -1 | 1) =>
    setIds((current) => {
      const next = [...current]
      ;[next[index], next[index + by]] = [next[index + by], next[index]]
      return next
    })

  return (
    <div className='space-y-4'>
      <p className='text-muted-foreground text-sm'>
        {t('pairingsHint', { max: MAX_PAIRINGS })}
      </p>

      {ids.length === 0 ? (
        <p className='text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm'>
          {t('noPairings')}
        </p>
      ) : (
        <ol className='divide-y rounded-md border'>
          {ids.map((id, index) => {
            const paired = byId.get(id)
            if (!paired) return null
            return (
              <li key={id} className='flex items-center gap-3 p-2'>
                <ImageWithFallback
                  src={
                    paired.pictureUri
                      ? itemPictureUrl(paired.id, paired.pictureUri, 160)
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
                      {localized(paired.name) || '—'}
                    </span>
                    {paired.isAvailable === false && (
                      <Badge variant='outline'>{t('unavailable')}</Badge>
                    )}
                  </div>
                  <span className='text-muted-foreground text-xs tabular-nums'>
                    {formatEgp(paired.effectivePrice ?? paired.price)}
                  </span>
                </div>
                <div className='flex shrink-0 items-center'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    aria-label={t('moveUp')}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className='h-4 w-4' />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    aria-label={t('moveDown')}
                    disabled={index === ids.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className='h-4 w-4' />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='text-muted-foreground h-8 w-8'
                    aria-label={t('remove')}
                    onClick={() =>
                      setIds((current) => current.filter((c) => c !== id))
                    }
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {full ? (
        <p className='text-muted-foreground text-sm'>{t('pairingsFull')}</p>
      ) : (
        <Combobox
          value={null}
          onChange={(value) => {
            if (value) setIds((current) => [...current, Number(value)])
          }}
          options={options}
          placeholder={t('addPairing')}
          size='default'
        />
      )}

      <div className='flex justify-end'>
        <Button
          type='button'
          size='sm'
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate({
              path: { id: itemId },
              body: ids,
              query: { 'api-version': API_VERSION },
            })
          }
        >
          {save.isPending && <Spinner className='me-2' />}
          {t('save')}
        </Button>
      </div>
    </div>
  )
}
