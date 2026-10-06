// Stand-in for next/link outside Next.js: a plain anchor.
import { forwardRef } from 'react'

const Link = forwardRef<HTMLAnchorElement, any>(function Link(props, ref) {
  const { href, prefetch, replace, scroll, shallow, passHref, legacyBehavior, locale, ...rest } =
    props
  const url = typeof href === 'string' ? href : (href?.pathname ?? '#')
  return <a ref={ref} href={url} {...rest} />
})
export default Link
