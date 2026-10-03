import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '@/lib/utils'
import { RISE } from '@/components/motion'

type MainProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean
  fluid?: boolean
  ref?: React.Ref<HTMLElement>
}

export function Main({ fixed, className, fluid, ...props }: MainProps) {
  return (
    <motion.main
      // Each page eases in as it opens: the content rises a little and fades in
      {...RISE}
      // The skip link's target
      id='content'
      data-layout={fixed ? 'fixed' : 'auto'}
      className={cn(
        'flex flex-col gap-6 px-4 py-6',

        // On a phone the tab bar sits over the bottom: the last of the page clears it
        'max-md:pb-[calc(6rem+env(safe-area-inset-bottom))]',

        // If layout is fixed, make the main container flex and grow
        fixed && 'min-h-0 grow overflow-hidden',

        // If layout is not fluid, set the max-width
        !fluid &&
          '@7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl',
        className
      )}
      {...(props as HTMLMotionProps<'main'>)}
    />
  )
}
