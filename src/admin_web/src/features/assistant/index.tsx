import { useState } from 'react'
import {
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  ListChecks,
  Lock,
  ShieldCheck,
  SquareTerminal,
  Unplug,
} from 'lucide-react'
import { PLATFORM_NAME, useApiOrigin, useBrandName } from '@/lib/brand'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InfoTip } from '@/components/info-tip'
import { SettingsCard } from '@/components/kit'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { claudeCodeCommand, mcpUrl } from './connect'
import { PersonalityCard } from './personality-card'
import { RoutinesCard } from './routines'

type Vendor = 'claude' | 'chatgpt'

const VENDORS: {
  key: Vendor
  name: string
  logo: string
  /** The logo is black on its own: it turns white on a dark card */
  invertDark?: boolean
  where: TranslationKey
}[] = [
  {
    key: 'claude',
    name: 'Claude',
    logo: '/vendors/claude.svg',
    where: 'assistantClaudeWhereShort',
  },
  {
    key: 'chatgpt',
    name: 'ChatGPT',
    logo: '/vendors/chatgpt.svg',
    invertDark: true,
    where: 'assistantChatGptWhereShort',
  },
]

/** One short line a step; the longer sentence behind its ⓘ. `address` puts the copy field under it. */
type Step = { line: TranslationKey; more?: TranslationKey; address?: boolean }

const STEPS: Record<Vendor, Step[]> = {
  claude: [
    { line: 'assistantStepClaude1', more: 'assistantClaude1' },
    { line: 'assistantStepClaude2', address: true },
    { line: 'assistantStepClaude3', more: 'assistantClaude3' },
    { line: 'assistantStepClaude4', more: 'assistantClaude4' },
  ],
  chatgpt: [
    { line: 'assistantStepChatGpt1', more: 'assistantChatGpt1' },
    { line: 'assistantStepChatGpt2', address: true },
    { line: 'assistantStepChatGpt3', more: 'assistantChatGpt3' },
    { line: 'assistantStepChatGpt4', more: 'assistantChatGpt4' },
  ],
}

const TOPICS: TranslationKey[] = [
  'assistantTopicSales',
  'assistantTopicProfit',
  'assistantTopicExpenses',
  'assistantTopicStock',
  'assistantTopicStaff',
  'assistantTopicDrawer',
]

/** Example questions; the last two change something, so the assistant asks first. */
const PROMPTS: { key: TranslationKey; write?: boolean }[] = [
  { key: 'assistantAsk1' },
  { key: 'assistantAsk2' },
  { key: 'assistantAsk3' },
  { key: 'assistantAsk4' },
  { key: 'assistantAsk5', write: true },
  { key: 'assistantAsk6', write: true },
]

const SAFETY: { key: TranslationKey; icon: React.ElementType }[] = [
  { key: 'assistantSafeOwner', icon: ShieldCheck },
  { key: 'assistantSafeConfirm', icon: ListChecks },
  { key: 'assistantSafeChats', icon: Lock },
  { key: 'assistantSafeDisconnect', icon: Unplug },
]

const TROUBLE: { q: TranslationKey; a: TranslationKey }[] = [
  { q: 'assistantTroubleOwnerQ', a: 'assistantTroubleOwnerA' },
  { q: 'assistantTroubleReachQ', a: 'assistantTroubleReachA' },
  { q: 'assistantTroubleChatGptQ', a: 'assistantTroubleChatGptA' },
]

const VENDOR_KEY = 'ninja.assistant.vendor'

/** The app the owner picked last time, on this browser only. */
function rememberedVendor(): Vendor {
  try {
    return localStorage.getItem(VENDOR_KEY) === 'chatgpt' ? 'chatgpt' : 'claude'
  } catch {
    return 'claude'
  }
}

function copy(value: string, message: string) {
  navigator.clipboard.writeText(value)
  toast.success(message)
}

/**
 * The owner's assistant: every business stack runs an MCP server at its API
 * host's /mcp. The owner adds it once as a custom connector in Claude or
 * ChatGPT, signs in against the business's own realm (Owner role only), and
 * asks. Nothing here talks to the server; this page is the how-to: pick the
 * app, follow its four steps, try a question. How it speaks and its ready
 * routines sit in their own tabs.
 */
