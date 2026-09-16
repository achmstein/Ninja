import { createElement } from 'react'
import { placeKindIcon } from '../status'

/** The kind's icon as a component, for use inside render. */
export function PlaceKindIcon({
  kind,
  className,
}: {
  kind: number | string | null | undefined
  className?: string
}) {
  return createElement(placeKindIcon(kind), { className })
}
