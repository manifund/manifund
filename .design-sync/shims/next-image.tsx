// Stand-in for next/image outside Next.js: a plain img.
import { forwardRef } from 'react'

const Image = forwardRef<HTMLImageElement, any>(function Image(props, ref) {
  const { src, alt, fill, priority, placeholder, blurDataURL, loader, quality, unoptimized, ...rest } =
    props
  const url = typeof src === 'string' ? src : src?.src
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={url} alt={alt ?? ''} {...rest} />
})
export default Image
