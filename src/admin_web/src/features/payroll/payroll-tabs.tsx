import { useT } from '@/lib/i18n'
import { PageTabs } from '@/components/page-tabs'

/**
 * Employees as one page of three tabs: the register, the month's
 * attendance, and the month's payslips.
 */
export function PayrollTabs({
  value,
}: {
  value: 'employees' | 'attendance' | 'payslips'
}) {
  const t = useT()
  return (
    <PageTabs
      value={value}
      tabs={[
        {
          value: 'employees',
          label: t('navPayrollEmployees'),
          to: '/payroll/employees',
        },
        {
          value: 'attendance',
          label: t('navPayrollAttendance'),
          to: '/payroll/attendance',
        },
        {
          value: 'payslips',
          label: t('navPayrollPayslips'),
          to: '/payroll/payslips',
        },
      ]}
    />
  )
}
