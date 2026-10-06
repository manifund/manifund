import { FeatureCard } from 'manifund'
import { BoltIcon, EyeIcon } from '@heroicons/react/20/solid'

export const Linked = () => (
  <div className="w-72">
    <FeatureCard
      icon={<BoltIcon className="h-6 w-6" />}
      title="Fast funding"
      description="Regrantors can commit money within days, without a committee round."
      url="/about/regranting"
    />
  </div>
)

export const CustomLinkText = () => (
  <div className="w-72">
    <FeatureCard
      icon={<EyeIcon className="h-6 w-6" />}
      title="Transparent by default"
      description="Every proposal, offer and comment is public."
      url="/projects"
      linkText="Browse projects"
    />
  </div>
)
