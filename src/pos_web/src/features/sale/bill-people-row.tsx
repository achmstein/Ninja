import { useRef } from 'react'
import { Plus, UserMinus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomerCard } from '@/features/customer/customer-card'
import { useT } from '@/lib/i18n'
import { shortNames } from './bill-people'
import { samePerson } from './cart'
import type { BillPeople } from './use-bill-people'

/**
 * Whose the order is, over it, one row that swipes: a tap and what is rung up
 * next is theirs (their usuals come up, their options are filled in), a
 * second tap lets go. The way to add one stays at the row's end. Nothing has
 * to be tapped: a round can be nobody's. A new sale shows its one customer
 * the same way, so the order reads alike whatever it is rung onto.
 *
 * The row is the order panel's width, so it is spent on names: each is
 * written by the first name (`shortNames`), and once there is one the way to
 * add another is a square button, its words left to the empty row.
 */
export function BillPeopleRow({ people, onAdd }: { people: BillPeople; onAdd: () => void }) {
  const t = useT()
  const none = people.all.length === 0
  const names = shortNames(people.all.map((person) => person.name))
  return (
    <div className='flex items-center gap-2'>
      {!none && (
        <div className='no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto'>
          {people.all.map((person, at) => (
            <PersonChip
              key={person.id ?? `name:${person.name}`}
              name={names[at] || t('guest')}
              picked={samePerson(person, people.forWho)}
              onTap={() => people.pick(person)}
              onHold={() => people.card.open(person)}
            />
          ))}
        </div>
      )}
      {none ? (
        <Button variant='outline' className='text-muted-foreground h-11 flex-1 gap-1.5 border-dashed px-4 text-base' onClick={onAdd}>
          {t('aCustomer')}
          <Plus className='size-4' />
        </Button>
      ) : (
        <Button
          variant='outline'
          size='icon'
          className='text-muted-foreground size-11 shrink-0 border-dashed'
          aria-label={t('anotherCustomer')}
          title={t('anotherCustomer')}
          onClick={onAdd}
        >
          <UserPlus className='size-5' />
        </Button>
      )}
    </div>
  )
}

/** How long a name is held before its card opens */
const HOLD_MS = 500

/** One of a bill's people. A tap picks them; held for a moment (or a right click) it opens their card */
function PersonChip({ name, picked, onTap, onHold }: { name: string; picked: boolean; onTap: () => void; onHold: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The hold opened the card: the tap that ends it picks nobody
  const held = useRef(false)
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const hold = () => {
    stop()
    held.current = true
    onHold()
  }
  return (
    <Button
      variant={picked ? 'default' : 'outline'}
      aria-pressed={picked}
      className='h-11 max-w-48 shrink-0 px-4 text-base select-none'
      onPointerDown={() => {
        held.current = false
        stop()
        timer.current = setTimeout(hold, HOLD_MS)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => {
        e.preventDefault()
        hold()
      }}
      onClick={() => {
        if (held.current) held.current = false
        else onTap()
      }}
    >
      <bdi className='truncate'>{name}</bdi>
    </Button>
  )
}

/** One of the bill's people, their name held: their card, and while the room's clock runs the way out of the room */
export function BillPersonCard({ people }: { people: BillPeople }) {
  const t = useT()
  const { card } = people
  return (
    <CustomerCard
      customer={card.customer}
      onOpenChange={(open) => !open && card.close()}
      footer={
        card.removable && (
          <Button variant='outline' size='lg' className='text-destructive h-12 gap-2' disabled={card.busy} onClick={card.remove}>
            <UserMinus className='size-5' />
            {t('removeFromRoom')}
          </Button>
        )
      }
    />
  )
}
