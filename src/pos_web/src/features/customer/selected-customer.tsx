import { useState } from 'react'
import { User, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SaleCustomer } from '@/features/sale/cart'
import { useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { CustomerCard, type CardCustomer } from './customer-card'
import { useLoyalty } from './use-customer-card'

/**
 * The attached customer's points under their name — information only:
 * points are earned and spent in the customer app, the till never touches
 * them. Quiet when they never joined.
 */
function CustomerPointsLine({ userId }: { userId: string }) {
  const t = useT()
  const { account, notEnrolled } = useLoyalty(userId)
  if (!account && !notEnrolled) return null
  return (
    <span className='text-muted-foreground block truncate text-xs tabular-nums'>
      {notEnrolled
        ? t('notEnrolled')
        : t('pointsBalance', { points: toNumber(account?.pointsBalance) })}
    </span>
  )
}

/**
 * "Choose customer (optional)": the way into the customer picker wherever
 * a sale or a bill can be for someone — the sale pad and the new-bill
 * dialog open the same picker from the same button.
 */
export function ChooseCustomerButton({ onClick }: { onClick: () => void }) {
  const t = useT()
  return (
    <Button
      variant='outline'
      className='h-12 w-full gap-2 text-base'
      onClick={onClick}
    >
      <UserPlus className='size-5' />
      {t('chooseCustomer')}
      <span className='text-muted-foreground font-normal'>
        ({t('optional')})
      </span>
    </Button>
  )
}

/**
 * The picked customer, shown the same way on the sale pad and in the
 * new-bill dialog: an account taps open its card (points and tab at a
 * glance) with the points under the name; a bare name is just the name.
 * The cross takes them off.
 */
export function SelectedCustomer({
  customer,
  onRemove,
}: {
  customer: SaleCustomer
  onRemove: () => void
}) {
  const t = useT()
  const features = useFeatures()
  const [cardFor, setCardFor] = useState<CardCustomer | null>(null)

  return (
    <div className='bg-accent/50 flex items-center justify-between gap-1 rounded-lg py-1 ps-3'>
      {customer.id ? (
        <button
          type='button'
          className='flex min-w-0 flex-1 items-center gap-2 text-start'
          onClick={() =>
            setCardFor({
              id: customer.id!,
              name: customer.name,
              phone: customer.phone,
            })
          }
        >
          <User className='size-4 shrink-0' />
          <span className='min-w-0'>
            <span className='block truncate font-medium'>{customer.name}</span>
            {features.loyalty && <CustomerPointsLine userId={customer.id} />}
          </span>
        </button>
      ) : (
        <span className='flex min-w-0 items-center gap-2'>
          <User className='size-4 shrink-0' />
          <span className='truncate font-medium'>{customer.name}</span>
        </span>
      )}
      <Button
        variant='ghost'
        size='icon'
        className='size-10 shrink-0'
        aria-label={t('removeCustomer')}
        onClick={onRemove}
      >
        <X className='size-4' />
      </Button>
      <CustomerCard
        customer={cardFor}
        onOpenChange={(open) => !open && setCardFor(null)}
      />
    </div>
  )
}
