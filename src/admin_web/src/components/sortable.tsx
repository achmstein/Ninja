import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Activator = (node: HTMLElement | null) => void
export type GripProps = {
  attributes: React.HTMLAttributes<HTMLElement>
  listeners: Record<string, unknown> | undefined
}

/**
 * A sortable row or section inside a dnd-kit `SortableContext`: the element
 * follows the pointer while dragged and hands its children the grip's
 * props, so only the handle starts a drag and the rest of the row keeps its
 * own clicks.
 */
export function Sortable({
  id,
  as: Tag,
  disabled,
  className,
  style,
  children,
}: {
  id: string
  as: 'li' | 'section' | 'div'
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  children: (activator: Activator, grip: GripProps) => React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })
  return (
    <Tag
      ref={setNodeRef}
      style={{
        ...style,
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        className,
        isDragging && 'bg-background relative z-10 shadow-md'
      )}
    >
      {children(setActivatorNodeRef, { attributes, listeners })}
    </Tag>
  )
}

/** The drag handle of a `Sortable` */
export function Grip({
  activator,
  grip,
  label,
  className,
}: {
  activator: Activator
  grip: GripProps
  label: string
  className?: string
}) {
  return (
    <button
      type='button'
      ref={activator}
      {...grip.attributes}
      {...grip.listeners}
      aria-label={label}
      className={cn(
        'text-muted-foreground hover:text-foreground flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md active:cursor-grabbing',
        className
      )}
    >
      <GripVertical className='h-4 w-4' />
    </button>
  )
}
