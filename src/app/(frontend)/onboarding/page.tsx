'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { FormInput, FormSelect, FormTextarea } from '@/components/ui/form-field'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { slugify } from '@/lib/subdomain'

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
  const [subdomain, setSubdomain] = useState('')
  const [subdomainStatus, setSubdomainStatus] = useState<{
    checking: boolean
    available: boolean | null
    message: string
    subdomain?: string
  }>({ checking: false, available: null, message: '' })

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

  // Debounce subdomain check
  const subdomainCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const subdomainAutoFilledRef = useRef(false)

  // Auto-fill subdomain from company name when company name changes
  useEffect(() => {
    if (companyName && !subdomainAutoFilledRef.current && !subdomain) {
      const autoSubdomain = slugify(companyName)
      if (autoSubdomain.length >= 3) {
        setSubdomain(autoSubdomain)
        subdomainAutoFilledRef.current = true
      }
    }
  }, [companyName])

  // Reset auto-fill flag if subdomain is manually cleared
  useEffect(() => {
    if (!subdomain) {
      subdomainAutoFilledRef.current = false
    }
  }, [subdomain])

  useEffect(() => {
    // Clear previous timeout
    if (subdomainCheckTimeoutRef.current) {
      clearTimeout(subdomainCheckTimeoutRef.current)
    }

    // Don't check if subdomain is empty or too short
    if (!subdomain || subdomain.length < 3) {
      setSubdomainStatus({ checking: false, available: null, message: '' })
      return
    }

    // Set checking state
    setSubdomainStatus({ checking: true, available: null, message: 'Checking availability...' })

    // Debounce the check (wait 500ms after user stops typing)
    subdomainCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/tenants/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`,
        )
        const data = await res.json()

        if (res.ok) {
          setSubdomainStatus({
            checking: false,
            available: data.available,
            message:
              data.message || (data.available ? 'Subdomain is available' : 'Subdomain is taken'),
            subdomain: data.subdomain, // Store normalized subdomain
          } as typeof subdomainStatus & { subdomain?: string })
        } else {
          setSubdomainStatus({
            checking: false,
            available: false,
            message: data.message || 'Error checking subdomain',
          })
        }
      } catch (error) {
        setSubdomainStatus({
          checking: false,
          available: false,
          message: 'Error checking subdomain availability',
        })
      }
    }, 500)

    // Cleanup function
    return () => {
      if (subdomainCheckTimeoutRef.current) {
        clearTimeout(subdomainCheckTimeoutRef.current)
      }
    }
  }, [subdomain])

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
    if (step === 3 && !privacyConsent) {
      setError('You must accept the privacy policy and terms of service to continue')
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
        subdomain:
          subdomain && subdomainStatus.available
            ? subdomainStatus.subdomain || subdomain
            : undefined,
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
              <div className="space-y-4 md:space-y-6">
                <h2 className="mb-4 font-semibold text-xl">Company Information</h2>
                <FormInput
                  label="Company name"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Trading name"
                  error={step === 0 && !companyName ? 'Company name is required' : undefined}
                />
                <FormInput
                  label="Full legal name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Registered legal name"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput
                    label="ABN"
                    value={abn}
                    onChange={(e) => setAbn(e.target.value)}
                    placeholder="Australian Business Number"
                  />
                  <FormInput
                    label="ACN"
                    value={acn}
                    onChange={(e) => setAcn(e.target.value)}
                    placeholder="Australian Company Number"
                  />
                </div>
                <FormInput
                  label="Website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                />
                <FormInput
                  label="SCAC"
                  value={scac}
                  onChange={(e) => setScac(e.target.value)}
                  placeholder="Standard Carrier Alpha Code"
                />
                <div>
                  <FormInput
                    label="Preferred Subdomain (Optional)"
                    value={subdomain}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                      setSubdomain(value)
                    }}
                    placeholder="your-company-name"
                  />
                  {subdomain && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      {subdomainStatus.checking ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                          <span className="text-muted-foreground">{subdomainStatus.message}</span>
                        </>
                      ) : subdomainStatus.available === true ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-green-600">{subdomainStatus.message}</span>
                        </>
                      ) : subdomainStatus.available === false ? (
                        <>
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-red-600">{subdomainStatus.message}</span>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
                <FormSelect
                  label="Business type"
                  options={[
                    { value: 'Trucking', label: 'Trucking' },
                    { value: 'Logistics', label: 'Logistics' },
                    { value: 'Freight Broker', label: 'Freight Broker' },
                    { value: 'Warehouse Management', label: 'Warehouse Management' },
                  ]}
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4 md:space-y-6">
                <h2 className="mb-4 font-semibold text-xl">Contact Information</h2>
                <FormInput
                  label="Primary contact email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  error={step === 1 && !email ? 'Email is required' : undefined}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput
                    label="Phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+61 2 1234 5678"
                  />
                  <FormInput
                    label="Fax"
                    type="tel"
                    value={fax}
                    onChange={(e) => setFax(e.target.value)}
                    placeholder="+61 2 1234 5679"
                  />
                </div>
                <div className="mt-4 pt-4 border-t">
                  <h3 className="mb-3 text-base font-semibold">
                    Department Email Addresses (Optional)
                  </h3>
                  <div className="space-y-4">
                    <FormInput
                      label="Account/Finance"
                      type="email"
                      value={emails.account || ''}
                      onChange={(e) => setEmails({ ...emails, account: e.target.value })}
                      placeholder="account@company.com"
                    />
                    <FormInput
                      label="Bookings"
                      type="email"
                      value={emails.bookings || ''}
                      onChange={(e) => setEmails({ ...emails, bookings: e.target.value })}
                      placeholder="bookings@company.com"
                    />
                    <FormInput
                      label="Management"
                      type="email"
                      value={emails.management || ''}
                      onChange={(e) => setEmails({ ...emails, management: e.target.value })}
                      placeholder="management@company.com"
                    />
                    <FormInput
                      label="Operations"
                      type="email"
                      value={emails.operations || ''}
                      onChange={(e) => setEmails({ ...emails, operations: e.target.value })}
                      placeholder="operations@company.com"
                    />
                    <FormInput
                      label="Reply-To"
                      type="email"
                      value={emails.replyTo || ''}
                      onChange={(e) => setEmails({ ...emails, replyTo: e.target.value })}
                      placeholder="noreply@company.com"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 md:space-y-6">
                <h2 className="mb-4 font-semibold text-xl">Business Address</h2>
                <FormInput
                  label="Street address"
                  value={address.street || ''}
                  onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  placeholder="123 Main Street"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput
                    label="City"
                    value={address.city || ''}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    placeholder="Sydney"
                  />
                  <FormInput
                    label="State/Province"
                    value={address.state || ''}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    placeholder="NSW"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput
                    label="Postal code"
                    value={address.postalCode || ''}
                    onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                    placeholder="2000"
                  />
                  <FormInput
                    label="Country code"
                    value={address.countryCode || ''}
                    onChange={(e) => setAddress({ ...address, countryCode: e.target.value })}
                    placeholder="AU"
                    maxLength={2}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 md:space-y-6">
                <h2 className="mb-4 font-semibold text-xl">Additional Details</h2>
                <FormSelect
                  label="Data Region"
                  options={[
                    { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney) - ap-southeast-2' },
                    { value: 'us-east-1', label: 'US East (N. Virginia) - us-east-1' },
                    { value: 'eu-central-1', label: 'Europe (Frankfurt) - eu-central-1' },
                  ]}
                  value={dataRegion}
                  onChange={(e) => setDataRegion(e.target.value)}
                />
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
                  <label
                    className={`flex items-center gap-2 ${step === 3 && !privacyConsent && error ? 'text-red-600' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={privacyConsent}
                      onChange={(e) => {
                        setPrivacyConsent(e.target.checked)
                        if (error && e.target.checked) {
                          setError(null)
                        }
                      }}
                      required
                      className={
                        step === 3 && !privacyConsent && error
                          ? 'border-red-500 accent-red-500'
                          : ''
                      }
                    />
                    <span className="text-sm">
                      I accept the privacy policy and terms of service *
                    </span>
                  </label>
                  {step === 3 && !privacyConsent && error && (
                    <p className="text-sm text-red-600 mt-1 ml-6">{error}</p>
                  )}
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

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-6 border-t">
              <div>
                {step > 0 && (
                  <button
                    className="px-4 py-2 border rounded hover:bg-gray-50 w-full sm:w-auto min-h-[44px]"
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
                    className="bg-primary px-4 py-2 rounded text-white hover:bg-primary/90 w-full sm:w-auto min-h-[44px]"
                    onClick={next}
                    disabled={submitting}
                  >
                    Next
                  </button>
                )}
                {step === 4 && (
                  <button
                    className="bg-primary px-4 py-2 rounded text-white hover:bg-primary/90 disabled:opacity-50 w-full sm:w-auto min-h-[44px]"
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
              className={`hidden sm:block w-8 h-0.5 ${i < step ? 'bg-primary' : 'bg-gray-200'}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
