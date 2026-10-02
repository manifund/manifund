import Mention from '@tiptap/extension-mention'
import { mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react'
import { mentionSuggestion } from './mention-suggestion'
import { UserMention, UserMentionNodeView } from './user-mention'

const name = 'mention-component'

/**
 *  Mention extension that renders React. See:
 *  https://tiptap.dev/guide/custom-extensions#extend-existing-extensions
 *  https://tiptap.dev/guide/node-views/react#render-a-react-component
 */
export const DisplayMention = Mention.extend({
  parseHTML: () => [{ tag: name }, { tag: `a[data-type="${name}"]` }],
  renderHTML: ({ HTMLAttributes }) => [
    name,
    mergeAttributes(HTMLAttributes),
    `@${HTMLAttributes['data-label'] || ''}`,
  ],
  // Note: Manifold uses nodeviewMiddleware wrapper instead of addNodeView; see
  // https://github.com/manifoldmarkets/manifold/pull/1275/files
  addNodeView: () => ReactNodeViewRenderer(UserMentionNodeView, { className: 'inline-block' }),
  renderReact: (attrs: any) => <UserMention username={attrs.label} id={attrs.id} />,
}).configure({ suggestion: mentionSuggestion })
