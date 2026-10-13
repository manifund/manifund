'use client'

import { useState } from 'react'
import { Card } from '@/components/layout/card'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { Input } from '@/components/input'
import { Button } from '@/components/button'
import {
  createMercuryRecipient,
  withdrawViaMercury,
  BankAccountInfo,
  RecipientInput,
} from './actions'
import {
  InternationalWireFields,
  useInternationalWireState,
} from './international-wire-form'

type AccountType = BankAccountInfo['electronicAccountType']

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'personalChecking', label: 'Personal Checking' },
  { value: 'personalSavings', label: 'Personal Savings' },
  { value: 'businessChecking', label: 'Business Checking' },
  { value: 'businessSavings', label: 'Business Savings' },
]

function Label(props: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={props.htmlFor}
      className="mb-1 block text-sm font-medium text-gray-700"
    >
      {props.children}
    </label>
  )
}

function Alert(props: {
  type: 'error' | 'success'
  children: React.ReactNode
}) {
  const cls =
    props.type === 'error'
      ? 'bg-rose-50 text-rose-800'
      : 'bg-emerald-50 text-emerald-800'
  return <div className={`rounded-md p-4 text-sm ${cls}`}>{props.children}</div>
}

// --- Bank info form (shown when no Mercury recipient exists) ---

type TransferType = 'domestic' | 'international'

