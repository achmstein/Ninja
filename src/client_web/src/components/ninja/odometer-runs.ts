const LATIN = '0123456789'
const ARABIC = '٠١٢٣٤٥٦٧٨٩'
/** Characters that belong inside a number: grouping and decimal marks in both scripts */
const NUMBER_MARKS = '.,٫٬'

export type OdometerCell = { kind: 'digit'; value: number; digits: string } | { kind: 'mark'; value: string }
export type OdometerRun = { kind: 'number'; cells: OdometerCell[] } | { kind: 'text'; value: string }

/**
 * A formatted price as runs: numbers, whose digits (Latin or Arabic-Indic)
 * each roll on a wheel, and the text around them (the currency), which
 * stands still. A number is kept whole so the page's direction never
 * reorders its digits.
 */
export function odometerRuns(text: string): OdometerRun[] {
  const runs: OdometerRun[] = []
  for (const ch of text) {
    const latin = LATIN.indexOf(ch)
    const arabic = ARABIC.indexOf(ch)
    const cell: OdometerCell | null =
      latin >= 0
        ? { kind: 'digit', value: latin, digits: LATIN }
        : arabic >= 0
          ? { kind: 'digit', value: arabic, digits: ARABIC }
          : null
    const last = runs[runs.length - 1]
    if (cell) {
      if (last?.kind === 'number') last.cells.push(cell)
      else runs.push({ kind: 'number', cells: [cell] })
    } else if (NUMBER_MARKS.includes(ch) && last?.kind === 'number') {
      last.cells.push({ kind: 'mark', value: ch })
    } else if (last?.kind === 'text') {
      last.value += ch
    } else {
      runs.push({ kind: 'text', value: ch })
    }
  }
  return runs
}
