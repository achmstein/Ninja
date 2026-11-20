/** One card of a page: a small title, what goes with it at the end, then its content. */
export function SectionCard({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className='bg-card flex-none rounded-lg border'>
      <div className='flex items-center justify-between gap-2 px-5 pt-4'>
        <h2 className='text-muted-foreground text-xs font-medium tracking-wide uppercase rtl:tracking-normal'>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
