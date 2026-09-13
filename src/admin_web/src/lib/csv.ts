type CsvCell = string | number | null | undefined

/**
 * Hand the browser a CSV to save. Every cell is quoted, so commas and
 * newlines inside a note survive; the byte-order mark up front makes Excel
 * read the Arabic as UTF-8 instead of guessing at a code page.
 */
export function downloadCsv(
  filename: string,
  header: string[],
  rows: CsvCell[][]
) {
  const escape = (cell: CsvCell) => {
    const text = cell === null || cell === undefined ? '' : String(cell)
    return `"${text.replace(/"/g, '""')}"`
  }
  const lines = [header, ...rows].map((row) => row.map(escape).join(','))
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
