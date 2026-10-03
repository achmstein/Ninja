import { createFileRoute } from '@tanstack/react-router'
import { Main } from '@/components/layout/main'
import { SettingsProfile } from '@/features/settings/profile'

export const Route = createFileRoute('/_authenticated/settings/')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    // The full width, as every page: no narrow column of its own
    <Main>
      <SettingsProfile />
    </Main>
  )
}
