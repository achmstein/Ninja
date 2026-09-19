import { AuditTable } from '@/features/platform/audit-table'

/** The platform's audit trail, this tenant's entries only. */
export function AuditTab({ slug }: { slug: string }) {
  return <AuditTable slug={slug} />
}
