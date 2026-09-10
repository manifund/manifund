import { Input } from '@/components/input'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { InternationalWireInfo } from './actions'

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

const COUNTRY_SPECIFIC_FIELDS: Record<
  string,
  { label: string; key: string; placeholder: string }[]
> = {
  IN: [{ label: 'IFSC Code', key: 'ifscCode', placeholder: 'e.g. SBIN0001234' }],
  AU: [{ label: 'BSB Number', key: 'bsbNumber', placeholder: '6 digits' }],
  CA: [
    { label: 'Bank Code', key: 'bankCode', placeholder: '3 digits' },
    { label: 'Transit Number', key: 'transitNumber', placeholder: '5 digits' },
  ],
  HK: [{ label: 'Bank Code', key: 'bankCode', placeholder: '3 digits' }],
  SG: [{ label: 'Bank Code', key: 'bankCode', placeholder: 'Bank code' }],
  ZA: [{ label: 'Branch Code', key: 'branchCode', placeholder: '6 digits' }],
}

const SUPPORTED_COUNTRIES = [
  { code: '', label: 'None' },
  { code: 'IN', label: 'India' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'HK', label: 'Hong Kong' },
  { code: 'SG', label: 'Singapore' },
  { code: 'ZA', label: 'South Africa' },
]

export function useInternationalWireState() {
  const [wireInfo, setWireInfo] = useState<InternationalWireInfo>({
    swiftCode: '',
    iban: '',
    address: {
      address1: '',
      city: '',
      region: '',
      postalCode: '',
      country: '',
    },
    bankDetails: {
      bankName: '',
      bankCountry: '',
      cityState: '',
    },
  })
  const [countrySpecificCountry, setCountrySpecificCountry] = useState('')
  const [showCorrespondent, setShowCorrespondent] = useState(false)

  const updateWire = (patch: Partial<InternationalWireInfo>) =>
    setWireInfo((prev) => ({ ...prev, ...patch }))
  const updateAddress = (patch: Partial<InternationalWireInfo['address']>) =>
    setWireInfo((prev) => ({
      ...prev,
      address: { ...prev.address, ...patch },
    }))
  const updateBankDetails = (
    patch: Partial<InternationalWireInfo['bankDetails']>
  ) =>
    setWireInfo((prev) => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, ...patch },
    }))
  const updateCorrespondent = (
    patch: Partial<NonNullable<InternationalWireInfo['correspondentInfo']>>
  ) =>
    setWireInfo((prev) => ({
      ...prev,
      correspondentInfo: { ...prev.correspondentInfo, bankName: '', ...patch },
    }))
  const updateCountrySpecific = (key: string, value: string) =>
    setWireInfo((prev) => ({
      ...prev,
      countrySpecific: { ...prev.countrySpecific, [key]: value },
    }))

  return {
    wireInfo,
    countrySpecificCountry,
    setCountrySpecificCountry,
    showCorrespondent,
    setShowCorrespondent,
    updateWire,
    updateAddress,
    updateBankDetails,
    updateCorrespondent,
    updateCountrySpecific,
  }
}

// Need to import useState
import { useState } from 'react'