export function BankInfoForm() {
  const [transferType, setTransferType] = useState<TransferType>('domestic')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bankInfo, setBankInfo] = useState<BankAccountInfo>({
    accountNumber: '',
    routingNumber: '',
    electronicAccountType: 'personalChecking',
    address: {
      address1: '',
      city: '',
      region: '',
      postalCode: '',
      country: 'US',
    },
  })
  const intlWireState = useInternationalWireState()

  const update = (patch: Partial<BankAccountInfo>) =>
    setBankInfo((prev) => ({ ...prev, ...patch }))
  const updateAddress = (patch: Partial<BankAccountInfo['address']>) =>
    setBankInfo((prev) => ({
      ...prev,
      address: { ...prev.address, ...patch },
    }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const input: RecipientInput =
        transferType === 'domestic'
          ? { type: 'domestic', bankInfo }
          : { type: 'international', wireInfo: intlWireState.wireInfo }
      const result = await createMercuryRecipient(input)
      if (result.success) {
        window.location.reload()
      } else {
        setError(result.error)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Col className="mx-auto max-w-2xl p-6">
      <form onSubmit={handleSubmit}>
        <Card>
          <Col className="gap-5">
            <div>
              <h1 className="text-2xl font-bold">Connect Your Bank Account</h1>
              <p className="mt-1 text-sm text-gray-600">
                Enter your bank account details to enable withdrawals.
              </p>
            </div>

            {/* Transfer type toggle */}
            <div className="flex rounded-lg border border-gray-300 p-1">
              <button
                type="button"
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  transferType === 'domestic'
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setTransferType('domestic')}
                disabled={submitting}
              >
                US Bank Transfer
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  transferType === 'international'
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setTransferType('international')}
                disabled={submitting}
              >
                International Wire
              </button>
            </div>

            {error && <Alert type="error">{error}</Alert>}

            {transferType === 'domestic' ? (
              <>
                <div>
                  <Label htmlFor="routingNumber">Routing Number</Label>
                  <Input
                    id="routingNumber"
                    placeholder="9 digits"
                    maxLength={9}
                    value={bankInfo.routingNumber}
                    onChange={(e) =>
                      update({
                        routingNumber: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    disabled={submitting}
                    required
                    className="w-full"
                  />
                </div>

                <div>
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    placeholder="Account number"
                    value={bankInfo.accountNumber}
                    onChange={(e) =>
                      update({
                        accountNumber: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    disabled={submitting}
                    required
                    className="w-full"
                  />
                </div>

                <div>
                  <Label htmlFor="accountType">Account Type</Label>
                  <select
                    id="accountType"
                    value={bankInfo.electronicAccountType}
                    onChange={(e) =>
                      update({
                        electronicAccountType: e.target.value as AccountType,
                      })
                    }
                    disabled={submitting}
                    className="h-12 w-full rounded-md border border-gray-300 bg-white px-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border-t pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">
                    Account Holder Address
                  </h3>
                  <Col className="gap-3">
                    <div>
                      <Label htmlFor="address1">Street Address</Label>
                      <Input
                        id="address1"
                        placeholder="123 Main St"
                        value={bankInfo.address.address1}
                        onChange={(e) =>
                          updateAddress({ address1: e.target.value })
                        }
                        disabled={submitting}
                        required
                        className="w-full"
                      />
                    </div>

                    <Row className="gap-3">
                      <div className="flex-1">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          placeholder="City"
                          value={bankInfo.address.city}
                          onChange={(e) =>
                            updateAddress({ city: e.target.value })
                          }
                          disabled={submitting}
                          required
                          className="w-full"
                        />
                      </div>
                      <div className="w-24">
                        <Label htmlFor="region">State</Label>
                        <Input
                          id="region"
                          placeholder="CA"
                          maxLength={2}
                          value={bankInfo.address.region}
                          onChange={(e) =>
                            updateAddress({
                              region: e.target.value.toUpperCase(),
                            })
                          }
                          disabled={submitting}
                          required
                          className="w-full"
                        />
                      </div>
                    </Row>

                    <Row className="gap-3">
                      <div className="flex-1">
                        <Label htmlFor="postalCode">ZIP Code</Label>
                        <Input
                          id="postalCode"
                          placeholder="12345"
                          maxLength={10}
                          value={bankInfo.address.postalCode}
                          onChange={(e) =>
                            updateAddress({ postalCode: e.target.value })
                          }
                          disabled={submitting}
                          required
                          className="w-full"
                        />
                      </div>
                      <div className="w-24">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          placeholder="US"
                          maxLength={2}
                          value={bankInfo.address.country}
                          onChange={(e) =>
                            updateAddress({
                              country: e.target.value.toUpperCase(),
                            })
                          }
                          disabled={submitting}
                          required
                          className="w-full"
                        />
                      </div>
                    </Row>
                  </Col>
                </div>
              </>
            ) : (
              <InternationalWireFields
                wireState={intlWireState}
                disabled={submitting}
              />
            )}

            <Button
              type="submit"
              size="lg"
              color="orange"
              className="w-full"
              disabled={submitting}
              loading={submitting}
            >
              {submitting ? 'Connecting...' : 'Connect Bank Account'}
            </Button>
          </Col>
        </Card>
      </form>
    </Col>
  )
}

// --- Recipient info + withdraw form (shown when Mercury recipient exists) ---

export function WithdrawForm(props: {
  recipientName: string
  accountLastFour: string | undefined
  accountType: string | undefined
  balance: number
}) {
  const { recipientName, accountLastFour, accountType } = props
  const [balance, setBalance] = useState(props.balance)
  const [amount, setAmount] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const accountTypeLabel =
    ACCOUNT_TYPES.find((t) => t.value === accountType)?.label ?? accountType

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const dollars = parseFloat(amount)
    if (isNaN(dollars) || dollars <= 0) {
      setError('Enter a valid amount')
      return
    }

    setWithdrawing(true)
    try {
      const result = await withdrawViaMercury(dollars)
      if (result.success) {
        setSuccess(`Withdrawal of $${dollars.toFixed(2)} submitted.`)
        setBalance((b) => b - dollars)
        setAmount('')
      } else {
        setError(result.error)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <Col className="mx-auto max-w-2xl gap-6 p-6">
      {/* Account info card */}
      <Card>
        <Col className="gap-4">
          <h2 className="text-lg font-bold">Bank Account on File</h2>
          <div className="space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
            <Row className="justify-between">
              <span className="text-gray-600">Name</span>
              <span className="font-medium">{recipientName}</span>
            </Row>
            {accountTypeLabel && (
              <Row className="justify-between">
                <span className="text-gray-600">Type</span>
                <span className="font-medium">{accountTypeLabel}</span>
              </Row>
            )}
            {accountLastFour && (
              <Row className="justify-between">
                <span className="text-gray-600">Account</span>
                <span className="font-medium">****{accountLastFour}</span>
              </Row>
            )}
          </div>
          <p className="text-xs text-gray-500">
            To update your bank info, contact austin@manifund.org.
          </p>
        </Col>
      </Card>

      {/* Withdraw card */}
      <Card>
        <form onSubmit={handleWithdraw}>
          <Col className="gap-5">
            <h2 className="text-lg font-bold">Withdraw Funds</h2>

            {success && <Alert type="success">{success}</Alert>}
            {error && <Alert type="error">{error}</Alert>}

            <div className="rounded-lg bg-gray-50 p-4">
              <Row className="justify-between">
                <span className="text-sm text-gray-600">
                  Available Balance
                </span>
                <span className="text-lg font-bold">
                  ${balance.toFixed(2)}
                </span>
              </Row>
            </div>

            <div>
              <Label htmlFor="amount">Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="100"
                  max={balance}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={withdrawing}
                  required
                  className="w-full pl-8"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              color="orange"
              className="w-full"
              disabled={withdrawing || !amount}
              loading={withdrawing}
            >
              {withdrawing ? 'Processing...' : 'Withdraw'}
            </Button>
          </Col>
        </form>
      </Card>
    </Col>
  )
}
