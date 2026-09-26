import { create } from 'zustand'

/**
 * Whether the dock's sheet is open: the bill, the table or the room, out of
 * the dock's row. The row opens it, and so can anything else that stands
 * for the same place (the Book tab's "you're in" card), so there is one
 * sheet for it, not a second one.
 */
export const useDockSheet = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
