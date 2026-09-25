// Customer types matching the Identity.API / Keycloak user model

export interface Customer {
  id: string
  username?: string
  email?: string
  firstName?: string
  lastName?: string
  enabled: boolean
  createdTimestamp?: number
  realmRoles?: string[]
  phoneNumber?: string
  /** Branch ids a staff account may work in (Owners hold all) */
  branches?: number[]
  /** Added at the till by name and phone, not yet claimed in the app */
  addedAtCounter?: boolean
}

export interface CustomerParams {
  first?: number
  max?: number
  search?: string
  role?: string
  excludeRole?: string
}

// Helper functions
export function getCustomerDisplayName(customer: Customer): string {
  if (customer.firstName && customer.lastName) {
    return `${customer.firstName} ${customer.lastName}`
  }
  if (customer.firstName) {
    return customer.firstName
  }
  return customer.username || customer.email || 'Unknown'
}

export function getCustomerInitials(customer: Customer): string {
  const name = getCustomerDisplayName(customer)
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}
