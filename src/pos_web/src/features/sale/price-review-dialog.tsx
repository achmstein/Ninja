import { AlertTriangle, ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney } from '@/lib/money'
import type { SaleLine } from './cart'
import type { PriceReview } from './use-branch-price-check'

/**
 * Before a phone delivery goes to another branch: what that branch's menu
 * says differently, line by line ("Latte 65 → 70 at Maadi", "Cheesecake: sold
 * out at Maadi"). The cashier sends it at that branch's prices, without what
 * it ran out of, or keeps it here.
 */
export function PriceReviewDialog({
  review,
  branch,
  onUse,
  onKeepHere,
  onClose,
}: {
  review: PriceReview | null
  /** The other branch's name */
  branch: string
  onUse: (lines: SaleLine[]) => void
  onKeepHere: () => void
  onClose: () => void
}) {
  const t = useT()
  const money = useMoney()
  const localized = useLocalized()
  const nameOf = (line: SaleLine) => localized({ en: line.nameEn, ar: line.nameAr })
  const optionNames = (line: SaleLine, optionIds: number[]) =>
    line.customizations
      .filter((c) => optionIds.includes(c.optionId))
      .map((c) => localized({ en: c.optionNameEn, ar: c.optionNameAr ?? '' }))
      .join('، ')
  const nothingLeft = review != null && review.lines.length === 0
  const drops = review?.items.some((i) => i.kind !== 'changed') ?? false

  return (
    <Dialog open={review != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ArrowRightLeft className='size-5' aria-hidden />
            {t('priceReviewTitle', { branch })}
          </DialogTitle>
          {drops && !nothingLeft && <DialogDescription>{t('priceReviewDropped')}</DialogDescription>}
        </DialogHeader>
        <ul className='flex flex-col gap-1.5 text-sm'>
          {review?.items.map((item) => (
            <li key={item.key} className='flex items-start gap-2 rounded-md bg-muted px-2.5 py-2'>
              {item.kind !== 'changed' && <AlertTriangle className='mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400' aria-hidden />}
              <span className='tabular-nums'>
                {item.kind === 'changed'
                  ? t('priceReviewChanged', { item: nameOf(item.line), from: money(item.from), to: money(item.to), branch })
                  : item.kind === 'soldOut'
                    ? t('priceReviewSoldOut', { item: nameOf(item.line), branch })
                    : t('priceReviewOptionsOut', { item: nameOf(item.line), options: optionNames(item.line, item.optionIds), branch })}
              </span>
            </li>
          ))}
        </ul>
        {nothingLeft && (
          <p role='alert' className='text-sm text-amber-700 dark:text-amber-400'>
            {t('priceReviewNothingLeft', { branch })}
          </p>
        )}
        <DialogFooter className='gap-2 sm:gap-2'>
          <Button variant='outline' className='h-12' onClick={onKeepHere}>
            {t('deliveryKeepHere')}
          </Button>
          <Button className='h-12' disabled={nothingLeft} onClick={() => review && onUse(review.lines)}>
            {t('priceReviewUse', { branch })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
