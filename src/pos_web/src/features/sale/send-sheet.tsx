import { useState } from 'react'
import { Check, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CustomerSearch } from '@/features/customer/customer-search'
import { useLanguage, useT } from '@/lib/i18n'
import { useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { lineKey, type SaleCustomer, type SaleLine } from './cart'

/**
 * Pressing Send on a table's or a room's bill: the one moment the till asks
 * who the round is for. The people already on the bill are one tap each,
 * anyone else is found by name, and "without a customer" is said outright.
 *
 * Everything new is ticked. For a round that is more than one person's, the
 * items that are someone else's are unticked: a name sends what is ticked for
 * them, the rest stay, and the sheet asks again. Nothing is asked while items
 * are being rung up.
 */
export function SendSheet({
  open,
  onOpenChange,
  lines,
  people,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What is new on the bill, not sent yet */
  lines: SaleLine[]
  /** Everyone the bill already knows, offered first */
  people: SaleCustomer[]
  /** Sends these lines for this person, or for nobody */
  onSend: (lines: SaleLine[], who: SaleCustomer | null) => void
}) {
  const t = useT()
  const money = useMoney()
  const language = useLanguage((s) => s.language)
  // What was unticked: these stay for the next name. Kept by line, so the rest are ticked again once a part is sent
  const [held, setHeld] = useState<string[]>([])
  const [searching, setSearching] = useState(false)

  const going = lines.filter((line) => !held.includes(lineKey(line)))
  const none = going.length === 0
  // One line cannot be split: it is shown, not ticked
  const splittable = lines.length > 1

  const send = (who: SaleCustomer | null) => {
    if (none) return
    setHeld([])
    onSend(going, who)
  }

  return (
    <>
      <Dialog
        open={open && !searching}
        onOpenChange={(next) => {
          if (!next) setHeld([])
          onOpenChange(next)
        }}
      >
        <DialogContent className='max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('sendWhoTitle')}</DialogTitle>
          </DialogHeader>

          <div className='flex flex-col overflow-hidden rounded-lg border'>
            {lines.map((line) => {
              const key = lineKey(line)
              const ticked = !held.includes(key)
              const name = (language === 'ar' ? line.nameAr : line.nameEn) || line.nameEn || line.nameAr
              const body = (
                <>
                  {splittable && (
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-md border',
                        ticked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50',
                      )}
                    >
                      {ticked && <Check className='size-4' />}
                    </span>
                  )}
                  <span className={cn('min-w-0 flex-1 truncate', !ticked && 'text-muted-foreground')}>
                    <span className='tabular-nums'>{line.quantity}×</span> {name}
                  </span>
                  <span className={cn('shrink-0 tabular-nums', !ticked && 'text-muted-foreground')}>
                    {money(line.price * line.quantity)}
                  </span>
                </>
              )
              return splittable ? (
                <button
                  key={key}
                  type='button'
                  role='checkbox'
                  aria-checked={ticked}
                  onClick={() => setHeld((h) => (ticked ? [...h, key] : h.filter((k) => k !== key)))}
                  className='hover:bg-muted flex min-h-12 items-center gap-3 border-b px-3 py-2 text-start last:border-b-0'
                >
                  {body}
                </button>
              ) : (
                <div key={key} className='flex min-h-12 items-center gap-3 px-3 py-2'>
                  {body}
                </div>
              )
            })}
          </div>
          {splittable && <p className='text-muted-foreground -mt-1 text-sm'>{t('sendWhoSplitHint')}</p>}

          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
            {people.map((person) => (
              <Button
                key={person.id ?? `name:${person.name}`}
                variant='outline'
                className='h-14 min-w-0 px-3 text-base font-semibold'
                disabled={none}
                onClick={() => send(person)}
              >
                <bdi className='truncate'>{person.name || t('guest')}</bdi>
              </Button>
            ))}
            <Button
              variant='outline'
              className='text-muted-foreground h-14 min-w-0 gap-2 border-dashed px-3 text-base'
              disabled={none}
              onClick={() => setSearching(true)}
            >
              <UserPlus className='size-5 shrink-0' />
              <span className='truncate'>{people.length > 0 ? t('sendWhoAnother') : t('chooseCustomer')}</span>
            </Button>
          </div>

          <Button variant='secondary' size='lg' className='h-14 text-base' disabled={none} onClick={() => send(null)}>
            {t('sendWhoNobody')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Someone the bill does not know yet, found by name: the round is theirs */}
      <CustomerSearch
        open={open && searching}
        onOpenChange={(next) => !next && setSearching(false)}
        exclude={people.flatMap((p) => (p.id ? [p.id] : []))}
        onPick={(picked) => {
          setSearching(false)
          send(picked)
        }}
      />
    </>
  )
}
