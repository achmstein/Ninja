import { PLATFORM_NAME, useBrandName } from '@/lib/brand'
import { PlatformMark } from '@/components/platform-mark'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const cafe = useBrandName()
  return (
    <div className='container grid h-svh max-w-none items-center justify-center'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:w-[480px] sm:p-8'>
        <div className='mb-4 flex items-center justify-center gap-2'>
          <PlatformMark className='size-7 text-sm' />
          <h1 className='text-xl font-medium'>{PLATFORM_NAME}</h1>
          {cafe && <span className='text-muted-foreground text-xl'>· {cafe}</span>}
        </div>
        {children}
      </div>
    </div>
  )
}
