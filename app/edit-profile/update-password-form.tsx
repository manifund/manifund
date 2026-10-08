'use client'

import { useState } from 'react'
import { useSupabase } from '@/db/supabase-provider'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Col } from '@/components/layout/col'
import { PasswordInput } from '@/components/password-input'

interface UpdatePasswordFormProps {
  onSuccess?: () => void
  stayOpen?: boolean
  title?: string
}

export function UpdatePasswordForm({
  onSuccess,
  stayOpen = false,
  title,
}: UpdatePasswordFormProps) {
  const { supabase } = useSupabase()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(stayOpen)

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }

    setPasswordSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        setPasswordError(error.message)
      } else {
        setPassword('')
        setConfirmPassword('')
        setShowPasswordForm(false)
        if (onSuccess) {
          onSuccess()
        }
      }
    } catch (error) {
      setPasswordError('An unexpected error occurred')
    } finally {
      setPasswordSubmitting(false)
    }
  }

  return (
    <div className="pt-4">
      {title && <h3 className="mb-4 text-lg font-medium text-gray-900">{title}</h3>}

      {!showPasswordForm ? (
        <Button type="button" onClick={() => setShowPasswordForm(true)} className="mb-4">
          {title || 'Update Password'}
        </Button>
      ) : (
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <Col className="gap-1">
            <PasswordInput
              as={Input}
              id="current-password"
              name="current-password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </Col>

          <Col className="gap-1">
            <PasswordInput
              as={Input}
              id="confirm-current-password"
              name="confirm-current-password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </Col>

          {passwordError && <div className="text-sm text-red-600">{passwordError}</div>}

          <div className="flex gap-2">
            <Button type="submit" disabled={passwordSubmitting} loading={passwordSubmitting}>
              {passwordSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
            {!stayOpen && (
              <Button
                type="button"
                color="gray-outline"
                onClick={() => {
                  setShowPasswordForm(false)
                  setPassword('')
                  setConfirmPassword('')
                  setPasswordError('')
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
