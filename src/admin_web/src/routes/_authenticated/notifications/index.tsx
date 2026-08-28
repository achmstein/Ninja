import { createFileRoute } from '@tanstack/react-router'
import { AnnouncementsManagement } from '@/features/announcements'

export const Route = createFileRoute('/_authenticated/notifications/')({
  component: AnnouncementsManagement,
})
