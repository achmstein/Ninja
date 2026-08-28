import { createFileRoute } from '@tanstack/react-router'
import { SignedOut } from '@/features/auth/signed-out'

export const Route = createFileRoute('/(auth)/signed-out')({
  component: SignedOut,
})
