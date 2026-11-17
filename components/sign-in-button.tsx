import { buttonClass, ColorType, SizeType } from '@/components/button'
import { useSafeLayoutEffect } from '@/hooks/use-safe-layout-effect'
import clsx from 'clsx'
import Link from 'next/link'
import { useState } from 'react'

export const SignInButton = (props: {
  buttonText: string
  className?: string
  size?: SizeType
  color?: ColorType
}) => {
  const { buttonText, className, size = 'xl', color = 'gradient' } = props
  const [pathname, setPathname] = useState('')
  useSafeLayoutEffect(() => {
    setPathname(window.location.pathname)
  })
  return (
    <Link href={`/login?next=${pathname}`} className={clsx(buttonClass(size, color), className)}>
      {buttonText}
    </Link>
  )
}
