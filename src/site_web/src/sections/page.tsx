import type { ReactNode } from 'react'
import { useLang } from '@/lib/lang'
import type { Script } from '@/live/driver'
import { LiveApp, type Staff } from '@/live/live-app'
import { includes, MODULES, PLANS } from '@/plans/plans'
import { ContactButtons, Container } from './chrome'

/** A phone holding the app a guest uses, at its own size, 390 x 844 */
function Phone({ script, label, className }: { script: Script; label: string; className?: string }) {
  const { lang } = useLang()
  // The guest app has a framed mode of its own: the language asked for, no scrollbars, nothing kept between visits
  const path = `?preview-theme=light&lang=${lang}`
  return (
    <div className={className}>
      {/* The corners are a share of each side, so the frame keeps its shape at any size */}
      <div className='bg-[#1d1d1f] p-[2.6%] shadow-[0_50px_100px_-30px_rgb(0_0_0/.35),0_30px_60px_-30px_rgb(0_0_0/.3)]' style={{ borderRadius: '13.5% / 6.4%' }}>
        <LiveApp app='guest' path={path} width={390} height={844} script={script} label={label} radius='11.4% / 5.3%' />
      </div>
    </div>
  )
}

/** A tablet on its side holding a staff app at 1280 x 800 */
function Tablet({ app, staff, script, label, className }: { app: string; staff: Staff; script: Script; label: string; className?: string }) {
  return (
    <div className={className}>
      <div className='bg-[#1d1d1f] p-[1.5%] shadow-[0_50px_100px_-30px_rgb(0_0_0/.35),0_30px_60px_-30px_rgb(0_0_0/.3)]' style={{ borderRadius: '3.2% / 5%' }}>
        <LiveApp app={app} staff={staff} width={1280} height={800} script={script} label={label} radius='1.9% / 3%' />
      </div>
    </div>
  )
}

/** A browser window holding the dashboard at 1440 x 900 */
function Browser({ script, label, className }: { script: Script; label: string; className?: string }) {
  return (
    <div className={className}>
      <div className='overflow-hidden bg-[#e8e8ed] shadow-[0_0_0_1px_rgb(0_0_0/.08),0_50px_100px_-30px_rgb(0_0_0/.3)]' style={{ borderRadius: '1.1% / 1.7%' }}>
        <div dir='ltr' className='flex h-7 items-center gap-1.5 px-3 sm:h-9 sm:gap-2 sm:px-4'>
          {['#ff5f57', '#febc2e', '#28c840'].map((dot) => (
            <span key={dot} className='size-2 rounded-full sm:size-3' style={{ backgroundColor: dot }} />
          ))}
        </div>
        <LiveApp app='owner' staff={OWNER_STAFF} width={1440} height={900} script={script} label={label} />
      </div>
    </div>
  )
}

const TILL_STAFF: Staff = { client: 'pos-web', language: 'ninja-pos-language' }
const KITCHEN_STAFF: Staff = { client: 'kds-web', language: 'ninja-kds-language' }
const OWNER_STAFF: Staff = { client: 'admin-panel', language: 'ninja-admin-language' }

/** A guest orders: opens a dish, picks a size, adds it, goes down the menu for something sweet, adds that, and looks at the tray */
const ORDER: Script = [
  { do: 'wait', ms: 2400 },
  { do: 'tap', find: /^\s*(Spanish Latte|سبانش لاتيه)/ },
  { do: 'wait', ms: 2200 },
  { do: 'tap', find: /^\s*(Large|كبير)/ },
  { do: 'wait', ms: 1300 },
  { do: 'tap', find: /Add to Cart|أضف|ضيف/ },
  { do: 'wait', ms: 2400 },
  { do: 'scroll', to: 1 },
  { do: 'wait', ms: 1800 },
  { do: 'tap', find: /^\s*(Chocolate Cake|كيكة شوكولاتة)/ },
  { do: 'wait', ms: 2200 },
  { do: 'tap', find: /Add to Cart|أضف|ضيف/ },
  { do: 'wait', ms: 4200 },
  { do: 'reload' },
]

