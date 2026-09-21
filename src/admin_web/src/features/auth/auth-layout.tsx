import { useBrandName } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { BrandMark } from '@/components/brand-mark'
import { PoweredBy } from '@/components/ninja-wordmark'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const t = useT()
  const cafe = useBrandName()
  return (
    <div className='container grid h-svh max-w-none items-center justify-center'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:w-[480px] sm:p-8'>
        <div className='mb-4 flex items-center justify-center gap-2'>
          <BrandMark className='size-7 text-sm' />
          <h1 className='text-xl font-medium'>{cafe || t('adminName')}</h1>
          {cafe && <span className='text-muted-foreground text-xl'>· {t('adminName')}</span>}
        </div>
        {children}
        <PoweredBy className='justify-center pt-6' />
      </div>
    </div>
  )
}
