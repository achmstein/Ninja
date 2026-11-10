import type { CSSProperties } from 'react'
import { useLang } from '@/lib/lang'
import { includes, MODULES, PLANS } from '@/plans/plans'
import { ContactButtons, Container } from './chrome'
import { Clip } from './clip'

/** A clip cut to the screen at work is 812 × 756; the whole stage is 16 : 9 */
const CUT = '812 / 756'
const STAGE = '16 / 9'

// ——— The top: the headline, and one order going through every app ————

export function Hero() {
  const { c } = useLang()
  return (
    <section>
      <Container className='pt-8 pb-10 sm:pt-14 sm:pb-12'>
        <h1 className='display max-w-[12ch] text-[clamp(3.1rem,10.5vw,8.75rem)]'>{c.hero.title}</h1>
        <div className='mt-8 flex flex-col gap-6 sm:mt-10 lg:flex-row lg:items-center lg:justify-between'>
          <p className='display text-[clamp(1.4rem,2.6vw,2.1rem)] text-soft'>{c.hero.lead}</p>
          <ContactButtons />
        </div>
      </Container>
      <div className='px-3 sm:px-6'>
        <Clip name='journey' label={c.hero.clip} ratio={STAGE} className='mx-auto max-w-[1500px] rounded-[22px] shadow-[0_40px_90px_-40px_rgb(15_23_42/.5)] sm:rounded-[40px]' />
      </div>
    </section>
  )
}

// ——— The reel: every part of Ninja as a scene and a few words ————————
// Three audiences, each laid out its own way: a rail to swipe along, a wall, a deck.

type Group = { name: string; clips: { id: string; title: string }[] }

const GroupName = ({ children }: { children: string }) => (
  <Container className='pt-14 pb-7 sm:pt-24 sm:pb-10'>
    <h2 className='display text-[clamp(2.6rem,8vw,6.5rem)]'>{children}</h2>
  </Container>
)

/** For guests: tall cards side by side, more of them than fit, moved along by hand */
function Rail({ group }: { group: Group }) {
  return (
    <div>
      <GroupName>{group.name}</GroupName>
      <div className='no-bar flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:gap-6 sm:px-[max(2rem,calc((100vw-1320px)/2+2rem))]'>
        {group.clips.map((clip) => (
          <article key={clip.id} className='w-[min(84vw,520px)] shrink-0 snap-center rounded-[26px] bg-white p-5 sm:rounded-[40px] sm:p-7'>
            <h3 className='display min-h-[2.1em] text-[clamp(1.8rem,3.4vw,2.9rem)]'>{clip.title}</h3>
            <Clip name={clip.id} label={clip.title} ratio={CUT} className='mt-5 rounded-[18px] sm:rounded-[26px]' />
          </article>
        ))}
      </div>
    </div>
  )
}

/** For the team: one dark wall with the three screens side by side, working at once */
function Wall({ group }: { group: Group }) {
  return (
    <div className='mt-14 bg-night pb-10 text-white sm:mt-24 sm:pb-20'>
      <GroupName>{group.name}</GroupName>
      <Container className='grid gap-10 md:grid-cols-3 md:gap-6 lg:gap-10'>
        {group.clips.map((clip) => (
          <article key={clip.id}>
            <Clip name={clip.id} label={clip.title} ratio={CUT} className='rounded-[18px] sm:rounded-[26px]' />
            <h3 className='display mt-5 max-w-[14ch] text-[clamp(1.7rem,2.9vw,2.6rem)]'>{clip.title}</h3>
          </article>
        ))}
      </Container>
    </div>
  )
}