export function AssistantPage() {
  const t = useT()

  return (
    <Main>
      <PageHeader
        title={t('assistantNav')}
        description={t('assistantDescription')}
      />

      <Tabs defaultValue='connect' className='gap-4'>
        <TabsList className='w-full sm:w-fit'>
          <TabsTrigger value='connect' className='px-4'>
            {t('assistantTabConnect')}
          </TabsTrigger>
          <TabsTrigger value='routines' className='px-4'>
            {t('assistantTabRoutines')}
          </TabsTrigger>
          <TabsTrigger value='personality' className='px-4'>
            {t('assistantPersonalityTitle')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='connect' className='space-y-4'>
          <ConnectSection />
        </TabsContent>

        {/* The server's prompts, one tap in Claude */}
        <TabsContent value='routines'>
          <RoutinesCard />
        </TabsContent>

        {/* How it speaks: the business's own name, tone, manner, language and notes */}
        <TabsContent value='personality'>
          <PersonalityCard />
        </TabsContent>
      </Tabs>
    </Main>
  )
}

function ConnectSection() {
  const t = useT()
  const url = mcpUrl(useApiOrigin())
  const name = useBrandName() || PLATFORM_NAME
  const [vendor, setVendor] = useState<Vendor>(rememberedVendor)
  const current = VENDORS.find((v) => v.key === vendor)!

  const pick = (next: Vendor) => {
    setVendor(next)
    try {
      localStorage.setItem(VENDOR_KEY, next)
    } catch {
      // A private window: the choice just isn't remembered
    }
  }

  return (
    <>
      {/* First the app, then only its steps */}
      <section className='bg-card overflow-hidden rounded-xl shadow-sm'>
        <div className='px-5 pt-5'>
          <h2 className='font-semibold tracking-tight'>
            {t('assistantPickApp')}
          </h2>
        </div>
        <div
          role='radiogroup'
          aria-label={t('assistantPickApp')}
          className='grid grid-cols-2 gap-3 p-5'
        >
          {VENDORS.map((v) => (
            <VendorTile
              key={v.key}
              vendor={v}
              where={t(v.where)}
              checked={vendor === v.key}
              onPick={() => pick(v.key)}
            />
          ))}
        </div>

        <div className='border-border/60 border-t px-5 py-5'>
          <div className='mb-5 flex items-center gap-1'>
            <h3 className='font-semibold tracking-tight'>
              {t('assistantStepsTitle', { app: current.name })}
            </h3>
            <InfoTip>{t('assistantAddressHint')}</InfoTip>
          </div>
          <Stepper
            key={vendor}
            steps={STEPS[vendor].map((step) => (
              <>
                <div className='flex items-center gap-1'>
                  <p>{t(step.line, { name })}</p>
                  {step.more && <InfoTip>{t(step.more, { name })}</InfoTip>}
                </div>
                {step.address && (
                  <CopyField
                    value={url}
                    copied={t('appsAddressCopied')}
                    large
                  />
                )}
              </>
            ))}
          />
        </div>

        {/* Claude Code: the same server, one command in a terminal */}
        {vendor === 'claude' && <ClaudeCode url={url} />}
      </section>

      <TryAsking />

      {/* Why an owner can hand it their numbers, and what to do when it won't connect */}
      <SettingsCard>
        <Folded icon={ShieldCheck} title={t('assistantSafeTitle')}>
          <ul className='space-y-3'>
            {SAFETY.map(({ key, icon: Icon }) => (
              <li key={key} className='flex items-center gap-3'>
                <span className='bg-muted grid size-8 shrink-0 place-items-center rounded-lg'>
                  <Icon className='text-muted-foreground size-4' />
                </span>
                <span className='min-w-0 flex-1'>{t(key)}</span>
              </li>
            ))}
          </ul>
        </Folded>
        <Folded icon={CircleHelp} title={t('assistantTroubleTitle')}>
          <dl className='space-y-4'>
            {TROUBLE.map(({ q, a }) => (
              <div key={q} className='space-y-1'>
                <dt className='font-medium'>{t(q)}</dt>
                <dd className='text-muted-foreground'>{t(a)}</dd>
              </div>
            ))}
          </dl>
        </Folded>
      </SettingsCard>
    </>
  )
}

/** One of the two apps, as a large tile with its logo: a radio in a pair. */
function VendorTile({
  vendor,
  where,
  checked,
  onPick,
}: {
  vendor: (typeof VENDORS)[number]
  where: string
  checked: boolean
  onPick: () => void
}) {
  return (
    <button
      type='button'
      role='radio'
      aria-checked={checked}
      onClick={onPick}
      className={cn(
        'focus-visible:ring-ring/50 relative flex flex-col items-center gap-3 rounded-xl border px-3 py-5 text-center transition-all outline-none focus-visible:ring-[3px] sm:flex-row sm:px-4 sm:text-start',
        checked
          ? 'border-foreground bg-muted/40 ring-foreground ring-1'
          : 'hover:bg-muted/40 hover:border-foreground/30'
      )}
    >
      <span className='bg-background grid size-12 shrink-0 place-items-center rounded-xl border shadow-xs'>
        <img
          src={vendor.logo}
          alt=''
          className={cn('size-7', vendor.invertDark && 'dark:invert')}
        />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block text-base font-semibold tracking-tight'>
          {vendor.name}
        </span>
        <span className='text-muted-foreground block text-xs'>{where}</span>
      </span>
      <span
        className={cn(
          'absolute end-2.5 top-2.5 grid size-5 place-items-center rounded-full transition-all sm:static',
          checked
            ? 'bg-foreground text-background scale-100'
            : 'border-border scale-90 border'
        )}
      >
        {checked && <Check className='size-3' strokeWidth={3} />}
      </span>
    </button>
  )
}

/** Numbered steps on a thin line, fading in when the app changes. */
function Stepper({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className='animate-in fade-in-0 slide-in-from-bottom-1 duration-300'>
      {steps.map((step, i) => (
        <li key={i} className='relative flex gap-4 pb-6 last:pb-0'>
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className='bg-border absolute start-[13px] top-8 bottom-1 w-px'
            />
          )}
          <span className='bg-foreground text-background grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums'>
            {i + 1}
          </span>
          <div className='min-w-0 flex-1 space-y-3 pt-1 text-sm'>{step}</div>
        </li>
      ))}
    </ol>
  )
}

