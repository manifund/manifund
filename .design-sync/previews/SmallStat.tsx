import { SmallStat } from 'manifund'
import {
  ArrowTrendingUpIcon,
  ChatBubbleLeftEllipsisIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'

export const Row = () => (
  <div className="flex items-center gap-4">
    <SmallStat
      statData={{ label: 'Total raised', value: '$62,500', icon: CurrencyDollarIcon, show: true }}
    />
    <SmallStat
      statData={{ label: 'Comments', value: '14', icon: ChatBubbleLeftEllipsisIcon, show: true }}
    />
    <SmallStat
      statData={{ label: 'Valuation', value: '$180K', icon: ArrowTrendingUpIcon, show: true }}
    />
  </div>
)
