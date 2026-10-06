import { IconButton } from 'manifund'
import { PencilIcon, TrashIcon, LinkIcon } from '@heroicons/react/20/solid'

export const Icons = () => (
  <div className="flex items-center gap-1">
    <IconButton>
      <PencilIcon className="h-5 w-5" />
    </IconButton>
    <IconButton>
      <LinkIcon className="h-5 w-5" />
    </IconButton>
    <IconButton>
      <TrashIcon className="h-5 w-5" />
    </IconButton>
  </div>
)

export const Disabled = () => (
  <IconButton disabled>
    <TrashIcon className="h-5 w-5" />
  </IconButton>
)
