import { EmptyContent } from 'manifund'
import { DocumentPlusIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'

export const Action = () => (
  <div className="w-[28rem]">
    <EmptyContent
      onClick={() => {}}
      icon={<DocumentPlusIcon className="h-10 w-10 text-gray-400" />}
      title="No projects yet"
      subtitle="Create your first project to start fundraising."
    />
  </div>
)

export const Static = () => (
  <div className="w-[28rem]">
    <EmptyContent
      icon={<ChatBubbleLeftRightIcon className="h-10 w-10 text-gray-400" />}
      subtitle="No comments yet."
    />
  </div>
)
