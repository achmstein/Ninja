/**
 * What a customer sees when the café's stack is off (suspended by the
 * platform, or stopped): the edge answers every API call with a 503 that
 * says "paused", and there is nothing else to show. Both languages at once:
 * this can render before the brand, and with it the language, is known.
 */
export function PausedScreen() {
  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center'>
      <div className='flex size-16 items-center justify-center rounded-2xl bg-neutral-900 text-2xl font-bold text-white'>N</div>
      <div className='space-y-2'>
        <p className='text-lg font-semibold'>This menu is paused right now.</p>
        <p className='text-lg font-semibold' dir='rtl' lang='ar'>
          القائمة متوقفة مؤقتًا.
        </p>
      </div>
      <p className='max-w-sm text-sm text-neutral-500'>
        Please check back later. · من فضلك جرّب تاني بعدين.
      </p>
    </div>
  )
}
