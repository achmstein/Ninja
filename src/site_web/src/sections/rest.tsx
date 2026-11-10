import { Check } from 'lucide-react'
import { includes, MODULES, PLANS } from '@/cafe/plans'
import { useLang } from '@/lib/lang'
import { ContactButtons, Container, Head, NMark } from './chrome'

// ——— The apps ————————————————————————————————————————————————————

const ICONS: Record<string, string> = { pos: '/app-icons/pos.svg', kds: '/app-icons/kds.svg', rider: '/app-icons/rider.svg' }

export function AppsSection() {
  const { c } = useLang()
  return (
    <section className='py-20 sm:py-28'>
      <Container className='grid gap-12 lg:grid-cols-2 lg:gap-20'>
        <div>
          <Head title={c.apps.title} lead={c.apps.lead} />
          <p className='mt-6 max-w-[56ch] text-[0.9375rem] leading-relaxed text-soft'>{c.apps.printing}</p>
        </div>
        <ul className='self-center border-b border-ink/10'>
          {c.apps.list.map((app) => (
            <li key={app.name} className='flex items-center gap-4 border-t border-ink/10 py-4'>
              {ICONS[app.icon] ? <img src={ICONS[app.icon]} alt='' width={48} height={48} className='rounded-[13px]' /> : <NMark size={48} color='#c2410c' />}
              <div>
                <div className='text-lg font-semibold'>{app.name}</div>
                <div className='text-[0.9375rem] text-soft'>{app.text}</div>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

// ——— Everything, listed ——————————————————————————————————————————

export function EverythingSection() {
  const { c } = useLang()
  return (
    <section id='everything' className='scroll-mt-8 py-20 sm:py-28'>
      <Container>
        <Head title={c.all.title} lead={c.all.lead} />
        <div className='mt-12 columns-1 gap-x-12 sm:columns-2 lg:columns-3'>
          {c.all.groups.map((group) => (
            <div key={group.name} className='mb-10 break-inside-avoid'>
              <h3 className='border-b-2 border-ink pb-2 text-lg font-bold'>{group.name}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item} className='border-b border-ink/10 py-2.5 text-[0.9375rem] leading-snug'>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

// ——— Plans ———————————————————————————————————————————————————————

export function PlansSection() {
  const { c } = useLang()
  return (
    <section id='plans' className='scroll-mt-8 py-20 sm:py-28'>
      <Container>
        <Head title={c.plans.title} lead={c.plans.lead} />
        <div className='no-bar -mx-5 mt-12 overflow-x-auto px-5 sm:mx-0 sm:px-0'>
          <table className='w-full min-w-[560px] border-collapse text-start text-[0.9375rem]'>
            <thead>
              <tr className='border-b-2 border-ink'>
                <th scope='col' className='py-3 pe-4 text-start font-semibold text-soft'>
                  {c.plans.module}
                </th>
                {PLANS.map((plan) => (
                  <th key={plan} scope='col' className='display w-[16%] px-2 py-3 text-center text-2xl'>
                    {c.plans.names[plan]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className='border-b border-ink/10'>
                <th scope='row' className='py-3.5 pe-4 text-start font-normal'>
                  <div className='font-semibold'>{c.plans.base.name}</div>
                  <div className='text-soft'>{c.plans.base.what}</div>
                </th>
                {PLANS.map((plan) => (
                  <td key={plan} className='px-2 text-center'>
                    <Check size={20} strokeWidth={2.6} className='mx-auto' aria-label={c.plans.included} />
                  </td>
                ))}
              </tr>
              {MODULES.map((module) => (
                <tr key={module} className='border-b border-ink/10'>
                  <th scope='row' className='py-3.5 pe-4 text-start font-normal'>
                    <div className='font-semibold'>{c.plans.modules[module].name}</div>
                    <div className='text-soft'>{c.plans.modules[module].what}</div>
                  </th>
                  {PLANS.map((plan) => (
                    <td key={plan} className='px-2 text-center'>
                      {includes(plan, module) ? <Check size={20} strokeWidth={2.6} className='mx-auto' aria-label={c.plans.included} /> : <span className='text-[0.8125rem] font-medium text-soft'>{c.plans.addon}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className='mt-6 max-w-[60ch] text-[0.9375rem] leading-relaxed text-soft'>{c.plans.demo}</p>
      </Container>
    </section>
  )
}

// ——— Starting, and the way in ————————————————————————————————————

export function StartSection() {
  const { c } = useLang()
  return (
    <section className='py-20 sm:py-28'>
      <Container>
        <Head title={c.start.title} lead={c.start.lead} />
        <ol className='mt-12 grid gap-10 md:grid-cols-3 md:gap-8'>
          {c.start.steps.map((step, i) => (
            <li key={step.title} className='border-t-2 border-ink pt-5'>
              <div className='display text-5xl text-ink/25' dir='ltr'>
                {i + 1}
              </div>
              <h3 className='mt-3 text-xl font-bold'>{step.title}</h3>
              <p className='mt-2 max-w-[38ch] text-[0.9375rem] leading-relaxed text-soft'>{step.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}

export function CallSection() {
  const { c } = useLang()
  return (
    <section id='talk' className='scroll-mt-8 px-3 sm:px-6'>
      <div className='mx-auto max-w-[1400px] rounded-[28px] bg-counter py-16 sm:rounded-[44px] sm:py-24'>
        <Container>
          <h2 className='display max-w-[14ch] text-[clamp(2.4rem,7vw,5.5rem)]'>{c.cta.title}</h2>
          <p className='mt-6 max-w-[48ch] text-lg leading-relaxed text-ink/80 sm:text-xl sm:leading-relaxed'>{c.cta.lead}</p>
          <ContactButtons className='mt-9' />
        </Container>
      </div>
    </section>
  )
}