/** For the owner: a deck. On a wide page each card stops at the top and the next slides over it, a step lower */
function Deck({ group }: { group: Group }) {
  return (
    <div className='px-3 pb-10 sm:px-6 sm:pb-16'>
      <GroupName>{group.name}</GroupName>
      <div className='mx-auto flex max-w-[1500px] flex-col gap-4 sm:gap-6'>
        {group.clips.map((clip, i) => (
          <article
            key={clip.id}
            className='reel-card grid items-center gap-6 overflow-hidden rounded-[26px] bg-counter p-5 shadow-[0_-18px_40px_-28px_rgb(15_23_42/.45)] sm:rounded-[44px] sm:p-8 lg:grid-cols-[1fr_minmax(0,46%)] lg:gap-10 lg:p-10'
            style={{ '--i': i } as CSSProperties}
          >
            <h3 className='display max-w-[12ch] text-[clamp(2.1rem,5.4vw,5.25rem)] lg:ps-6'>{clip.title}</h3>
            <Clip name={clip.id} label={clip.title} ratio={CUT} className='rounded-[18px] sm:rounded-[30px] lg:max-w-[min(660px,calc((100svh-13rem)*1.074))] lg:justify-self-end' />
          </article>
        ))}
      </div>
    </div>
  )
}

export function Reel() {
  const { c } = useLang()
  const [guests, team, owner] = c.reel
  return (
    <section id='reel' className='scroll-mt-6'>
      <Rail group={guests} />
      <Wall group={team} />
      <Deck group={owner} />
    </section>
  )
}

// ——— Plans ———————————————————————————————————————————————————————

const Tick = ({ label }: { label: string }) => (
  <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.8' strokeLinecap='round' strokeLinejoin='round' role='img' aria-label={label} className='mx-auto'>
    <path d='M20 6 9 17l-5-5' />
  </svg>
)

export function Plans() {
  const { c } = useLang()
  return (
    <section id='plans' className='scroll-mt-6 py-14 sm:py-24'>
      <Container>
        <h2 className='display max-w-[16ch] text-[clamp(2.4rem,7vw,5.75rem)]'>{c.plans.title}</h2>
        <div className='no-bar -mx-5 mt-10 overflow-x-auto px-5 sm:mx-0 sm:mt-14 sm:px-0'>
          <table className='w-full min-w-[520px] border-collapse text-lg'>
            <thead>
              <tr className='border-b-2 border-ink'>
                <th scope='col' className='py-3 pe-4 text-start text-base font-medium text-soft'>
                  {c.plans.module}
                </th>
                {PLANS.map((plan) => (
                  <th key={plan} scope='col' className='display w-[17%] px-2 py-3 text-center text-[clamp(1.4rem,2.6vw,2.2rem)]'>
                    {c.plans.names[plan]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className='border-b border-ink/10'>
                <th scope='row' className='py-3.5 pe-4 text-start font-semibold'>
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
                  <th scope='row' className='py-3.5 pe-4 text-start font-semibold'>
                    {c.plans.modules[module]}
                  </th>
                  {PLANS.map((plan) => (
                    <td key={plan} className='px-2 text-center'>
                      {includes(plan, module) ? <Tick label={c.plans.included} /> : <span className='text-sm font-medium text-soft'>{c.plans.addon}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className='mt-6 text-lg font-medium text-soft'>{c.plans.price}</p>

        {/* The long list, for whoever wants every line of it; closed until asked for */}
        <details className='group mt-14 border-y-2 border-ink'>
          <summary className='display flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[clamp(1.5rem,3vw,2.4rem)] [&::-webkit-details-marker]:hidden'>
            {c.all.summary}
            <span aria-hidden className='text-[1.4em] leading-none font-normal transition-transform group-open:rotate-45'>
              +
            </span>
          </summary>
          <div className='columns-1 gap-x-12 pt-4 pb-6 sm:columns-2 lg:columns-4'>
            {c.all.groups.map((group) => (
              <div key={group.name} className='mb-8 break-inside-avoid'>
                <h3 className='pb-1 text-lg font-bold'>{group.name}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={item} className='border-t border-ink/10 py-2 text-[0.9375rem] leading-snug'>
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
    <section id='talk' className='scroll-mt-6 px-3 sm:px-6'>
      <div className='mx-auto max-w-[1500px] rounded-[26px] bg-counter px-2 py-16 sm:rounded-[44px] sm:py-28'>
        <Container>
          <h2 className='display max-w-[11ch] text-[clamp(3rem,10vw,8.5rem)]'>{c.cta.title}</h2>
          <ContactButtons className='mt-10 sm:mt-14' />
        </Container>
      </div>
    </section>
  )
}
