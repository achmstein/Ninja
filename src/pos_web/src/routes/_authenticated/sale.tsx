import { createFileRoute } from '@tanstack/react-router'
import { SalePad } from '@/features/sale'

export const Route = createFileRoute('/_authenticated/sale')({
  component: SalePad,
})
