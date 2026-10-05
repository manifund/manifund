import { NodeViewWrapper } from '@tiptap/react'
import clsx from 'clsx'
import { SiteLink } from '../site-link'

const name = 'user-mention'
export const UserMentionNodeView = (props: any) => {
  return (
    <NodeViewWrapper className={clsx(name, 'not-prose text-orange-600')}>
      <UserMention username={props.node.attrs.label} id={props.node.attrs.id} />
    </NodeViewWrapper>
  )
}

// Links by user id when the mention has one (all editor mentions do), so renamed users' old
// mentions still reach them: /people/id/<id> redirects to the current username.
export const UserMention = (props: { username: string; id?: string }) => {
  const { username, id } = props
  return (
    <SiteLink href={id ? `/people/id/${id}` : `/${username}`} followsLinkClass>
      @{username}
    </SiteLink>
  )
}
