import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@/features/auth/sign-in'

const searchSchema = z.object({
  redirect: z.string().optional(),
  // Sent by the 401 handler: the stored token was rejected, re-authenticate
  expired: z.boolean().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  component: SignIn,
  validateSearch: searchSchema,
})
