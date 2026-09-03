type StatTileProps = {
  label: string
  value: string
  hint?: string
  className?: string
}

export function StatTile({ label, value, hint, className }: StatTileProps) {
  return (
    <div className={`bg-card rounded-xl border p-3 ${className ?? ''}`}>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className='text-lg font-semibold tabular-nums'>{value}</div>
      {hint && (
        <div className='text-muted-foreground text-xs tabular-nums'>{hint}</div>
      )}
    </div>
  )
}
