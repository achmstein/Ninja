import { configureCn } from '@ninja/web-core/cn'

export { cn } from '@ninja/web-core/cn'

// The till's type roles (styles/index.css, docs/type.md), told to the class merger
configureCn({
  typeRoles: ['type-title', 'type-heading', 'type-body', 'type-detail', 'type-caption', 'type-label', 'type-figure'],
  conflicts: ['font-size', 'font-weight', 'leading', 'tracking', 'text-transform'],
})
