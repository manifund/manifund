import { Tabs } from 'manifund'

const panel = (text: string) => <p className="text-sm text-gray-600">{text}</p>

const TABS = [
  { name: 'Comments', id: 'comments', count: 14, display: panel('14 comments on this project.') },
  { name: 'Offers', id: 'offers', count: 6, display: panel('6 pending offers totalling $18,500.') },
  { name: 'Updates', id: 'updates', display: panel('No updates posted yet.') },
]

export const FirstTab = () => (
  <div className="w-[36rem]">
    <Tabs tabs={TABS} />
  </div>
)

export const SecondTab = () => (
  <div className="w-[36rem]">
    <Tabs tabs={TABS} currentTabId="offers" />
  </div>
)
