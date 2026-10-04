import { z } from 'zod'

/** A typed number, the decimal comma read as a point; blank is 0 (not set) */
const amount = (max: number) =>
  z
    .string()
    .transform((s) => {
      const typed = s.trim().replace(',', '.')
      return typed === '' ? 0 : Number(typed)
    })
    .pipe(z.number().min(0).max(max))

/** How a branch delivers, as the owner types it: one radius, one fee, one minimum */
export const deliverySettingsSchema = z.object({
  radius: amount(100),
  fee: amount(100_000),
  minimum: amount(1_000_000),
})

export type DeliverySettingsInput = z.input<typeof deliverySettingsSchema>
export type DeliverySettings = z.output<typeof deliverySettingsSchema>
export type DeliverySettingsErrors = Partial<Record<keyof DeliverySettingsInput, true>>

/** The settings as numbers, or which fields are wrong */
export function parseDeliverySettings(
  input: DeliverySettingsInput
): { ok: true; value: DeliverySettings } | { ok: false; errors: DeliverySettingsErrors } {
  const result = deliverySettingsSchema.safeParse(input)
  if (result.success) return { ok: true, value: result.data }
  const errors: DeliverySettingsErrors = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if (field === 'radius' || field === 'fee' || field === 'minimum') errors[field] = true
  }
  return { ok: false, errors }
}

/** Saving these stops a delivering branch from delivering (no radius): worth asking first */
export function stopsDelivering(isDeliveryEnabled: boolean | null | undefined, value: DeliverySettings): boolean {
  return isDeliveryEnabled === true && value.radius <= 0
}
