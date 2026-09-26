import {
  ChevronDown,
  CircleHelp,
  Copy,
  ListChecks,
  Lock,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Unplug,
} from 'lucide-react'
import { PLATFORM_NAME, useApiOrigin, useBrandName } from '@/lib/brand'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { claudeCodeCommand, mcpUrl } from './connect'
import { PersonalityCard } from './personality-card'
import { RoutinesCard } from './routines'

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

function copy(value: string, message: string) {
  navigator.clipboard.writeText(value)
  toast.success(message)
}

/**
 * The owner's assistant: every café stack runs an MCP server at its API
 * host's /mcp. The owner adds it once as a custom connector in Claude or
 * ChatGPT, signs in against the café's own realm (Owner role only), and
 * asks. Nothing here talks to the server; this page is the how-to.
 */
export function AssistantPage() {
  const t = useT()
  const url = mcpUrl(useApiOrigin())
  const command = claudeCodeCommand(url)
  const name = useBrandName() || PLATFORM_NAME
  const address = <CopyField value={url} copied={t('appsAddressCopied')} />

  return (
    <Main>
      <div className='mx-auto w-full max-w-3xl space-y-6'>
        <PageHeader title={t('assistantNav')} description={t('assistantDescription')} />

        {/* The one thing to carry over: the address */}
        <Card>
          <CardContent className='space-y-4 pt-6'>
            <div className='flex items-start gap-3'>
              <div className='bg-muted grid size-10 shrink-0 place-items-center rounded-lg'>
                <Sparkles className='size-5' />
              </div>
              <div className='min-w-0 space-y-1'>
                <h2 className='font-semibold'>{t('assistantAddressTitle')}</h2>
                <p className='text-muted-foreground text-sm'>{t('assistantAddressHint')}</p>
              </div>
            </div>
            <CopyField value={url} copied={t('appsAddressCopied')} large />
            <div className='flex flex-wrap gap-1.5'>
              {TOPICS.map((key) => (
                <Badge key={key} variant='outline' className='text-muted-foreground font-normal'>
                  {t(key)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Per client: where to paste it and how to sign in */}
        <Card>
          <CardContent className='space-y-4 pt-6'>
            <h2 className='font-semibold'>{t('assistantConnectTitle')}</h2>
            <Tabs defaultValue='claude' className='gap-4'>
              <TabsList className='grid h-auto w-full grid-cols-3'>
                <TabsTrigger value='claude' className='py-1.5'>Claude</TabsTrigger>
                <TabsTrigger value='claude-code' className='py-1.5'>Claude Code</TabsTrigger>
                <TabsTrigger value='chatgpt' className='py-1.5'>ChatGPT</TabsTrigger>
              </TabsList>

              <TabsContent value='claude' className='space-y-4'>
                <p className='text-muted-foreground text-xs'>{t('assistantClaudeWhere')}</p>
                <Steps
                  steps={[
                    t('assistantClaude1'),
                    <>
                      <p>{t('assistantClaude2', { name })}</p>
                      {address}
                    </>,
                    t('assistantClaude3'),
                    t('assistantClaude4'),
                  ]}
                />
              </TabsContent>

              <TabsContent value='claude-code' className='space-y-4'>
                <p className='text-muted-foreground text-xs'>{t('assistantClaudeCodeWhere')}</p>
                <Steps
                  steps={[
                    <>
                      <p>{t('assistantClaudeCode1')}</p>
                      <CopyField value={command} copied={t('assistantCommandCopied')} />
                    </>,
                    t('assistantClaudeCode2'),
                    t('assistantClaudeCode3'),
                    t('assistantClaudeCode4'),
                  ]}
                />
              </TabsContent>

              <TabsContent value='chatgpt' className='space-y-4'>
                <p className='text-muted-foreground text-xs'>{t('assistantChatGptWhere')}</p>
                <Steps
                  steps={[
                    t('assistantChatGpt1'),
                    <>
                      <p>{t('assistantChatGpt2', { name })}</p>
                      {address}
                    </>,
                    t('assistantChatGpt3'),
                    t('assistantChatGpt4'),
                  ]}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* How it speaks: the café's own name, tone, manner, language and notes */}
        <PersonalityCard />

        {/* The server's prompts, one tap in Claude */}
        <RoutinesCard />

        {/* Something to try first */}
        <Card>
          <CardContent className='space-y-4 pt-6'>
            <div className='space-y-1'>
              <h2 className='font-semibold'>{t('assistantAskTitle')}</h2>
              <p className='text-muted-foreground text-sm'>{t('assistantAskHint')}</p>
            </div>
            <div className='grid gap-2 sm:grid-cols-2'>
              {PROMPTS.map(({ key, write }) => (
                <button
                  key={key}
                  type='button'
                  onClick={() => copy(t(key), t('assistantPromptCopied'))}
                  className='group hover:bg-accent focus-visible:ring-ring/50 flex items-start gap-3 rounded-lg border p-3 text-start text-sm transition-colors outline-none focus-visible:ring-[3px]'
                >
                  <MessageSquareText className='text-muted-foreground mt-0.5 size-4 shrink-0' />
                  <span className='flex min-w-0 flex-1 flex-col items-start gap-1.5'>
                    <span>{t(key)}</span>
                    {write && <Badge variant='secondary'>{t('assistantWriteTag')}</Badge>}
                  </span>
                  <Copy className='text-muted-foreground mt-0.5 size-4 shrink-0 opacity-60 transition-opacity group-hover:opacity-100' />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Why an owner can hand it their numbers */}
        <Card>
          <CardContent className='space-y-4 pt-6'>
            <h2 className='font-semibold'>{t('assistantSafeTitle')}</h2>
            <ul className='space-y-3'>
              {SAFETY.map(({ key, icon: Icon }) => (
                <li key={key} className='flex items-start gap-3 text-sm'>
                  <Icon className='text-muted-foreground mt-0.5 size-4 shrink-0' />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className='py-0'>
          <Collapsible>
            <CollapsibleTrigger className='group flex w-full items-center gap-3 px-6 py-4 text-start font-semibold'>
              <CircleHelp className='text-muted-foreground size-4 shrink-0' />
              <span className='flex-1'>{t('assistantTroubleTitle')}</span>
              <ChevronDown className='text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180' />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <dl className='space-y-4 border-t px-6 py-4 text-sm'>
                {TROUBLE.map(({ q, a }) => (
                  <div key={q} className='space-y-1'>
                    <dt className='font-medium'>{t(q)}</dt>
                    <dd className='text-muted-foreground'>{t(a)}</dd>
                  </div>
                ))}
              </dl>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>
    </Main>
  )
}

function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className='space-y-4'>
      {steps.map((step, i) => (
        <li key={i} className='flex gap-3'>
          <span className='bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums'>
            {i + 1}
          </span>
          <div className='min-w-0 flex-1 space-y-2 pt-0.5 text-sm leading-relaxed'>
            {step}
          </div>
        </li>
      ))}
    </ol>
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
          large ? 'text-sm font-medium sm:text-base' : 'text-xs'
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
        <Copy className='size-4' />
        {t('copy')}
      </Button>
    </div>
  )
}
