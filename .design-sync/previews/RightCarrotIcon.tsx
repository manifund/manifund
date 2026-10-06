import { RightCarrotIcon } from 'manifund'

export const Sizes = () => (
  <div className="flex items-center gap-4 text-gray-600">
    <RightCarrotIcon size={12} />
    <RightCarrotIcon />
    <RightCarrotIcon size={24} />
    <RightCarrotIcon size={32} className="text-orange-500" />
  </div>
)
