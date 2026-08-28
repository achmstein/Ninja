import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { User } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/lib/i18n'
import { accountsService } from '../services/accounts-service'
import type { KeycloakUser } from '../types'

interface CustomerSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectCustomer: (customer: KeycloakUser) => void
}

function displayName(user: KeycloakUser): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return fullName || user.username
}

/**
 * Command-palette style customer picker: type to search the identity
 * directory server-side, arrow keys + Enter to pick.
 */
export function CustomerSearchDialog({
  open,
  onOpenChange,
  onSelectCustomer,
}: CustomerSearchDialogProps) {
  const t = useT()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')

  // Debounce so every keystroke doesn't hit Keycloak
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', debouncedTerm],
    queryFn: () => accountsService.getUsers(debouncedTerm || undefined),
    enabled: open,
  })

  const handleSelect = (customer: KeycloakUser) => {
    onSelectCustomer(customer)
    onOpenChange(false)
    setSearchTerm('')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setSearchTerm('')
      }}
    >
      <DialogHeader className='sr-only'>
        <DialogTitle>{t('findRegisteredCustomer')}</DialogTitle>
        <DialogDescription>{t('searchByNameOrEmail')}</DialogDescription>
      </DialogHeader>
      <DialogContent className='overflow-hidden p-0'>
        {/* The server does the filtering; cmdk should not filter again */}
        <Command
          shouldFilter={false}
          className='[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3'
        >
          <CommandInput
            placeholder={t('searchByNameOrEmail')}
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {isLoading ? (
              <div className='space-y-2 p-3'>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className='h-10' />
                ))}
              </div>
            ) : (
              <>
                <CommandEmpty>{t('noCustomersFound')}</CommandEmpty>
                <CommandGroup
                  heading={debouncedTerm ? t('results') : t('customers')}
                >
                  {users.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      onSelect={() => handleSelect(user)}
                      className='gap-3 py-2.5'
                    >
                      <div className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-full'>
                        <User className='text-muted-foreground h-4 w-4' />
                      </div>
                      <div className='min-w-0'>
                        <p className='truncate font-medium'>
                          {displayName(user)}
                        </p>
                        {user.email && (
                          <p className='text-muted-foreground truncate text-xs'>
                            {user.email}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
