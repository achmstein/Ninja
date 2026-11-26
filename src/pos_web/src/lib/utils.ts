import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The till's type roles (styles/index.css, docs/type.md) are told to the class
 * merger: a role sets the size, the weight, the line and the spacing of text,
 * so given to a component it takes the place of whatever size or weight that
 * component set for itself (a dialog's title, a badge). Without this both
 * would stay in the class list and the component's own would win. A weight
 * given after a role still stands: that is the one step of emphasis a role
 * allows.
 */
const merge = extendTailwindMerge<'type-role'>({
  extend: {
    classGroups: {
      'type-role': ['type-title', 'type-heading', 'type-body', 'type-detail', 'type-caption', 'type-label', 'type-figure'],
    },
    conflictingClassGroups: {
      'type-role': ['font-size', 'font-weight', 'leading', 'tracking', 'text-transform'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs))
}
