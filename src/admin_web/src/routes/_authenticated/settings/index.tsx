import { createFileRoute } from '@tanstack/react-router'
import { Main } from '@/components/layout/main'
import { SettingsProfile } from '@/features/settings/profile'

export const Route = createFileRoute('/_authenticated/settings/')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <>
      <Main>
        <div className='mx-auto w-full max-w-2xl'>
          <SettingsProfile />
        </div>
      </Main>
    </>
  )
}
