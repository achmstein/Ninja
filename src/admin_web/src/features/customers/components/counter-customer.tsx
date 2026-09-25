import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AddCustomerDialog } from './add-customer-dialog'

/** Marks a customer the till added who has not claimed the account yet. */
export function AddedAtCounterBadge() {
  const t = useT()
  return (
    <Badge variant='secondary' className='mt-0.5 text-[10px] font-normal'>
      {t('addedAtCounter')}
    </Badge>
  )
}

/** The page's "Add customer", with its dialog, empty every time it opens. */
export function AddCustomerButton({
  onOpenCustomer,
}: {
  onOpenCustomer: (id: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [opening, setOpening] = useState(0)
  return (
    <>
      <Button
        size='sm'
        onClick={() => {
          setOpening((n) => n + 1)
          setOpen(true)
        }}
      >
        <UserPlus />
        {t('addCustomer')}
      </Button>
      <AddCustomerDialog
        key={opening}
        open={open}
        onOpenChange={setOpen}
        onOpenCustomer={onOpenCustomer}
      />
    </>
  )
}
