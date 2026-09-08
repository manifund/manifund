'use client'

import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { MouseEvent } from 'react'
import Image from 'next/image'
import alea from 'alea'

export function Avatar(props: {
  username: string
  avatarUrl: string | null
  id: string
  noLink?: boolean
  size?: number | 'xxs' | 'xs' | 'sm'
  className?: string
}) {
  const { username, avatarUrl, id, noLink, size, className } = props
  const router = useRouter()
  const s = size == 'xxs' ? 4 : size == 'xs' ? 6 : size === 'sm' ? 8 : size || 12
  const sizeInPx = s * 4

  const onClick = (e: MouseEvent) => {
    if (!noLink && username) {
      e.stopPropagation()
      router.push(`/${username}`)
    }
  }

  return avatarUrl ? (
    <Image
      width={sizeInPx * 2}
      height={sizeInPx * 2}
      className={clsx(
        'my-0 flex-shrink-0 rounded-full bg-white object-cover',
        `w-${s} h-${s}`,
        !noLink && 'cursor-pointer',
        className
      )}
      style={{ maxWidth: `${s * 0.25}rem` }}
      src={avatarUrl}
      onClick={onClick}
      alt={`${username ?? 'Unknown user'} avatar`}
    />
  ) : (
    <div onClick={onClick} className={clsx(className, 'rounded-full', !noLink && 'cursor-pointer')}>
      <GeneratedAvatar seed={id} size={s} aria-hidden="true" />
    </div>
  )
}

export function GeneratedAvatar(props: { seed: string; size?: number }) {
  const { seed, size = 8 } = props
  const num = alea(seed)()

  const [fromNum, toNum, emojiNum, directionNum] = [
    Math.round(num * Math.pow(10, 16)),
    Math.round(num * Math.pow(10, 12)),
    Math.round(num * Math.pow(10, 8)),
    Math.round(num * Math.pow(10, 4)),
  ]
  const [fromIdx, toIdx, emojiIdx] = [
    fromNum % fromColors.length,
    toNum % toColors.length,
    emojiNum % emojis.length,
  ]

  const [fromColor, toColor, emoji, direction] = [
    fromColors[fromIdx],
    toColors[toIdx],
    emojis[emojiIdx],
    // 1/3 change radial gradient
    directionNum % 3
      ? gradientDirections[directionNum % gradientDirections.length]
      : 'bg-gradient-radial',
  ]

  const emojiSize =
    size < 8
      ? 'text-xs'
      : size < 12
        ? 'text-lg'
        : size < 16
          ? 'text-xl'
          : size < 24
            ? 'text-3xl'
            : 'text-5xl'

  return (
    <div
      className={clsx(
        'flex flex-shrink-0 items-center justify-center rounded-full',
        direction,
        fromColor,
        toColor,
        emojiSize
      )}
      // Inline size: template classes like h-${size} aren't seen by Tailwind's scanner
      style={{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem` }}
    >
      {emoji}
    </div>
  )
}

const gradientDirections = [
  'bg-gradient-to-t',
  'bg-gradient-to-tr',
  'bg-gradient-to-r',
  'bg-gradient-to-br',
  'bg-gradient-to-b',
  'bg-gradient-to-bl',
  'bg-gradient-to-l',
  'bg-gradient-to-tl',
]

const fromColors = [
  'to-red-100',
  'to-orange-100',
  'to-amber-100',
  'to-yellow-100',
  'to-lime-100',
  'to-green-100',
  'to-emerald-100',
  'to-teal-100',
  'to-cyan-100',
  'to-sky-100',
  'to-blue-100',
  'to-indigo-100',
  'to-violet-100',
  'to-purple-100',
  'to-fuchsia-100',
  'to-pink-100',
  'to-rose-100',
]

const toColors = [
  'from-red-400',
  'from-orange-400',
  'from-amber-400',
  'from-yellow-400',
  'from-lime-400',
  'from-green-400',
  'from-emerald-400',
  'from-teal-400',
  'from-cyan-400',
  'from-sky-400',
  'from-blue-400',
  'from-indigo-400',
  'from-violet-400',
  'from-purple-400',
  'from-fuchsia-400',
  'from-pink-400',
  'from-rose-400',
]

const emojis = [
  '🍉',
  '🍎',
  '🍇',
  '🍊',
  '🍋',
  '🍍',
  '🍒',
  '🍓',
  '🥥',
  '🥭',
  '🥑',
  '🥕',
  '🌽',
  '🌶',
  '🥦',
  '🍄',
  '🥨',
  '🍩',
  '🌸',
  '🌻',
  '🌳',
  '🌷',
  '🌴',
  '🐳',
  '🦋',
  '🦄',
  '🐙',
  '🐝',
  '🐞',
  '🦀',
  '🐢',
  '🐠',
  '🐬',
  '🐸',
  '🐌',
  '🦑',
  '🐭',
  '🐶',
  '🐻',
  '🐼',
  '🐨',
  '🐯',
  '🦁',
  '🐷',
  '🐹',
  '🐮',
  '🐵',
  '🐔',
  '🐧',
  '🐤',
  '🐰',
]
