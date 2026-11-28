import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge, twMerge, type DefaultClassGroupIds } from 'tailwind-merge'

let merge: (classes: string) => string = twMerge

/**
 * Tells the class merger an app's type roles (the till's and the kitchen's
 * `type-*` classes, see their docs/type.md): a role sets the size, weight, line
 * and spacing of text, so given to a component it takes the place of whatever
 * size or weight the component set for itself. A weight given after a role still
 * stands: that is the one step of emphasis a role allows. Called once, from the
 * app's lib/utils.ts, before anything renders; an app without roles never calls it.
 */
export function configureCn({ typeRoles, conflicts }: { typeRoles: string[]; conflicts: DefaultClassGroupIds[] }) {
  merge = extendTailwindMerge<'type-role'>({
    extend: {
      classGroups: { 'type-role': typeRoles },
      conflictingClassGroups: { 'type-role': conflicts },
    },
  })
}

/** Joins class names, later Tailwind classes winning over earlier ones they conflict with */
export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs))
}
