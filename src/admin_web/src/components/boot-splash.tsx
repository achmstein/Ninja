import { NinjaWordmark } from '@/components/ninja-wordmark'

/**
 * The loading screen: the platform's wordmark on the dark tile colour and a
 * ring that turns, the same as index.html paints before any script runs,
 * so the page never changes its face between the first paint and the app.
 * Shown while the session is being read; the café takes over from there.
 */
export function BootSplash() {
  return (
    <div className='fixed inset-0 z-50 grid place-items-center bg-[#18181b]' role='status'>
      <div className='flex flex-col items-center'>
        <NinjaWordmark className='h-10 text-[#fafafa]' />
        <div className='mt-7 size-[22px] animate-spin rounded-full border-2 border-[#fafafa]/25 border-t-[#fafafa] motion-reduce:animate-none' />
      </div>
    </div>
  )
}
