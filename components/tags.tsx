'use client'
import React from 'react'
import { getRoundTheme } from '@/utils/constants'
import clsx from 'clsx'
import Link from 'next/link'
import {
  EllipsisHorizontalCircleIcon,
  XCircleIcon,
  CheckCircleIcon,
  PencilIcon,
  BuildingLibraryIcon,
  GlobeEuropeAfricaIcon,
  LightBulbIcon,
  BeakerIcon,
  StarIcon,
  EyeSlashIcon,
  UserGroupIcon,
  MegaphoneIcon,
  SparklesIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline'
import { FireIcon } from '@heroicons/react/24/solid'
import Image from 'next/image'
import { Row } from './layout/row'
import { Tooltip } from './tooltip'
import { Col } from './layout/col'
import { LuBrainCircuit } from 'react-icons/lu'
import { BiDonateHeart, BiHeart } from 'react-icons/bi'
import { TbCrystalBall, TbWorldX } from 'react-icons/tb'
import { PiBirdBold, PiVirusBold } from 'react-icons/pi'
import { MdOutlineMedicalServices } from 'react-icons/md'
import { PiSpiralBold } from 'react-icons/pi'
import { ArrowTrendingUpIcon, CheckBadgeIcon } from '@heroicons/react/20/solid'
import { Project } from '@/db/project'

const COLORS = [
  'bg-indigo-100',
  'bg-gray-100',
  'bg-blue-100',
  'bg-orange-100',
  'bg-emearld-100',
  'bg-rose-100',
  'bg-indigo-200',
  'bg-gray-200',
  'bg-blue-200',
  'bg-orange-200',
  'bg-emearld-200',
  'bg-rose-200',
  'bg-indigo-400',
  'bg-gray-400',
  'bg-blue-400',
  'bg-rose-400',
  'bg-orange-400',
  'bg-emerald-400',
  'text-indigo-700',
  'text-gray-700',
  'text-blue-700',
  'text-rose-700',
  'text-orange-700',
  'text-emerald-700',
]

export function RoundTag(props: { roundTitle: string; roundSlug?: string }) {
  const { roundTitle, roundSlug } = props
  const roundTheme = getRoundTheme(roundTitle)
  if (roundSlug) {
    return (
      <Link href={`/rounds/${roundSlug}`}>
        <p
          className={clsx(
            'inline-flex max-h-5 truncate whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-5 hover:underline hover:decoration-2',
            `text-${roundTheme}-700`,
            `bg-${roundTheme}-200`
          )}
        >
          {roundTitle}
        </p>
      </Link>
    )
  }
  return (
    <p
      className={clsx(
        'inline-flex max-h-5 truncate whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-5',
        `text-${roundTheme}-700`,
        `bg-${roundTheme}-200`
      )}
    >
      {roundTitle}
    </p>
  )
}

const CAUSE_ICONS = {
  tais: <LuBrainCircuit className="h-3 w-3" />,
  regrants: <BiDonateHeart className="h-3 w-3" />,
  'acx-mini-grants': <TbCrystalBall className="h-3 w-3 stroke-[2.2px]" />,
  'ai-worldviews': <PencilIcon className="h-3 w-3 stroke-2" />,
  biosec: <PiVirusBold className="h-3 w-3" />,
  gcr: <TbWorldX className="h-3 w-3" />,
  'ai-gov': <BuildingLibraryIcon className="h-3 w-3 stroke-2" />,
  'animal-welfare': <PiBirdBold className="h-3 w-3" />,
  ghd: <GlobeEuropeAfricaIcon className="h-3 w-3 stroke-2" />,
  ea: <LightBulbIcon className="h-3 w-3 stroke-2" />,
  science: <BeakerIcon className="h-3 w-3 stroke-2" />,
  forecasting: <ArrowTrendingUpIcon className="h-3 w-3 stroke-2" />,
  'manifold-community': (
    <Image className="h-4 w-4" src="/ManifoldIcon.svg" width="50" height="50" alt="Manifold icon" />
  ),
  'china-talk': <StarIcon className="h-3 w-3 stroke-2" />,
  'acx-grants-2024': <PiSpiralBold className="h-3 w-3" />,
  medical: <MdOutlineMedicalServices className="h-3 w-3" />,
  'ais-fieldbuilding': <UserGroupIcon className="h-3 w-3 stroke-2" />,
  'ais-advocacy': <MegaphoneIcon className="h-3 w-3 stroke-2" />,
  'digital-minds': <SparklesIcon className="h-3 w-3 stroke-2" />,
  epistemics: <ScaleIcon className="h-3 w-3 stroke-2" />,
} as { [key: string]: React.JSX.Element }

export function CauseTag(props: {
  causeTitle: string
  causeSlug: string
  noLink?: boolean
  className?: string
}) {
  const { causeTitle, causeSlug, noLink, className } = props
  const causeIcon = CAUSE_ICONS[causeSlug] ?? <BiHeart className="h-3 w-3" />
  if (noLink) {
    return (
      <div
        className={clsx(
          'flex max-h-5 max-w-fit flex-1 items-center gap-1 whitespace-nowrap rounded-full bg-gray-100 px-2 text-xs font-semibold leading-5 text-gray-800 hover:bg-gray-200 hover:decoration-2',
          className
        )}
      >
        {causeIcon}
        <span className="font-light">{causeTitle}</span>
      </div>
    )
  }
  return (
    <Link
      href={`/causes/${causeSlug}`}
      className={clsx(
        'flex max-h-5 max-w-fit flex-1 items-center gap-1 whitespace-nowrap rounded-full bg-gray-100 px-2 text-xs font-semibold leading-5 text-gray-800 hover:bg-gray-200 hover:decoration-2',
        className
      )}
    >
      {causeIcon}
      <span className="font-light">{causeTitle}</span>
    </Link>
  )
}

export function StageIcon(props: { stage: Project['stage']; className?: string }) {
  const { stage, className } = props
  const i = {
    icon: {
      draft: PencilIcon,
      proposal: EllipsisHorizontalCircleIcon,
      active: FireIcon,
      'not funded': XCircleIcon,
      complete: CheckCircleIcon,
      hidden: EyeSlashIcon,
    }[stage],
  }
  return <i.icon className={className} />
}

export function RegranterTag() {
  return (
    <Tooltip text="Regranters can receive donations from other users and give grants to the projects and organizations of their choice.">
      <Row className="max-w-fit gap-0.5 rounded-full bg-orange-100 px-2  pt-1 text-center">
        <CheckBadgeIcon className="relative bottom-0.5 m-auto h-4 w-4 stroke-2 text-orange-500" />
        <div className="relative bottom-0.5 text-sm leading-tight text-orange-500">regrantor</div>
      </Row>
    </Tooltip>
  )
}

export function Tag(props: { text: string; color?: string; className?: string }) {
  const { text, color = 'orange', className } = props
  return (
    <div
      className={`line-clamp-1 flex max-w-fit items-center overflow-ellipsis rounded-sm px-2 py-1 text-xs font-semibold bg-${color}-100 text-${color}-700 ${className}`}
    >
      {text}
    </div>
  )
}

export function SponsoredTag(props: { text: string; className?: string }) {
  const { text } = props
  return (
    <Tooltip text={`Sponsored for ${text}`}>
      <span className="inline-flex items-center gap-x-1.5 rounded-md bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-600">
        {text}
      </span>
    </Tooltip>
  )
}

export function RequiredStar() {
  return <span className="relative bottom-1 mx-1 text-rose-500">*</span>
}
