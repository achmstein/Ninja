import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The kitchen display's type roles (styles/index.css, docs/type.md) are told
 * to the class merger, as the till's are: a role sets the size, the weight
 * and the line of text, so given to a component it takes the place of
 * whatever size or weight that component set for itself (a button, a
 * dialog's title). A weight given after a role still stands: that is the one
 * step of emphasis a role allows.
 */
const merge = extendTailwindMerge<'type-role'>({
  extend: {
    classGroups: {
      'type-role': [
        'type-place',
        'type-clock',
        'type-item',
        'type-detail',
        'type-quiet',
        'type-action',
        'type-tally',
        'type-body',
        'type-caption',
      ],
    },
    conflictingClassGroups: {
      'type-role': ['font-size', 'font-weight', 'leading', 'tracking'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs))
}
