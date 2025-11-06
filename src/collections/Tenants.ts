import type { CollectionConfig } from 'payload'
import { getPayload } from 'payload'
import config from '../payload.config'
import {
  getTenantRequestNotificationEmail,
  getTenantApprovalEmail,
  getTenantRejectionEmail,
} from '../lib/email-templates'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'companyName',
  },
  access: {
    // Public can create (for onboarding)
    create: () => true,
    // Only super admins can read/update/delete
    read: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string } }).user
      return !!(user && user.role === 'superadmin')
    },
    update: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string } }).user
      return !!(user && user.role === 'superadmin')
    },
    delete: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string } }).user
      return !!(user && user.role === 'superadmin')
    },
  },
  fields: [
    {
      name: 'companyName',
      type: 'text',
      required: true,
      admin: {
        description: 'Short or trading name of the company',
      },
    },
    {
      name: 'fullName',
      type: 'text',
      admin: {
        description: 'Full registered legal name of the company',
      },
    },
    {
      name: 'abn',
      type: 'text',
      admin: {
        description: 'Australian Business Number (if applicable)',
      },
    },
    {
      name: 'acn',
      type: 'text',
      admin: {
        description: 'Australian Company Number (if applicable)',
      },
    },
    {
      name: 'website',
      type: 'text',
      admin: {
        description: 'Official company website URL',
      },
    },
    {
      name: 'scac',
      type: 'text',
      admin: {
        description: 'Standard Carrier Alpha Code (used for identifying carriers)',
      },
    },
    {
      name: 'emails',
      type: 'group',
      fields: [
        {
          name: 'account',
          type: 'email',
          admin: {
            description: 'Account/Finance department email',
          },
        },
        {
          name: 'bookings',
          type: 'email',
          admin: {
            description: 'Bookings department email',
          },
        },
        {
          name: 'management',
          type: 'email',
          admin: {
            description: 'Management email',
          },
        },
        {
          name: 'operations',
          type: 'email',
          admin: {
            description: 'Operations department email',
          },
        },
        {
          name: 'replyTo',
          type: 'email',
          admin: {
            description: 'Reply-to email address',
          },
        },
      ],
    },
    {
      name: 'address',
      type: 'group',
      fields: [
        {
          name: 'street',
          type: 'text',
          admin: {
            description: 'Street address',
          },
        },
        {
          name: 'city',
          type: 'text',
          admin: {
            description: 'City',
          },
        },
        {
          name: 'state',
          type: 'text',
          admin: {
            description: 'State/Province',
          },
        },
        {
          name: 'postalCode',
          type: 'text',
          admin: {
            description: 'Postal/ZIP code',
          },
        },
        {
          name: 'countryCode',
          type: 'text',
          admin: {
            description: 'Country code (e.g., AU, US)',
          },
        },
      ],
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        description: 'Primary business contact number',
      },
    },
    {
      name: 'fax',
      type: 'text',
      admin: {
        description: 'Company fax number (optional)',
      },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      admin: {
        description: 'General company email or contact address',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Company logo file',
      },
    },
    {
      name: 'subdomain',
      type: 'text',
      unique: true,
      admin: {
        description: 'Dedicated subdomain for the tenant (e.g., abc.truckingapp.com)',
        readOnly: true,
      },
    },
    {
      name: 'approved',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether the tenant has been approved by an admin',
      },
    },
    {
      name: 'approvedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Reference to the approving super admin',
      },
    },
    {
      name: 'verified',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether company info and documents are verified',
      },
    },
    {
      name: 'verifiedAt',
      type: 'date',
      admin: {
        description: 'Timestamp when verification was completed',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'privacyConsent',
      type: 'checkbox',
      admin: {
        description: 'Indicates acceptance of privacy terms',
      },
    },
    {
      name: 'termsAcceptedAt',
      type: 'date',
      admin: {
        description: 'When terms and conditions were accepted',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'emailPreferences',
      type: 'group',
      fields: [
        {
          name: 'marketing',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Receive marketing emails',
          },
        },
        {
          name: 'updates',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Receive product updates',
          },
        },
        {
          name: 'system',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Receive system notifications',
          },
        },
      ],
    },
    {
      name: 'dataRegion',
      type: 'select',
      options: [
        { label: 'Asia Pacific (Sydney) - ap-southeast-2', value: 'ap-southeast-2' },
        { label: 'US East (N. Virginia) - us-east-1', value: 'us-east-1' },
        { label: 'Europe (Frankfurt) - eu-central-1', value: 'eu-central-1' },
      ],
      admin: {
        description: 'Data hosting region',
      },
    },
    {
      name: 'onboardingStep',
      type: 'text',
      admin: {
        description: 'Track onboarding progress (draft/submitted/backoffice)',
      },
    },
    {
      name: 'deletedAt',
      type: 'date',
      admin: {
        description: 'Soft delete timestamp',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const payload = await getPayload({ config })

        // Send notification to super admin when new tenant is created
        if (operation === 'create' && !doc.approved) {
          try {
            // Get all super admin users
            const superAdmins = await payload.find({
              collection: 'users',
              where: {
                role: {
                  equals: 'superadmin',
                },
              },
            })

            // Send email to each super admin
            for (const admin of superAdmins.docs) {
              if (admin.email) {
                const emailContent = getTenantRequestNotificationEmail({
                  companyName: doc.companyName,
                  email: doc.email,
                  phone: doc.phone,
                  createdAt: doc.createdAt as string,
                })

                await payload.sendEmail({
                  to: admin.email,
                  from: process.env.EMAIL_FROM || 'no-reply@localhost',
                  subject: emailContent.subject,
                  html: emailContent.html,
                })
              }
            }
          } catch (error) {
            console.error('Error sending tenant request notification email:', error)
            // Don't throw - email failures shouldn't break tenant creation
          }
        }

        // Send approval/rejection emails when status changes
        if (operation === 'update' && previousDoc) {
          const wasApproved = previousDoc.approved
          const isApproved = doc.approved

          // Tenant was just approved
          if (!wasApproved && isApproved && doc.email && doc.subdomain) {
            try {
              // Find the tenant user that was created for this tenant
              const tenantUsers = await payload.find({
                collection: 'tenant-users',
                where: {
                  tenantId: {
                    equals: doc.id,
                  },
                },
                limit: 1,
              })

              const tenantUser = tenantUsers.docs[0]
              const loginEmail = tenantUser?.email || doc.email
              // Note: We can't retrieve the password as it's hashed, so we'll need to pass it through the approval process
              // For now, we'll send the email with a note to contact support if they need credentials reset
              const loginPassword = 'Please check your approval notification for your temporary password'

              const emailContent = getTenantApprovalEmail({
                companyName: doc.companyName,
                email: doc.email,
                subdomain: doc.subdomain,
                loginEmail,
                loginPassword,
              })

              await payload.sendEmail({
                to: doc.email,
                from: process.env.EMAIL_FROM || 'no-reply@localhost',
                subject: emailContent.subject,
                html: emailContent.html,
              })
            } catch (error) {
              console.error('Error sending tenant approval email:', error)
            }
          }

          // Tenant was just rejected
          if (wasApproved === undefined && !isApproved && doc.email) {
            try {
              const emailContent = getTenantRejectionEmail({
                companyName: doc.companyName,
                email: doc.email,
              })

              await payload.sendEmail({
                to: doc.email,
                from: process.env.EMAIL_FROM || 'no-reply@localhost',
                subject: emailContent.subject,
                html: emailContent.html,
              })
            } catch (error) {
              console.error('Error sending tenant rejection email:', error)
            }
          }
        }
      },
    ],
  },
}

