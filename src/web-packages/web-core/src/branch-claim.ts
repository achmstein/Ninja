/** The `branches` value that means every branch, those opened later too: a call centre's account. */
export const ALL_BRANCHES = '*'

/**
 * The `branches` claim as the token carries it (one value or a list):
 * whether it gives every branch, and the branch ids it names otherwise.
 * A missing claim is no branch, never every branch.
 */
export function readBranchClaim(raw: unknown): { all: boolean; ids: number[] } {
  const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw]
  const all = values.some((v) => String(v).trim() === ALL_BRANCHES)
  return {
    all,
    ids: all ? [] : values.map(Number).filter(Number.isInteger),
  }
}
