'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

type Address = {
  street?: string
  city?: string
  state?: string
  postalCode?: string
  countryCode?: string
}

type Emails = {
  account?: string
  bookings?: string
  management?: string
  operations?: string
  replyTo?: string
}

type EmailPreferences = {
  marketing: boolean
  updates: boolean
  system: boolean
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Step 1: Company Information
  const [companyName, setCompanyName] = useState('')
  const [fullName, setFullName] = useState('')
  const [abn, setAbn] = useState('')
  const [acn, setAcn] = useState('')
  const [website, setWebsite] = useState('')
  const [scac, setScac] = useState('')
  const [businessType, setBusinessType] = useState('Trucking')

  // Step 2: Contact Information
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [fax, setFax] = useState('')
  const [emails, setEmails] = useState<Emails>({})

  // Step 3: Address
  const [address, setAddress] = useState<Address>({})

  // Step 4: Additional Details
  const [dataRegion, setDataRegion] = useState('ap-southeast-2')
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>({
    marketing: false,
    updates: false,
    system: true,
  })
  const [privacyConsent, setPrivacyConsent] = useState(false)

  const next = () => {
    // Validation
    if (step === 0 && !companyName) {
      setError('Company name is required')
      return
    }
    if (step === 1 && !email) {
      setError('Email is required')
      return
    }
    setError(null)
    setStep((s) => Math.min(4, s + 1))
  }
  const back = () => setStep((s) => Math.max(0, s - 1))

  const submit = async () => {
    if (!privacyConsent) {
      setError('You must accept the privacy policy to continue')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        companyName,
        fullName: fullName || companyName,
        abn: abn || undefined,
        acn: acn || undefined,
        website: website || undefined,
        scac: scac || undefined,
        businessType,
        email,
        phone: phone || undefined,
        fax: fax || undefined,
        address: Object.keys(address).length > 0 ? address : undefined,
        emails: Object.keys(emails).length > 0 ? emails : undefined,
        dataRegion,
        emailPreferences,
        privacyConsent,
        termsAcceptedAt: new Date().toISOString(),
      }

      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/')
        }, 3000)
      } else {
        const err = await res.json().catch(() => null)
        setError(err?.message || 'Submission failed')
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message?: unknown }).message
          : String(err)
      setError(String(message) || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex justify-center items-center bg-background p-6 min-h-screen">
      <div className="bg-white shadow-md p-6 rounded-lg w-full max-w-3xl">
        <h1 className="mb-4 font-semibold text-2xl">Tenant Onboarding</h1>

        {!success ? (
          <div>
            <div className="mb-6">
              <StepIndicator step={step} />
            </div>

            {step === 0 && (
              <div className="space-y-4">
                <h2 className="mb-4 font-medium text-lg">Company Information</h2>
                <label className="block">
                  <span className="text-sm font-medium">Company name *</span>
                  <input
                    className="block mt-1 px-3 py-2 border rounded w-full"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    placeholder="Trading name"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Full legal name</span>
                  <input
                    className="block mt-1 px-3 py-2 border rounded w-full"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Registered legal name"
                  />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium">ABN</span>
                    <input
                      className="block mt-1 px-3 py-2 border rounded w-full"
                      value={abn}
                      onChange={(e) => setAbn(e.target.value)}
                      placeholder="Australian Business Number"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">ACN</span>
                    <input
                      className="block mt-1 px-3 py-2 border rounded w-full"
                      value={acn}
                      onChange={(e) => setAcn(e.target.value)}
                      placeholder="Australian Company Number"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm font-medium">Website</span>
                  <input
                    className="block mt-1 px-3 py-2 border rounded w-full"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">SCAC</span>
                  <input
                    className="block mt-1 px-3 py-2 border rounded w-full"
                    value={scac}
                    onChange={(e) => setScac(e.target.value)}
                    placeholder="Standard Carrier Alpha Code"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Business type</span>
                  <select
                    className="block mt-1 px-3 py-2 border rounded w-full"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                  >
                    <option value="Trucking">Trucking</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Freight Broker">Freight Broker</option>
                    <option value="Warehouse Management">Warehouse Management</option>
                  </select>
                </label>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="mb-4 font-medium text-lg">Contact Information</h2>
                <label className="block">
                  <span className="text-sm font-medium">Primary contact email *</span>
                  <input
                    className="block mt-1 px-3 py-2 border rounded w-full"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="contact@company.com"
                  />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium">Phone</span>
                    <input
                      className="block mt-1 px-3 py-2 border rounded w-full"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+61 2 1234 5678"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Fax</span>
                    <input
                      className="block mt-1 px-3 py-2 border rounded w-full"
                      type="tel"
                      value={fax}
                      onChange={(e) => setFax(e.target.value)}
                      placeholder="+61 2 1234 5679"
                    />
                  </label>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <h3 className="mb-3 text-sm font-medium">Department Email Addresses (Optional)</h3>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-sm">Account/Finance</span>
                      <input
                        className="block mt-1 px-3 py-2 border rounded w-full"
                        type="email"
                        value={emails.account || ''}
                        onChange={(e) => setEmails({ ...emails, account: e.target.value })}
                        placeholder="account@company.com"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm">Bookings</span>
                      <input
                        className="block mt-1 px-3 py-2 border rounded w-full"
                        type="email"
                        value={emails.bookings || ''}
                        onChange={(e) => setEmails({ ...emails, bookings: e.target.value })}
                        placeholder="bookings@company.com"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm">Management</span>
                      <input
                        className="block mt-1 px-3 py-2 border rounded w-full"
                        type="email"
                        value={emails.management || ''}
                        onChange={(e) => setEmails({ ...emails, management: e.target.value })}
                        placeholder="management@company.com"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm">Operations</span>
                      <input
                        className="block mt-1 px-3 py-2 border rounded w-full"
                        type="email"
                        value={emails.operations || ''}
                        onChange={(e) => setEmails({ ...emails, operations: e.target.value })}
                        placeholder="operations@company.com"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm">Reply-To</span>
                      <input
                        className="block mt-1 px-3 py-2 border rounded w-full"
                        type="email"
                        value={emails.replyTo || ''}
                        onChange={(e) => setEmails({ ...emails, replyTo: e.target.value })}
                        placeholder="noreply@company.com"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="mb-4 font-medium text-lg">Business Address</h2>
                <label className="block">
                  <span className="text-sm font-medium">Street address</span>
                  <input
                    className="block mt-1 px-3 py-2 border rounded w-full"
                    value={address.street || ''}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                    placeholder="123 Main Street"
                  />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium">City</span>
                    <input
                      className="block mt-1 px-3 py-2 border rounded w-full"
                      value={address.city || ''}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      placeholder="Sydney"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">State/Province</span>
                    <input
                      className="block mt-1 px-3 py-2 border rounded w-full"
                      value={address.state || ''}
                      onChange={(e) => setAddress({ ...address, state: e.target.value })}
                      placeholder="NSW"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium">Postal code</span>
                    <input
                      className="block mt-1 px-3 py-2 border rounded w-full"
                      value={address.postalCode || ''}
                      onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                      placeholder="2000"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Country code</span>
                    <input
                      className="block mt-1 px-3 py-2 border rounded w-full"
                      value={address.countryCode || ''}
                      onChange={(e) => setAddress({ ...address, countryCode: e.target.value })}
                      placeholder="AU"
                      maxLength={2}
                    />
                  </label>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="mb-4 font-medium text-lg">Additional Details</h2>
                <label className="block">
                  <span className="text-sm font-medium">Data Region</span>
                  <select
                    className="block mt-1 px-3 py-2 border rounded w-full"
                    value={dataRegion}
                    onChange={(e) => setDataRegion(e.target.value)}
                  >
                    <option value="ap-southeast-2">Asia Pacific (Sydney) - ap-southeast-2</option>
                    <option value="us-east-1">US East (N. Virginia) - us-east-1</option>
                    <option value="eu-central-1">Europe (Frankfurt) - eu-central-1</option>
                  </select>
                </label>
                <div className="pt-4 border-t">
                  <h3 className="mb-3 text-sm font-medium">Email Preferences</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={emailPreferences.marketing}
                        onChange={(e) =>
                          setEmailPreferences({ ...emailPreferences, marketing: e.target.checked })
                        }
                      />
                      <span className="text-sm">Receive marketing emails</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={emailPreferences.updates}
                        onChange={(e) =>
                          setEmailPreferences({ ...emailPreferences, updates: e.target.checked })
                        }
                      />
                      <span className="text-sm">Receive product updates</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={emailPreferences.system}
                        onChange={(e) =>
                          setEmailPreferences({ ...emailPreferences, system: e.target.checked })
                        }
                      />
                      <span className="text-sm">Receive system notifications (recommended)</span>
                    </label>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={privacyConsent}
                      onChange={(e) => setPrivacyConsent(e.target.checked)}
                      required
                    />
                    <span className="text-sm">
                      I accept the privacy policy and terms of service *
                    </span>
                  </label>
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="mb-4 font-medium text-lg">Review & Submit</h2>
                <div className="mb-4 space-y-2 text-sm">
                  <p>
                    <strong>Company:</strong> {companyName}
                    {fullName && fullName !== companyName && ` (${fullName})`}
                  </p>
                  {abn && (
                    <p>
                      <strong>ABN:</strong> {abn}
                    </p>
                  )}
                  {acn && (
                    <p>
                      <strong>ACN:</strong> {acn}
                    </p>
                  )}
                  <p>
                    <strong>Business type:</strong> {businessType}
                  </p>
                  <p>
                    <strong>Email:</strong> {email}
                  </p>
                  {phone && (
                    <p>
                      <strong>Phone:</strong> {phone}
                    </p>
                  )}
                  {address.street && (
                    <p>
                      <strong>Address:</strong>{' '}
                      {[
                        address.street,
                        address.city,
                        address.state,
                        address.postalCode,
                        address.countryCode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                  <p>
                    <strong>Data Region:</strong> {dataRegion}
                  </p>
                </div>
              </div>
            )}

            {error && <div className="mb-3 p-3 text-red-600 bg-red-50 rounded">{error}</div>}

            <div className="flex justify-between items-center mt-6">
              <div>
                {step > 0 && (
                  <button
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                    onClick={back}
                    disabled={submitting}
                  >
                    Back
                  </button>
                )}
              </div>
              <div>
                {step < 4 && (
                  <button
                    className="bg-primary px-4 py-2 rounded text-white hover:bg-primary/90"
                    onClick={next}
                    disabled={submitting}
                  >
                    Next
                  </button>
                )}
                {step === 4 && (
                  <button
                    className="bg-primary px-4 py-2 rounded text-white hover:bg-primary/90 disabled:opacity-50"
                    onClick={submit}
                    disabled={submitting || !privacyConsent}
                  >
                    {submitting ? 'Submitting...' : 'Submit application'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <h2 className="mb-2 font-medium text-xl">Application submitted</h2>
            <p className="text-muted-foreground">
              We will contact you when your tenant account is approved.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function StepIndicator({ step }: { step: number }) {
  const labels = ['Company', 'Contact', 'Address', 'Details', 'Review']
  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2 shrink-0">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              i <= step ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {i + 1}
          </div>
          <div className="hidden sm:block text-sm">{l}</div>
          {i < labels.length - 1 && (
            <div
              className={`hidden sm:block w-8 h-0.5 ${
                i < step ? 'bg-primary' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
