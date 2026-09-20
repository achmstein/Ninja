import type { CapacityResponse } from '@/api/control'
import { Progress } from '@/components/ui/progress'
import { Stat, StatStrip } from '@/components/stat-strip'
import { megabytes, percent } from '@/lib/format'
import { useT } from '@/lib/i18n'

type Tone = 'default' | 'warning' | 'negative'

/** Amber past 85 %, red past 95 %: the same reading for every gauge. */
function toneFor(pct: number): Tone {
  if (pct > 95) return 'negative'
  if (pct > 85) return 'warning'
  return 'default'
}

/** A fill bar that grows from the start edge in either direction. */
function Bar({ value }: { value: number }) {
  return <Progress value={value} className='mt-1 rtl:-scale-x-100' />
}

type CapacityStripProps = {
  capacity: CapacityResponse | undefined
  loading: boolean
}

/**
 * The box at a glance: memory, cpu, the tenants drive and how many more
 * stacks fit. Always in view above the tabs, so a full box is never a
 * surprise when a stack is stamped.
 */
export function CapacityStrip({ capacity, loading }: CapacityStripProps) {
  const t = useT()

  const memTotal = Number(capacity?.memTotalMb ?? 0)
  const memUsed = memTotal - Number(capacity?.memAvailableMb ?? 0)
  const memPct = percent(memUsed, memTotal)

  const cpus = Number(capacity?.cpus ?? 0)
  const load = Number(capacity?.load[0] ?? 0)
  const loadPct = percent(load, cpus)

  const diskTotal = Number(capacity?.tenantsDiskTotalMb ?? 0)
  const diskUsed = diskTotal - Number(capacity?.tenantsDiskFreeMb ?? 0)
  const diskPct = percent(diskUsed, diskTotal)

  const roomFor = Number(capacity?.roomFor ?? 0)

  return (
    <StatStrip>
      <Stat
        label={t('memory')}
        value={`${megabytes(memUsed)} / ${megabytes(memTotal)}`}
        hint={!loading && <Bar value={memPct} />}
        tone={toneFor(memPct)}
        loading={loading}
      />
      <Stat
        label={t('cpu')}
        value={load.toFixed(2)}
        hint={
          !loading && (
            <>
              {t('cores')}: {cpus}
              <Bar value={loadPct} />
            </>
          )
        }
        tone={toneFor(loadPct)}
        loading={loading}
      />
      <Stat
        label={t('disk')}
        value={`${megabytes(diskUsed)} / ${megabytes(diskTotal)}`}
        hint={!loading && <Bar value={diskPct} />}
        tone={toneFor(diskPct)}
        loading={loading}
      />
      <Stat
        label={t('tenants')}
        value={t('roomFor', { count: roomFor })}
        hint={
          !loading && (
            <>
              {t('stackFootprint')}:{' '}
              {megabytes(Number(capacity?.stackFootprintMb ?? 0))} {t('stackTypical')} ·{' '}
              {megabytes(Number(capacity?.stackLimitMb ?? 0))} {t('stackCap')}
            </>
          )
        }
        tone={roomFor === 0 ? 'negative' : 'default'}
        loading={loading}
      />
    </StatStrip>
  )
}
