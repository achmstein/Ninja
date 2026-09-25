import { LAYOUT_PARTS, type LayoutOverrides, type LayoutPart } from '@/lib/styles'

/** Every part, each the café's own choice or null for the style's: what the form holds. */
export type LayoutForm = Record<LayoutPart, string | null>

/** The saved overrides as the form holds them: a part this build does not know is left to the style. */
export function toLayoutForm(layout: LayoutOverrides | null | undefined): LayoutForm {
  const form = {} as LayoutForm
  for (const { part, values } of LAYOUT_PARTS) {
    const value = layout?.[part]
    form[part] = typeof value === 'string' && values.includes(value) ? value : null
  }
  return form
}

/** What goes back to the stack: null when every part is left to the style. */
export function fromLayoutForm(form: LayoutForm): LayoutForm | null {
  return LAYOUT_PARTS.some(({ part }) => form[part]) ? { ...form } : null
}
