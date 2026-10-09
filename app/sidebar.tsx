import { createServerSupabaseClient } from '@/db/supabase-server'
import Link from 'next/link'
import React from 'react'
import Image from 'next/image'
import { getUser, getProfileById, Profile } from '@/db/profile'
import { SidebarItem } from './sidebar-item'
import { SUPABASE_ENV } from '@/db/env'
import { Avatar } from '@/components/avatar'
import { formatMoney } from '@/utils/formatting'
import { calculateCashBalance, calculateCharityBalance } from '@/utils/math'
import { getTxnAndProjectsByUser } from '@/db/txn'
import { buttonClass } from '@/components/button'
import clsx from 'clsx'
import { Row } from '@/components/layout/row'
import { DepositButton } from '@/components/deposit-buttons'
import { Col } from '@/components/layout/col'
import { Tooltip } from '@/components/tooltip'
import { PlusSmallIcon } from '@heroicons/react/24/outline'
import { getPendingBidsByUser } from '@/db/bid'

export const revalidate = 30
export default async function Sidebar() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  const profile = user ? await getProfileById(supabase, user.id) : null
  const isRegranter = profile?.regranter_status
  const { count: unreadNotifications } = user
    ? await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
    : { count: 0 }
  return (
    <>
      <div className="lg:col-span-3" />
      <nav
        aria-label="Sidebar"
        className="fixed top-0 hidden h-[100vh] justify-between divide-gray-300 self-start pl-2 pr-2 pt-10 lg:col-span-3 lg:flex lg:flex-col"
      >
        <Col>
          <Link href="/">
            <div className="group flex flex-row items-center gap-1">
              <Image
                src="/Manifox.png"
                alt="Manifund fox"
                className="max-w-[50px] -translate-y-2 transition-all group-hover:-translate-y-3 lg:max-w-[60px]"
                width={100}
                height={100}
              />
              <span className="bg-gradient-to-r from-orange-500  to-rose-400 bg-clip-text font-josefin text-3xl font-[650] text-transparent lg:text-4xl">
                {SUPABASE_ENV === 'PROD' ? 'Manifund' : 'Devifund'}
              </span>
            </div>
          </Link>
          <div className="h-6" />
          {profile && <ProfileSummary profile={profile} />}
          {user === undefined && <div className="h-[56px]" />}
          <SidebarItem item={{ name: 'Home', href: '/' }} />
          {user === null && (
            <SidebarItem
              item={{
                name: 'Login',
                href: `/login`,
              }}
            />
          )}
          <SidebarItem
            item={{
              name: 'About',
              children: [
                { name: 'Manifund', href: '/about' },
                { name: 'Donor FAQ', href: '/about/donor-faq' },
                { name: 'Regranting', href: '/about/regranting' },
                { name: 'Where regrantors give', href: '/about/regranting-data' },
                { name: 'Karma', href: '/about/karma' },
                { name: 'Funder Bulletin', href: '/ais-funder-bulletin' },
                // { name: 'Impact markets', href: '/about/impact-certificates' },
                // { name: 'Applying for funding', href: '/about/open-call' },
                { name: 'API & MCP', href: '/docs' },
              ],
            }}
          />
          {user && (
            <SidebarItem
              item={{
                name: unreadNotifications
                  ? `Notifications (${unreadNotifications})`
                  : 'Notifications',
                href: '/notifications',
              }}
            />
          )}
          <SidebarItem item={{ name: 'People', href: '/people' }} />
          <SidebarItem item={{ name: 'Orgs', href: '/orgs' }} />
          <SidebarItem item={{ name: 'Categories', href: '/causes' }} />
          <SidebarItem item={{ name: 'Newsletter', href: 'https://manifund.substack.com' }} />
          {user && (
            <Link
              href={isRegranter ? '/create-grant' : '/create'}
              className={clsx(buttonClass('xl', 'gradient'), 'mt-4 w-52 bg-gradient-to-r')}
            >
              {isRegranter ? 'Give a grant' : 'Create a project'}
            </Link>
          )}
        </Col>
        <Row className="gap-5 px-3 py-10">
          <a
            className="text-xs text-orange-500 hover:text-orange-600"
            href="https://discord.gg/ZGsDMWSA5Q"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="currentColor"
              className="bi bi-discord"
              viewBox="0 0 16 16"
            >
              <path d="M13.545 2.907a13.227 13.227 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.018-.011 8.875 8.875 0 0 1-1.248-.595.05.05 0 0 1-.02-.066.051.051 0 0 1 .015-.019c.084-.063.168-.129.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.052.052 0 0 1 .053.007c.08.066.164.132.248.195a.051.051 0 0 1-.004.085 8.254 8.254 0 0 1-1.249.594.05.05 0 0 0-.03.03.052.052 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.034.034 0 0 0-.02-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z" />
            </svg>
          </a>
          <a
            className="text-xs text-orange-500 hover:text-orange-600"
            href="https://manifund.substack.com/"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              fill="currentColor"
              className="bi bi-bookmark-fill"
              viewBox="0 0 16 16"
            >
              <path d="M2 2v13.5a.5.5 0 0 0 .74.439L8 13.069l5.26 2.87A.5.5 0 0 0 14 15.5V2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
            </svg>
          </a>
        </Row>
      </nav>
    </>
  )
}

export async function ProfileSummary(props: { profile: Profile }) {
  const { profile } = props
  const supabase = await createServerSupabaseClient()
  const txns = await getTxnAndProjectsByUser(supabase, profile.id)
  const bids = await getPendingBidsByUser(supabase, profile.id)
  const cashBalance = calculateCashBalance(txns, bids, profile.id, profile.accreditation_status)
  const charityBalance = calculateCharityBalance(
    txns,
    bids,
    profile.id,
    profile.accreditation_status
  )
  return (
    <Row className="group mb-3 items-center gap-2 truncate rounded-md px-1 py-3 text-gray-600 hover:bg-gray-100 hover:text-gray-800">
      <Avatar username={profile.username} avatarUrl={profile.avatar_url} id={profile.id} />
      <Col className="w-full items-start">
        <Link href={`/${profile.username}`} className="w-full font-medium">
          {profile.full_name}
        </Link>
        <Row className="w-full items-start gap-3">
          <Col>
            <span className="text-sm">
              {formatMoney(Math.max(charityBalance, 0) + Math.min(cashBalance, 0))}
            </span>
          </Col>
          <DepositButton userId={profile.id}>
            <div className="rounded bg-orange-500 p-0.5 shadow">
              <Tooltip text="Add funds" placement="left">
                <PlusSmallIcon className="h-4 w-4 stroke-2 text-white" />
              </Tooltip>
            </div>
          </DepositButton>
        </Row>
      </Col>
    </Row>
  )
}