/** The cashier takes the order a guest sent from Table 3, then rings up a walk-in at the counter */
const TAKE: Script = [
  { do: 'wait', ms: 3200 },
  { do: 'tap', find: /Confirm|تأكيد|أكّد|أكد/ },
  { do: 'wait', ms: 2600 },
  { do: 'tap', find: /New sale|بيع جديد|بيعة جديدة/ },
  { do: 'wait', ms: 2200 },
  { do: 'tap', find: /^\s*(Food|أكل)/ },
  { do: 'wait', ms: 1200 },
  { do: 'tap', find: /^\s*(Waffle|وافل)/ },
  { do: 'wait', ms: 1200 },
  { do: 'tap', find: /^\s*(Desserts|حلويات)/ },
  { do: 'wait', ms: 1200 },
  { do: 'tap', find: /^\s*(Chocolate Cake|كيكة شوكولاتة)/ },
  { do: 'wait', ms: 4200 },
  { do: 'back' },
  { do: 'wait', ms: 2600 },
  { do: 'reload' },
]

/** The kitchen works: a new order comes in, the two oldest are marked ready */
const COOK: Script = [
  { do: 'wait', ms: 9500 },
  { do: 'refresh' },
  { do: 'wait', ms: 3500 },
  { do: 'tap', find: /Ready|جاهز/ },
  { do: 'wait', ms: 3200 },
  { do: 'tap', find: /Ready|جاهز/ },
  { do: 'wait', ms: 5500 },
  { do: 'reload' },
]

/** The owner looks at the week, the quarter, and the month again */
const REVIEW: Script = [
  { do: 'wait', ms: 4500 },
  { do: 'tap', find: /Last 7 days|آخر 7/ },
  { do: 'wait', ms: 3800 },
  { do: 'tap', find: /Last 90 days|آخر 90/ },
  { do: 'wait', ms: 3800 },
  { do: 'tap', find: /Last 30 days|آخر 30/ },
]

// ——— The top ————————————————————————————————————————————————————

export function Hero() {
  const { c } = useLang()
  return (
    <section className='overflow-hidden pt-14 pb-24 sm:pt-20 sm:pb-32'>
      <Container className='text-center'>
        <h1 className='headline mx-auto max-w-[14ch] text-[clamp(2.75rem,8vw,6rem)]'>{c.hero.title}</h1>
        <p className='mx-auto mt-5 max-w-[30ch] text-[clamp(1.25rem,2.4vw,1.75rem)] leading-snug text-soft'>{c.hero.lead}</p>
        <ContactButtons className='mt-8 justify-center' />
      </Container>
      <Phone script={ORDER} label={c.hero.watch} className='mx-auto mt-14 w-[min(78vw,360px)] sm:mt-20' />
    </section>
  )
}

// ——— One app after another, each on its own, doing its job ——————————

function Moment({ title, lead, mist, children }: { title: string; lead: string; mist?: boolean; children: ReactNode }) {
  return (
    <section className={mist ? 'overflow-hidden bg-mist py-24 sm:py-36' : 'overflow-hidden py-24 sm:py-36'}>
      <Container className='text-center'>
        <h2 className='headline mx-auto max-w-[16ch] text-[clamp(2.4rem,6.4vw,4.75rem)]'>{title}</h2>
        <p className='mx-auto mt-4 max-w-[34ch] text-[clamp(1.15rem,2vw,1.5rem)] leading-snug text-soft'>{lead}</p>
      </Container>
      <div className='mx-auto mt-12 w-[min(92vw,1080px)] sm:mt-16'>{children}</div>
    </section>
  )
}

