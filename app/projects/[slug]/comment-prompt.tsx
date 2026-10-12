'use client'
import { createContext, useContext, useState } from 'react'

// A vote or donation at the top of the page can prompt the viewer to comment in the tabs below.
// The two parts render separately (the tabs stream in later), so the prompt is shared here.
type CommentPrompt = {
  prompt?: string
  setPrompt: (prompt: string | undefined) => void
}

const CommentPromptContext = createContext<CommentPrompt>({ setPrompt: () => {} })

export function CommentPromptProvider(props: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<string | undefined>(undefined)
  return (
    <CommentPromptContext.Provider value={{ prompt, setPrompt }}>
      {props.children}
    </CommentPromptContext.Provider>
  )
}

export function useCommentPrompt() {
  return useContext(CommentPromptContext)
}
