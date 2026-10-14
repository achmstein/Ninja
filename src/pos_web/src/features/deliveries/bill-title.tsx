import { deliveryLabelParts } from './delivery-format'

/**
 * A bill's title as text in the till's own direction. A delivery's "#42 · Mona"
 * is laid out in its parts: the number with its sign as the till's language
 * reads it, and the name isolated, so a Latin name never pulls "#42" into its
 * left-to-right run (in Arabic that put the sign after the number). Any other
 * title is laid out in its own script, as before.
 */
export function BillTitle({ title, className }: { title: string; className?: string }) {
  const parts = deliveryLabelParts(title)
  if (!parts) {
    return (
      <span dir='auto' className={className}>
        {title}
      </span>
    )
  }
  return (
    <span className={className}>
      <span className='tabular-nums'>#{parts.number}</span>
      {parts.name && (
        <>
          {' · '}
          <bdi>{parts.name}</bdi>
        </>
      )}
    </span>
  )
}
