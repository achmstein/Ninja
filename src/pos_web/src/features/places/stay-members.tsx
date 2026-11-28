import { useState } from 'react'
import { Star, User, UserPlus, X } from 'lucide-react'
import type { StayViewModel } from '@/api/spaces/types.gen'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { CustomerCard, type CardCustomer } from '@/features/customer/customer-card'
import { CustomerSearch } from '@/features/customer/customer-search'
import { useStayActions } from './use-places'

/**
 * Who is in the room: the owner starred, members removable, and a dashed
 * chip to add the next one. Members' phone orders land on the bill and
 * earn their points, and at settle each member is a tab the bill can go
 * on — which is why the till keeps naming people after the time has
 * landed: someone who never scanned the QR still owes their share.
 */
export function StayMembers({ stay }: { stay: StayViewModel }) {
  const t = useT()
  const actions = useStayActions()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [cardFor, setCardFor] = useState<CardCustomer | null>(null)
  const stayId = toNumber(stay.id)

  return (
    <>
      <div className='flex flex-wrap items-center gap-2'>
        {(stay.members ?? []).map((member) => {
          const isOwner = member.role === 'Owner'
          return (
            <Badge key={member.customerId} variant='outline' className='gap-1.5 px-3 py-1.5 text-sm'>
              {isOwner ? <Star className='size-3.5 fill-amber-400 text-amber-400' /> : <User className='size-3.5' />}
              {member.customerId ? (
                <button
                  type='button'
                  className='underline-offset-4 hover:underline'
                  onClick={() =>
                    setCardFor({
                      id: String(member.customerId),
                      name: member.customerName ?? '',
                    })
                  }
                >
                  {member.customerName || t('guest')}
                </button>
              ) : (
                member.customerName || t('guest')
              )}
              {!isOwner && member.customerId && (
                <button
                  type='button'
                  aria-label={t('memberRemove')}
                  disabled={actions.isBusy}
                  className='-me-1 flex size-6 items-center justify-center'
                  onClick={() => actions.removeMember(stayId, member.customerId!)}
                >
                  <X className='text-muted-foreground hover:text-destructive size-3.5' />
                </button>
              )}
            </Badge>
          )
        })}
        {(stay.members?.length ?? 0) === 0 && stay.customerName && (
          <span className='text-muted-foreground type-detail flex items-center gap-1'>
            <User className='size-4' />
            {stay.customerName}
          </span>
        )}
        <button
          type='button'
          disabled={actions.isBusy}
          onClick={() => setPickerOpen(true)}
          className='text-muted-foreground hover:text-foreground hover:border-foreground/40 type-detail inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed px-3 font-medium transition-colors disabled:opacity-50'
        >
          <UserPlus className='size-4' />
          {t('addCustomer')}
        </button>
      </div>

      <CustomerSearch
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        accountsOnly
        onPick={(picked) => {
          if (picked.id) actions.addMember(stayId, picked.id, picked.name)
          setPickerOpen(false)
        }}
      />
      <CustomerCard customer={cardFor} onOpenChange={(open) => !open && setCardFor(null)} />
    </>
  )
}
