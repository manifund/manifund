import { SiteLink } from 'manifund'

export const Inline = () => (
  <p className="text-sm text-gray-700">
    Read about{' '}
    <SiteLink href="/about/regranting" followsLinkClass className="text-orange-600">
      how regranting works
    </SiteLink>{' '}
    before applying.
  </p>
)

export const External = () => (
  <SiteLink href="https://manifund.org" followsLinkClass className="text-sm text-orange-600">
    manifund.org
  </SiteLink>
)
