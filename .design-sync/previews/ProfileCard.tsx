import { ProfileCard } from 'manifund'
import { profile, regrantor } from '../mocks'

export const Default = () => (
  <div className="w-64 bg-gray-50 p-4">
    <ProfileCard profile={profile} sponsoredAmount={0} />
  </div>
)

export const SponsoredRegrantor = () => (
  <div className="w-64 bg-gray-50 p-4">
    <ProfileCard profile={regrantor} sponsoredAmount={250000} />
  </div>
)
