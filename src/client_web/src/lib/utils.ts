import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Tailwind's class merging, told about the app's type scale (styles/theme.css): without it
 * `text-note` reads as a colour, and a size set beside a colour would be dropped
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['title', 'headline', 'name', 'body', 'note', 'caption', 'micro', 'display', 'display-lg'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