export function InternationalWireFields(props: {
  wireState: ReturnType<typeof useInternationalWireState>
  disabled: boolean
}) {
  const {
    wireInfo,
    countrySpecificCountry,
    setCountrySpecificCountry,
    showCorrespondent,
    setShowCorrespondent,
    updateWire,
    updateAddress,
    updateBankDetails,
    updateCorrespondent,
    updateCountrySpecific,
  } = props.wireState
  const disabled = props.disabled

  const countryFields = countrySpecificCountry
    ? COUNTRY_SPECIFIC_FIELDS[countrySpecificCountry]
    : undefined

  return (
    <Col className="gap-5">
      {/* SWIFT & IBAN */}
      <Row className="gap-3">
        <div className="flex-1">
          <Label htmlFor="swiftCode">SWIFT / BIC Code</Label>
          <Input
            id="swiftCode"
            placeholder="e.g. CHASUS33"
            maxLength={11}
            value={wireInfo.swiftCode}
            onChange={(e) =>
              updateWire({ swiftCode: e.target.value.toUpperCase() })
            }
            disabled={disabled}
            required
            className="w-full"
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="iban">IBAN / Account Number</Label>
          <Input
            id="iban"
            placeholder="e.g. GB29 NWBK 6016 1331 9268 19"
            value={wireInfo.iban}
            onChange={(e) => updateWire({ iban: e.target.value })}
            disabled={disabled}
            required
            className="w-full"
          />
        </div>
      </Row>

      {/* Bank Details */}
      <div className="border-t pt-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Bank Details
        </h3>
        <Col className="gap-3">
          <div>
            <Label htmlFor="bankName">Bank Name</Label>
            <Input
              id="bankName"
              placeholder="e.g. HSBC Holdings"
              value={wireInfo.bankDetails.bankName}
              onChange={(e) => updateBankDetails({ bankName: e.target.value })}
              disabled={disabled}
              required
              className="w-full"
            />
          </div>
          <Row className="gap-3">
            <div className="flex-1">
              <Label htmlFor="bankCityState">City / State</Label>
              <Input
                id="bankCityState"
                placeholder="London"
                value={wireInfo.bankDetails.cityState}
                onChange={(e) =>
                  updateBankDetails({ cityState: e.target.value })
                }
                disabled={disabled}
                required
                className="w-full"
              />
            </div>
            <div className="w-32">
              <Label htmlFor="bankCountry">Country Code</Label>
              <Input
                id="bankCountry"
                placeholder="GB"
                maxLength={2}
                value={wireInfo.bankDetails.bankCountry}
                onChange={(e) =>
                  updateBankDetails({
                    bankCountry: e.target.value.toUpperCase(),
                  })
                }
                disabled={disabled}
                required
                className="w-full"
              />
            </div>
          </Row>
        </Col>
      </div>

      {/* Recipient Address */}
      <div className="border-t pt-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Recipient Address
        </h3>
        <Col className="gap-3">
          <div>
            <Label htmlFor="intlAddress1">Street Address</Label>
            <Input
              id="intlAddress1"
              placeholder="123 Main St"
              value={wireInfo.address.address1}
              onChange={(e) => updateAddress({ address1: e.target.value })}
              disabled={disabled}
              required
              className="w-full"
            />
          </div>
          <Row className="gap-3">
            <div className="flex-1">
              <Label htmlFor="intlCity">City</Label>
              <Input
                id="intlCity"
                placeholder="City"
                value={wireInfo.address.city}
                onChange={(e) => updateAddress({ city: e.target.value })}
                disabled={disabled}
                required
                className="w-full"
              />
            </div>
            <div className="w-32">
              <Label htmlFor="intlRegion">Region</Label>
              <Input
                id="intlRegion"
                placeholder="State"
                value={wireInfo.address.region}
                onChange={(e) => updateAddress({ region: e.target.value })}
                disabled={disabled}
                required
                className="w-full"
              />
            </div>
          </Row>
          <Row className="gap-3">
            <div className="flex-1">
              <Label htmlFor="intlPostalCode">Postal Code</Label>
              <Input
                id="intlPostalCode"
                placeholder="Postal code"
                value={wireInfo.address.postalCode}
                onChange={(e) => updateAddress({ postalCode: e.target.value })}
                disabled={disabled}
                required
                className="w-full"
              />
            </div>
            <div className="w-32">
              <Label htmlFor="intlCountry">Country</Label>
              <Input
                id="intlCountry"
                placeholder="GB"
                maxLength={2}
                value={wireInfo.address.country}
                onChange={(e) =>
                  updateAddress({ country: e.target.value.toUpperCase() })
                }
                disabled={disabled}
                required
                className="w-full"
              />
            </div>
          </Row>
        </Col>
      </div>

      {/* Country-Specific Fields */}
      <div className="border-t pt-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Country-Specific Requirements (Optional)
        </h3>
        <div>
          <Label htmlFor="countrySpecific">Country</Label>
          <select
            id="countrySpecific"
            value={countrySpecificCountry}
            onChange={(e) => setCountrySpecificCountry(e.target.value)}
            disabled={disabled}
            className="h-12 w-full rounded-md border border-gray-300 bg-white px-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {countryFields && (
          <Col className="mt-3 gap-3">
            {countryFields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  placeholder={field.placeholder}
                  value={wireInfo.countrySpecific?.[field.key] ?? ''}
                  onChange={(e) =>
                    updateCountrySpecific(field.key, e.target.value)
                  }
                  disabled={disabled}
                  className="w-full"
                />
              </div>
            ))}
          </Col>
        )}
      </div>

      {/* Correspondent Bank (Optional) */}
      <div className="border-t pt-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showCorrespondent}
            onChange={(e) => setShowCorrespondent(e.target.checked)}
            disabled={disabled}
          />
          <span className="font-medium text-gray-700">
            Add Correspondent / Intermediary Bank
          </span>
        </label>
        {showCorrespondent && (
          <Col className="mt-3 gap-3">
            <div>
              <Label htmlFor="corrBankName">Correspondent Bank Name</Label>
              <Input
                id="corrBankName"
                placeholder="Bank name"
                value={wireInfo.correspondentInfo?.bankName ?? ''}
                onChange={(e) =>
                  updateCorrespondent({ bankName: e.target.value })
                }
                disabled={disabled}
                className="w-full"
              />
            </div>
            <Row className="gap-3">
              <div className="flex-1">
                <Label htmlFor="corrRouting">Routing Number</Label>
                <Input
                  id="corrRouting"
                  placeholder="Optional"
                  value={wireInfo.correspondentInfo?.routingNumber ?? ''}
                  onChange={(e) =>
                    updateCorrespondent({ routingNumber: e.target.value })
                  }
                  disabled={disabled}
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="corrSwift">SWIFT Code</Label>
                <Input
                  id="corrSwift"
                  placeholder="Optional"
                  value={wireInfo.correspondentInfo?.swiftCode ?? ''}
                  onChange={(e) =>
                    updateCorrespondent({
                      swiftCode: e.target.value.toUpperCase(),
                    })
                  }
                  disabled={disabled}
                  className="w-full"
                />
              </div>
            </Row>
          </Col>
        )}
      </div>
    </Col>
  )
}