function ClaudeCode({ url }: { url: string }) {
  const t = useT()
  return (
    <Collapsible className='border-border/60 border-t'>
      <CollapsibleTrigger className='group hover:bg-muted/40 text-muted-foreground hover:text-foreground flex w-full items-center gap-3 px-5 py-3.5 text-start text-sm transition-colors'>
        <SquareTerminal className='size-4 shrink-0' />
        <span className='flex-1'>{t('assistantClaudeCodeToggle')}</span>
        <ChevronDown className='size-4 transition-transform group-data-[state=open]:rotate-180' />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className='px-5 pt-1 pb-5'>
          <Stepper
            steps={[
              <>
                <p>{t('assistantClaudeCode1')}</p>
                <CopyField
                  value={claudeCodeCommand(url)}
                  copied={t('assistantCommandCopied')}
                />
              </>,
              t('assistantClaudeCode2'),
              t('assistantClaudeCode3'),
              t('assistantClaudeCode4'),
            ]}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Something to try first: a tap copies the question. */
function TryAsking() {
  const t = useT()
  return (
    <SettingsCard
      title={t('assistantTryTitle')}
      description={t('assistantAskHint')}
    >
      <div className='space-y-4 px-5 py-4'>
        <div className='flex flex-wrap gap-2'>
          {PROMPTS.map(({ key, write }) => (
            <button
              key={key}
              type='button'
              onClick={() => copy(t(key), t('assistantPromptCopied'))}
              title={write ? t('assistantWriteTag') : undefined}
              className='group hover:bg-accent focus-visible:ring-ring/50 bg-background inline-flex max-w-full items-center gap-2 rounded-full border px-3.5 py-2 text-start text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px]'
            >
              {write && (
                <ListChecks
                  className='text-muted-foreground size-3.5 shrink-0'
                  aria-label={t('assistantWriteTag')}
                />
              )}
              <span className='min-w-0'>{t(key)}</span>
              <Copy className='text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100' />
            </button>
          ))}
        </div>
        <p className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'>
          <span className='flex items-center gap-1.5'>
            <ListChecks className='size-3.5' />
            {t('assistantWriteTag')}
          </span>
          <span aria-hidden>·</span>
          <span>
            {t('assistantAskAbout')} {TOPICS.map((key) => t(key)).join(' · ')}
          </span>
        </p>
      </div>
    </SettingsCard>
  )
}

/** A row that opens to its detail: what's needed now and then, folded away. */
function Folded({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger className='group hover:bg-muted/40 flex w-full items-center gap-3 px-5 py-4 text-start text-sm font-medium transition-colors'>
        <Icon className='text-muted-foreground size-4 shrink-0' />
        <span className='flex-1'>{title}</span>
        <ChevronDown className='text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180' />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className='px-5 pb-5 text-sm'>{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** A value to paste elsewhere, always left to right, with its copy button. */
function CopyField({
  value,
  copied,
  large,
}: {
  value: string
  copied: string
  large?: boolean
}) {
  const t = useT()
  return (
    <div
      className={cn(
        'bg-muted/50 flex items-center gap-2 rounded-lg border',
        large ? 'p-2 ps-4' : 'p-1.5 ps-3'
      )}
    >
      <code
        dir='ltr'
        className={cn(
          'min-w-0 flex-1 text-left font-mono break-all',
          large ? 'text-sm font-medium' : 'text-xs'
        )}
      >
        {value}
      </code>
      <Button
        type='button'
        size='sm'
        variant={large ? 'default' : 'outline'}
        className='shrink-0'
        onClick={() => copy(value, copied)}
      >
        <Copy />
        {t('copy')}
      </Button>
    </div>
  )
}