export function Moments() {
  const { c } = useLang()
  return (
    <>
      <Moment title={c.till.title} lead={c.till.lead} mist>
        <Tablet app='till' staff={TILL_STAFF} script={TAKE} label={c.till.watch} />
      </Moment>
      <Moment title={c.kitchen.title} lead={c.kitchen.lead}>
        <Tablet app='kitchen' staff={KITCHEN_STAFF} script={COOK} label={c.kitchen.watch} />
      </Moment>
      <Moment title={c.owner.title} lead={c.owner.lead} mist>
        <Browser script={REVIEW} label={c.owner.watch} />
      </Moment>
    </>
  )
}

// ——— Plans ———————————————————————————————————————————————————————

const Tick = ({ label }: { label: string }) => (
  <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.6' strokeLinecap='round' strokeLinejoin='round' role='img' aria-label={label} className='mx-auto'>
    <path d='M20 6 9 17l-5-5' />
  </svg>
)

export function Plans() {
  const { c } = useLang()
  return (
    <section id='plans' className='scroll-mt-6 py-24 sm:py-36'>
      <Container className='max-w-[980px]'>
        <h2 className='headline mx-auto max-w-[16ch] text-center text-[clamp(2.25rem,5.5vw,4rem)]'>{c.plans.title}</h2>
        <div className='no-bar -mx-5 mt-12 overflow-x-auto px-5 sm:mx-0 sm:mt-16 sm:px-0'>
          <table className='w-full min-w-[520px] border-collapse text-[1.0625rem]'>
            <thead>
              <tr className='border-b border-ink/20'>
                <th scope='col' className='py-3 pe-4 text-start text-sm font-normal text-soft'>
                  {c.plans.module}
                </th>
                {PLANS.map((plan) => (
                  <th key={plan} scope='col' className='w-[17%] px-2 py-3 text-center text-xl font-semibold'>
                    {c.plans.names[plan]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className='border-b border-ink/10'>
                <th scope='row' className='py-3.5 pe-4 text-start font-medium'>
                  {c.plans.base}
                </th>
                {PLANS.map((plan) => (
                  <td key={plan} className='px-2'>
                    <Tick label={c.plans.included} />
                  </td>
                ))}
              </tr>
              {MODULES.map((module) => (
                <tr key={module} className='border-b border-ink/10'>
                  <th scope='row' className='py-3.5 pe-4 text-start font-medium'>
                    {c.plans.modules[module]}
                  </th>
                  {PLANS.map((plan) => (
                    <td key={plan} className='px-2 text-center'>
                      {includes(plan, module) ? <Tick label={c.plans.included} /> : <span className='text-sm text-soft'>{c.plans.addon}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className='mt-6 text-center text-[1.0625rem] text-soft'>{c.plans.price}</p>

        {/* The long list, for whoever wants every line of it; closed until asked for */}
        <details className='group mt-14 border-y border-ink/20'>
          <summary className='flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-xl font-semibold [&::-webkit-details-marker]:hidden'>
            {c.all.summary}
            <span aria-hidden className='text-3xl leading-none font-light transition-transform group-open:rotate-45'>
              +
            </span>
          </summary>
          <div className='columns-1 gap-x-10 pt-2 pb-6 sm:columns-2 lg:columns-3'>
            {c.all.groups.map((group) => (
              <div key={group.name} className='mb-8 break-inside-avoid'>
                <h3 className='pb-1 font-semibold'>{group.name}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={item} className='py-1 text-[0.9375rem] leading-snug text-soft'>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </Container>
    </section>
  )
}

// ——— The way in ——————————————————————————————————————————————————

export function Call() {
  const { c } = useLang()
  return (
    <section id='talk' className='scroll-mt-6 bg-mist py-28 text-center sm:py-44'>
      <Container>
        <h2 className='headline mx-auto max-w-[12ch] text-[clamp(2.75rem,8vw,6rem)]'>{c.cta.title}</h2>
        <ContactButtons className='mt-10 justify-center' />
      </Container>
    </section>
  )
}
