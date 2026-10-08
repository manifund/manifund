'use client'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import {
  ComponentType,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

type InputProps = React.JSX.IntrinsicElements['input']

/**
 * A password field with a show/hide button at its right edge. The field goes back to hidden when its form is
 * submitted. `as` renders the field with another input component (e.g. our `Input`); `className` styles the field.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputProps, 'type' | 'ref'> & { as?: ComponentType<any> }
>(({ as: Field = 'input', className, ...rest }, ref) => {
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selection = useRef<[number | null, number | null] | null>(null)
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  // Hide again on submit, so a revealed password isn't left on screen after signing in.
  useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return
    const hide = () => setVisible(false)
    form.addEventListener('submit', hide)
    return () => form.removeEventListener('submit', hide)
  }, [])

  // Switching the type can move the caret in some browsers: put it back where it was.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input || !selection.current || document.activeElement !== input) return
    const [start, end] = selection.current
    input.setSelectionRange(start, end)
    selection.current = null
  }, [visible])

  const toggle = () => {
    const input = inputRef.current
    if (input) selection.current = [input.selectionStart, input.selectionEnd]
    setVisible((v) => !v)
  }

  return (
    <div className="relative">
      <Field
        ref={inputRef}
        type={visible ? 'text' : 'password'}
        className={clsx(className, 'w-full pr-11')}
        {...rest}
      />
      <button
        type="button"
        onClick={toggle}
        // Keep focus (and the caret) in the field when clicked with a mouse.
        onMouseDown={(e) => e.preventDefault()}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={rest.id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500"
      >
        {visible ? (
          <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
        ) : (
          <EyeIcon className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'
