// The preview card a fund's link unfurls into (F12): its cover, name, mission, admins and facts,
// laid out like the cover at the top of its page.

export type FundOgCardProps = {
  name: string
  mission?: string | null
  // data: URLs, fetched ahead so one slow or missing image can't break the card
  cover?: string
  admins: { name: string; avatar?: string }[]
  facts: { label: string; value: string }[]
  open: boolean
  fox: string
}

export function FundOgCard(props: FundOgCardProps) {
  const { name, mission, cover, admins, facts, open, fox } = props
  return (
    <div
      tw="flex w-full h-full relative"
      style={{ backgroundImage: 'linear-gradient(135deg, #fde68a, #fdba74 45%, #fb7185)' }}
    >
      {cover && (
        <img
          src={cover}
          tw="absolute inset-0"
          style={{ width: 1200, height: 630, objectFit: 'cover' }}
        />
      )}
      <div
        tw="absolute inset-0 flex"
        style={{
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.25) 100%)',
        }}
      />

      <div tw="absolute top-12 left-16 right-16 flex items-center justify-between">
        <div tw="flex items-center">
          <img src={fox} width={44} height={44} />
          <span tw="ml-3 text-[30px] text-white">Manifund</span>
        </div>
        {open && (
          <div tw="flex items-center rounded-full bg-white/90 px-5 py-2 text-[22px] text-emerald-700">
            <div tw="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-3" />
            Taking applications
          </div>
        )}
      </div>

      <div tw="absolute bottom-14 left-16 right-16 flex flex-col">
        <div tw="text-[92px] leading-none text-white" style={{ letterSpacing: '-0.03em' }}>
          {name}
        </div>
        {mission && (
          <div tw="mt-5 text-[36px] leading-tight text-white/90" style={{ maxWidth: 980 }}>
            {mission}
          </div>
        )}
        {(admins.length > 0 || facts.length > 0) && (
          <div tw="mt-9 flex items-center justify-between">
            {admins.length > 0 ? (
              <div tw="flex items-center">
                <span tw="text-[22px] text-white/70 mr-4">Run by</span>
                {admins.map((admin) => (
                  <div
                    key={admin.name}
                    tw="flex items-center rounded-full bg-white/20 py-1.5 pl-1.5 pr-5 mr-3 text-[22px] text-white"
                  >
                    {admin.avatar ? (
                      <img
                        src={admin.avatar}
                        width={36}
                        height={36}
                        tw="rounded-full mr-3"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div tw="w-9 h-9 rounded-full bg-orange-300 mr-3" />
                    )}
                    {admin.name}
                  </div>
                ))}
              </div>
            ) : (
              <div />
            )}
            <div tw="flex">
              {facts.map((fact) => (
                <div key={fact.label} tw="flex flex-col ml-10">
                  <span tw="text-[18px] text-white/60">{fact.label}</span>
                  <span tw="mt-1 text-[26px] text-white">{fact.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Fetches an image into a data: URL, or undefined if it doesn't arrive within a few seconds.
export async function imageDataUrl(url: string | null | undefined, timeoutMs = 4000) {
  if (!url) return undefined
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    const type = res.headers.get('content-type') ?? ''
    // The renderer reads PNG, JPEG and GIF
    if (!res.ok || !/^image\/(png|jpeg|gif)/.test(type)) return undefined
    const bytes = Buffer.from(await res.arrayBuffer())
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return undefined
  }
}
