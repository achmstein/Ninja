import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TenantDetail, UpdateTenantRequest } from '@ninja/api/control'
import { useT } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { updateTenantMutation } from './api/mutations'
import { getTenantQueryKey, listTenantsQueryKey } from './api/queries'

/**
 * The record as it stands, in the shape PUT /tenants/{slug} takes: what the
 * endpoint would clear if left out (names, colour, domain, contact, notes,
 * locale) goes back as it is; the rest is left out, which leaves it.
 */
export function recordAsIs(tenant: TenantDetail): UpdateTenantRequest {
  return {
    nameEn: tenant.nameEn,
    nameAr: tenant.nameAr,
    primaryColor: tenant.primaryColor,
    customerDomain: tenant.customerDomain,
    contactName: tenant.record.contactName,
    phone: tenant.record.phone,
    address: tenant.record.address,
    plan: null,
    notes: tenant.record.notes,
    country: tenant.locale.country,
    currency: tenant.locale.currency,
    timeZone: tenant.locale.timeZone,
    defaultLanguage: tenant.locale.language,
  }
}

/**
 * One section of the record saved on its own: the fields it changes over the
 * record as it is, so each part of the page saves without the others.
 */
export function useRecordSave(tenant: TenantDetail, onSaved?: () => void) {
  const t = useT()
  const queryClient = useQueryClient()
  const save = useMutation({
    ...updateTenantMutation(),
    onSuccess: (detail) => {
      queryClient.setQueryData(getTenantQueryKey({ path: { slug: tenant.slug } }), detail)
      queryClient.invalidateQueries({ queryKey: listTenantsQueryKey() })
      // The App tab's checks read the record's app id, team and fingerprints
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTenantApp' }] })
      toast.success(t('recordSaved'))
      onSaved?.()
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })
  return {
    pending: save.isPending,
    save: (changes: Partial<UpdateTenantRequest>) =>
      save.mutate({ path: { slug: tenant.slug }, body: { ...recordAsIs(tenant), ...changes } }),
  }
}
