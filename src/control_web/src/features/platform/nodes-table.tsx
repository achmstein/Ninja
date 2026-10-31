import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NodeDto, NodeStatus } from '@/api/control'
import {
  drainNodeMutation,
  listNodesOptions,
  listNodesQueryKey,
  retireNodeMutation,
  updateNodeMutation,
} from '@/api/control/@tanstack/react-query.gen'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { megabytes } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const statusTone: Record<NodeStatus, string> = {
  Active: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
  Cordoned: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  Draining: 'border-sky-500/40 text-sky-700 dark:text-sky-400',
  Unreachable: 'border-destructive/50 text-destructive',
  Retired: 'text-muted-foreground',
}

/**
 * The boxes tenant stacks run on: each one's status, what it is for, how
 * many tenants live there and how much room it has left. A node is cordoned
 * here (it keeps its tenants, takes no new ones) or made active again, and
 * given its own labels and limits; draining and retiring move tenants and
 * come with the cells.
 */
export function NodesTable() {
  const t = useT()
  const queryClient = useQueryClient()
  const nodes = useQuery(listNodesOptions())
  const [editing, setEditing] = useState<NodeDto | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: listNodesQueryKey() })
  const update = useMutation({
    ...updateNodeMutation(),
    onSuccess: () => {
      setEditing(null)
      toast.success(t('nodeSaved'))
      refresh()
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  const [asking, setAsking] = useState<{ node: NodeDto; action: 'drain' | 'retire' } | null>(null)
  const drain = useMutation({
    ...drainNodeMutation(),
    onSuccess: (r) => {
      setAsking(null)
      toast.success(t('nodeDrained', { count: String(r.moving.length), stuck: String(r.stuck.length) }))
      refresh()
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })
  const retire = useMutation({
    ...retireNodeMutation(),
    onSuccess: () => {
      setAsking(null)
      toast.success(t('nodeRetired'))
      refresh()
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  const setStatus = (node: NodeDto, status: NodeStatus) =>
    update.mutate({ path: { id: Number(node.id) }, body: { status } })

  return (
    <div className='flex flex-col gap-3'>
      <p className='text-muted-foreground text-sm'>{t('nodesIntro')}</p>
      <div className='overflow-x-auto rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('node')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('nodeLabels')}</TableHead>
              <TableHead className='text-end'>{t('nodeTenants')}</TableHead>
              <TableHead className='text-end'>{t('nodeRoom')}</TableHead>
              <TableHead className='text-end'>{t('nodeMemory')}</TableHead>
              <TableHead className='text-end'>{t('nodeDisk')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.isLoading &&
              Array.from({ length: 2 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className='h-6 w-full' />
                  </TableCell>
                </TableRow>
              ))}
            {nodes.data?.map((node) => (
              <TableRow key={String(node.id)}>
                <TableCell>
                  <div className='font-medium'>{node.name}</div>
                  <div className='text-muted-foreground text-xs'>
                    {node.kind === 'Local' ? t('nodeLocal') : node.agentUrl} · {node.architecture}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant='outline' className={statusTone[node.status]}>
                    {t(`nodeStatus${node.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className='flex flex-wrap gap-1'>
                    {node.labels.length === 0 ? (
                      <span className='text-muted-foreground text-xs'>{t('nodeAnyTenant')}</span>
                    ) : (
                      node.labels.map((label) => (
                        <Badge key={label} variant='secondary'>
                          {label}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell className='text-end tabular-nums'>
                  {String(node.running)} / {String(node.tenants)}
                </TableCell>
                <TableCell className='text-end tabular-nums'>
                  {node.roomFor === null ? (
                    <span className='text-muted-foreground'>—</span>
                  ) : (
                    <span
                      className={cn(Number(node.roomFor) === 0 && 'text-destructive')}
                      title={node.whyNoRoom ?? undefined}
                    >
                      {Number(node.roomFor) > 999 ? '∞' : String(node.roomFor)}
                    </span>
                  )}
                </TableCell>
                <TableCell className='text-end text-xs tabular-nums'>
                  {node.memTotalMb === null
                    ? '—'
                    : `${megabytes(Number(node.memAvailableMb))} / ${megabytes(Number(node.memTotalMb))}`}
                </TableCell>
                <TableCell className='text-end text-xs tabular-nums'>
                  {node.diskTotalMb === null
                    ? '—'
                    : `${megabytes(Number(node.diskFreeMb))} / ${megabytes(Number(node.diskTotalMb))}`}
                </TableCell>
                <TableCell className='text-end whitespace-nowrap'>
                  {node.status === 'Active' && (
                    <Button variant='ghost' size='sm' disabled={update.isPending} onClick={() => setStatus(node, 'Cordoned')}>
                      {t('nodeCordon')}
                    </Button>
                  )}
                  {node.status === 'Cordoned' && (
                    <Button variant='ghost' size='sm' disabled={update.isPending} onClick={() => setStatus(node, 'Active')}>
                      {t('nodeMakeActive')}
                    </Button>
                  )}
                  {node.kind === 'Agent' && (node.status === 'Active' || node.status === 'Cordoned') && (
                    <Button variant='ghost' size='sm' onClick={() => setAsking({ node, action: 'drain' })}>
                      {t('nodeDrain')}
                    </Button>
                  )}
                  {node.kind === 'Agent' && node.status !== 'Retired' && Number(node.tenants) === 0 && (
                    <Button variant='ghost' size='sm' onClick={() => setAsking({ node, action: 'retire' })}>
                      {t('nodeRetire')}
                    </Button>
                  )}
                  <Button variant='outline' size='sm' className='ms-1' onClick={() => setEditing(node)}>
                    {t('edit')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
        <AlertDialogContent size='sm'>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {asking?.action === 'drain' ? t('nodeDrainTitle', { name: asking.node.name }) : t('nodeRetireTitle', { name: asking?.node.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{asking?.action === 'drain' ? t('nodeDrainNote') : t('nodeRetireNote')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={drain.isPending || retire.isPending}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={drain.isPending || retire.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (!asking) return
                const path = { path: { id: Number(asking.node.id) } }
                if (asking.action === 'drain') drain.mutate(path)
                else retire.mutate(path)
              }}
            >
              {asking?.action === 'drain' ? t('nodeDrain') : t('nodeRetire')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {editing && (
        <NodeDialog
          node={editing}
          saving={update.isPending}
          onClose={() => setEditing(null)}
          onSave={(body) => update.mutate({ path: { id: Number(editing.id) }, body })}
        />
      )}
    </div>
  )
}

type NodeChanges = {
  labels: string[]
  reserveMb: number
  stackFootprintMb: number
  postgresMaxConnections: number
  maxStacks: number
}

/** A node's labels and its own limits; a limit left empty is the platform's. */
function NodeDialog({
  node,
  saving,
  onClose,
  onSave,
}: {
  node: NodeDto
  saving: boolean
  onClose: () => void
  onSave: (body: NodeChanges) => void
}) {
  const t = useT()
  const [labels, setLabels] = useState(node.labels.join(', '))
  const [limits, setLimits] = useState({
    reserveMb: node.reserveMb === null ? '' : String(node.reserveMb),
    stackFootprintMb: node.stackFootprintMb === null ? '' : String(node.stackFootprintMb),
    postgresMaxConnections: node.postgresMaxConnections === null ? '' : String(node.postgresMaxConnections),
    maxStacks: node.maxStacks === null ? '' : String(node.maxStacks),
  })
  // Empty sends 0: the platform's again
  const number = (value: string) => (value.trim() === '' ? 0 : Math.max(0, Math.round(Number(value) || 0)))
  const field = (key: keyof typeof limits, label: string) => (
    <div className='grid gap-1.5'>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        inputMode='numeric'
        placeholder={t('nodePlatformDefault')}
        value={limits[key]}
        onChange={(e) => setLimits((l) => ({ ...l, [key]: e.target.value }))}
      />
    </div>
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{node.name}</DialogTitle>
          <DialogDescription>{t('nodeEditHint')}</DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <div className='grid gap-1.5'>
            <Label htmlFor='labels'>{t('nodeLabels')}</Label>
            <Input id='labels' placeholder='demo, customer' value={labels} onChange={(e) => setLabels(e.target.value)} />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            {field('reserveMb', t('nodeReserveMb'))}
            {field('stackFootprintMb', t('nodeStackFootprintMb'))}
            {field('postgresMaxConnections', t('nodePostgresConnections'))}
            {field('maxStacks', t('nodeMaxStacks'))}
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            disabled={saving}
            onClick={() =>
              onSave({
                labels: labels.split(',').map((l) => l.trim()).filter(Boolean),
                reserveMb: number(limits.reserveMb),
                stackFootprintMb: number(limits.stackFootprintMb),
                postgresMaxConnections: number(limits.postgresMaxConnections),
                maxStacks: number(limits.maxStacks),
              })
            }
          >
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
