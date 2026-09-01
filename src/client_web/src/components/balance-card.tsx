import { Check, ChevronRight, CircleAlert, Wallet } from 'lucide-react'
import { usePrice, useT } from '@/lib/i18n'

/**
 * The app's gradient balance card (BalanceCard / transactions summary):
 * red when the customer owes, green when in credit, muted when settled.
 * `chevron` marks the tappable profile variant.
 */
export function BalanceCard({
  balance,
  chevron = false,
}: {
  balance: number
  chevron?: boolean
}) {
  const t = useT()
  const price = usePrice()

  const owes = balance > 0
  const hasCredit = balance < 0
  const settled = !owes && !hasCredit

  const cardClass = owes
    ? 'bg-gradient-to-br from-[#EF4444] to-[#DC2626] text-white shadow-[0_4px_12px_rgb(239_68_68/0.3)]'
    : hasCredit
      ? 'bg-gradient-to-br from-[#10B981] to-[#059669] text-white shadow-[0_4px_12px_rgb(16_185_129/0.3)]'
      : 'bg-muted text-foreground'
  const softText = settled ? 'text-muted-foreground' : 'text-white/70'
  const Icon = owes ? CircleAlert : hasCredit ? Check : Wallet

  return (
    <div className={`flex flex-col gap-1 rounded-2xl p-4 ${cardClass}`}>
      <div className={`flex items-center gap-2 text-sm font-medium ${softText}`}>
        <Icon className={`h-5 w-5 ${settled ? '' : 'text-white'}`} />
        <span className='flex-1'>
          {owes ? t('amountDue') : hasCredit ? t('creditBalance') : t('account')}
        </span>
        {chevron && <ChevronRight className='h-5 w-5 rtl:rotate-180' />}
      </div>
      <div className='text-[28px] leading-tight font-bold tabular-nums'>
        {price(Math.abs(balance))}
      </div>
      <p className={`text-xs ${softText}`}>
        {owes
          ? t('pleasePayAtCounter')
          : hasCredit
            ? t('willBeAppliedToNextPurchase')
            : t('noOutstandingBalance')}
      </p>
    </div>
  )
}
