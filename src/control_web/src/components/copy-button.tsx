import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

/** Copies a value to the clipboard; the icon confirms for a moment. */
export function CopyButton({ value }: { value: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(id)
  }, [copied])

  return (
    <Button
      variant='ghost'
      size='icon'
      className='size-8'
      onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}
    >
      {copied ? <Check className='size-4' /> : <Copy className='size-4' />}
      <span className='sr-only'>{copied ? t('copied') : t('copy')}</span>
    </Button>
  )
}
