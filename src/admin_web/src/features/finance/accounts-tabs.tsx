import { isOwner } from '@/config/oidc-config'
import { useAuth } from 'react-oidc-context'
import { useT } from '@/lib/i18n'
import { PageTabs } from '@/components/page-tabs'

/**
 * Who the business deals in money with, as one page of two tabs: the
 * suppliers it owes, and the partners who share its profit (theirs is the
 * owners' tab alone).
 */
export function AccountsTabs({ value }: { value: 'suppliers' | 'partners' }) {
  const t = useT()
  const auth = useAuth()
  if (!isOwner(auth.user)) return null
  return (
    <PageTabs
      value={value}
      tabs={[
        {
          value: 'suppliers',
          label: t('navFinanceSuppliers'),
          to: '/finance/suppliers',
        },
        {
          value: 'partners',
          label: t('navFinancePartners'),
          to: '/finance/partners',
        },
      ]}
    />
  )
}
