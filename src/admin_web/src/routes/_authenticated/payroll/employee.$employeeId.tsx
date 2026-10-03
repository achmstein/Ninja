import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { EmployeePage } from '@/features/payroll/employee-page'

export const Route = createFileRoute(
  '/_authenticated/payroll/employee/$employeeId'
)({
  component: function EmployeeRoute() {
    const { employeeId } = Route.useParams()
    return (
      <FeatureGate feature='payroll'>
        <EmployeePage employeeId={Number(employeeId)} />
      </FeatureGate>
    )
  },
})
