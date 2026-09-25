import { useState } from 'react'
import { Smartphone } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import type { Customer } from '../types'
import { AppLinkDialog } from './app-link-dialog'

/**
 * "Send app link" in a counter customer's actions menu. The dialog sits
 * outside the menu (returned as `dialog`) so closing the menu does not
 * unmount it. Nothing for a customer who already has their own account.
 */
export function useSendAppLink(customer: Customer) {
  const t = useT()
  const [open, setOpen] = useState(false)
  if (!customer.addedAtCounter) return { item: null, dialog: null }
  return {
    item: (
      <DropdownMenuItem onClick={() => setOpen(true)}>
        <Smartphone className='h-4 w-4' />
        {t('sendAppLink')}
      </DropdownMenuItem>
    ),
    dialog: (
      <AppLinkDialog customer={customer} open={open} onOpenChange={setOpen} />
    ),
  }
}
