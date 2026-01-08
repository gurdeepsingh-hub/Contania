import type { CollectionConfig } from 'payload'
import { generateUniqueJobNumber } from '@/lib/job-number-generator'

export const InboundInventory: CollectionConfig = {
  slug: 'inbound-inventory',
  admin: {
    useAsTitle: 'jobCode',
  },
  access: {
    create: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string } }).user
      if (user?.role === 'superadmin') return true
      return !!user?.tenantId
    },
    read: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return {
          tenantId: {
            equals: user.tenantId,
          },
        }
      }
      return false
    },
    update: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return {
          tenantId: {
            equals: user.tenantId,
          },
        }
      }
      return false
    },
    delete: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return {
          tenantId: {
            equals: user.tenantId,
          },
        }
      }
      return false
    },
  },
  fields: [
    {
      name: 'tenantId',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: {
        description: 'Links inbound inventory to their company (tenant)',
      },
    },
    {
      name: 'jobCode',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique job code for this tenant (auto-generated with INB- prefix, unique across all job collections per tenant)',
        readOnly: true,
      },
    },
    {
      name: 'expectedDate',
      type: 'date',
      admin: {
        description: 'Scheduled arrival date/time of goods',
      },
    },
    {
      name: 'completedDate',
      type: 'date',
      admin: {
        description: 'Actual receiving completion date/time',
      },
    },
    {
      name: 'deliveryCustomerReferenceNumber',
      type: 'text',
      admin: {
        description: 'Delivery customer reference number',
      },
    },
    {
      name: 'orderingCustomerReferenceNumber',
      type: 'text',
      admin: {
        description: 'Ordering customer reference number',
      },
    },
    {
      name: 'deliveryCustomerId',
      type: 'text',
      admin: {
        description:
          'Delivery customer ID in format "collection:id" (e.g., "customers:123" or "paying-customers:456")',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Any remarks or handling instructions',
      },
    },
    {
      name: 'transportMode',
      type: 'select',
      options: [
        { label: 'Our', value: 'our' },
        { label: 'Third Party', value: 'third_party' },
      ],
      admin: {
        description: 'Indicates who manages transport',
      },
    },
    {
      name: 'warehouseId',
      type: 'relationship',
      relationTo: 'warehouses',
      admin: {
        description: 'Destination warehouse for received goods',
      },
    },
    // Customer Info (auto-fetched)
    {
      name: 'customerName',
      type: 'text',
      admin: {
        description: 'Auto-fetched customer name',
        readOnly: true,
      },
    },
    {
      name: 'customerAddress',
      type: 'text',
      admin: {
        description: 'Resolved address of the delivery customer',
        readOnly: true,
      },
    },
    {
      name: 'customerLocation',
      type: 'text',
      admin: {
        description: 'Customer location',
        readOnly: true,
      },
    },
    {
      name: 'customerState',
      type: 'text',
      admin: {
        description: 'Customer state',
        readOnly: true,
      },
    },
    {
      name: 'customerContactName',
      type: 'text',
      admin: {
        description: 'Customer contact name',
        readOnly: true,
      },
    },
    // Supplier Info (auto-fetched)
    {
      name: 'supplierId',
      type: 'text',
      admin: {
        description:
          'Supplier ID in format "collection:id" (e.g., "customers:123" or "paying-customers:456")',
      },
    },
    {
      name: 'supplierName',
      type: 'text',
      admin: {
        description: 'Auto-fetched supplier name',
        readOnly: true,
      },
    },
    {
      name: 'supplierAddress',
      type: 'text',
      admin: {
        description: 'Supplier address',
        readOnly: true,
      },
    },
    {
      name: 'supplierLocation',
      type: 'text',
      admin: {
        description: 'Supplier location',
        readOnly: true,
      },
    },
    {
      name: 'supplierState',
      type: 'text',
      admin: {
        description: 'Supplier state',
        readOnly: true,
      },
    },
    {
      name: 'supplierContactName',
      type: 'text',
      admin: {
        description: 'Supplier contact name',
        readOnly: true,
      },
    },
    // Third Party Transport Info
    {
      name: 'transportCompanyId',
      type: 'relationship',
      relationTo: 'transport-companies',
      admin: {
        description: 'Third-party transport company (if applicable)',
        condition: (data) => {
          return (data as { transportMode?: string }).transportMode === 'third_party'
        },
      },
    },
    {
      name: 'transportContact',
      type: 'text',
      admin: {
        description: 'Transport contact person',
        readOnly: true,
      },
    },
    {
      name: 'transportMobile',
      type: 'text',
      admin: {
        description: 'Transport mobile number',
        readOnly: true,
      },
    },
    // Pallet Information
    {
      name: 'chep',
      type: 'number',
      admin: {
        description: 'Quantity of CHEP pallets used',
      },
    },
    {
      name: 'loscam',
      type: 'number',
      admin: {
        description: 'Quantity of LOSCAM pallets used',
      },
    },
    {
      name: 'plain',
      type: 'number',
      admin: {
        description: 'Quantity of plain pallets used',
      },
    },
    {
      name: 'palletTransferDocket',
      type: 'text',
      admin: {
        description: 'Reference number for pallet transfer documentation',
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ req, data, operation }) => {
        const user = (
          req as unknown as {
            user?: { role?: string; tenantId?: number | string; collection?: string }
          }
        ).user
        // If creating/updating and user has tenantId, ensure it matches
        if (user?.tenantId && data.tenantId !== user.tenantId) {
          // Super admins can set any tenantId, but regular users cannot
          if (user.role !== 'superadmin' && user.collection !== 'users') {
            data.tenantId = user.tenantId
          }
        }

        // Generate unique job code with 'inb' prefix when creating a new job
        if (operation === 'create' && !data.jobCode && req?.payload && data.tenantId) {
          const tenantId =
            typeof data.tenantId === 'object' ? (data.tenantId as { id: number }).id : data.tenantId
          if (tenantId) {
            data.jobCode = await generateUniqueJobNumber(req.payload, tenantId, 'INB')
          }
        }

        return data
      },
      async ({ data, req }) => {
        // Auto-fetch delivery customer info when deliveryCustomerId is set
        if (data.deliveryCustomerId && req?.payload) {
          try {
            const customerIdStr = data.deliveryCustomerId as string
            const [collection, idStr] = customerIdStr.split(':')
            const customerId = parseInt(idStr, 10)

            if (
              collection &&
              customerId &&
              (collection === 'customers' || collection === 'paying-customers')
            ) {
              const customer = await req.payload.findByID({
                collection: collection as 'customers' | 'paying-customers',
                id: customerId,
              })

              if (customer) {
                if (collection === 'customers') {
                  const cust = customer as {
                    customer_name?: string
                    street?: string
                    city?: string
                    state?: string
                    postcode?: string
                    contact_name?: string
                  }
                  data.customerName = cust.customer_name || ''
                  data.customerAddress = [cust.street, cust.city, cust.state, cust.postcode]
                    .filter(Boolean)
                    .join(', ')
                  data.customerLocation = [cust.city, cust.state].filter(Boolean).join(', ')
                  data.customerState = cust.state || ''
                  data.customerContactName = cust.contact_name || ''
                } else if (collection === 'paying-customers') {
                  const cust = customer as {
                    customer_name?: string
                    delivery_street?: string
                    delivery_city?: string
                    delivery_state?: string
                    delivery_postcode?: string
                    billing_street?: string
                    billing_city?: string
                    billing_state?: string
                    billing_postcode?: string
                    delivery_same_as_billing?: boolean
                    contact_name?: string
                  }
                  data.customerName = cust.customer_name || ''
                  // Use delivery address, fallback to billing if delivery_same_as_billing is true
                  const street =
                    cust.delivery_street ||
                    (cust.delivery_same_as_billing ? cust.billing_street : undefined)
                  const city =
                    cust.delivery_city ||
                    (cust.delivery_same_as_billing ? cust.billing_city : undefined)
                  const state =
                    cust.delivery_state ||
                    (cust.delivery_same_as_billing ? cust.billing_state : undefined)
                  const postcode =
                    cust.delivery_postcode ||
                    (cust.delivery_same_as_billing ? cust.billing_postcode : undefined)
                  data.customerAddress = [street, city, state, postcode].filter(Boolean).join(', ')
                  data.customerLocation = [city, state].filter(Boolean).join(', ')
                  data.customerState = state || ''
                  data.customerContactName = cust.contact_name || ''
                }
              }
            }
          } catch (error) {
            console.error('Error fetching delivery customer:', error)
          }
        }

        // Auto-fetch supplier info when supplierId is set (supplierId can be from customers or paying-customers)
        if (data.supplierId && req?.payload) {
          try {
            // Check if supplierId is in "collection:id" format or just a number (legacy)
            let collection: 'customers' | 'paying-customers' = 'customers'
            let supplierId: number

            if (typeof data.supplierId === 'string' && data.supplierId.includes(':')) {
              const [coll, idStr] = data.supplierId.split(':')
              supplierId = parseInt(idStr, 10)
              if (coll === 'paying-customers') {
                collection = 'paying-customers'
              }
            } else {
              supplierId =
                typeof data.supplierId === 'object'
                  ? (data.supplierId as { id: number }).id
                  : (data.supplierId as number)
            }

            if (supplierId) {
              const supplier = await req.payload.findByID({
                collection,
                id: supplierId,
              })

              if (supplier) {
                if (collection === 'customers') {
                  const supp = supplier as {
                    customer_name?: string
                    street?: string
                    city?: string
                    state?: string
                    postcode?: string
                    contact_name?: string
                  }
                  data.supplierName = supp.customer_name || ''
                  data.supplierAddress = [supp.street, supp.city, supp.state, supp.postcode]
                    .filter(Boolean)
                    .join(', ')
                  data.supplierLocation = [supp.city, supp.state].filter(Boolean).join(', ')
                  data.supplierState = supp.state || ''
                  data.supplierContactName = supp.contact_name || ''
                } else if (collection === 'paying-customers') {
                  const supp = supplier as {
                    customer_name?: string
                    delivery_street?: string
                    delivery_city?: string
                    delivery_state?: string
                    delivery_postcode?: string
                    billing_street?: string
                    billing_city?: string
                    billing_state?: string
                    billing_postcode?: string
                    delivery_same_as_billing?: boolean
                    contact_name?: string
                  }
                  data.supplierName = supp.customer_name || ''
                  // Use delivery address, fallback to billing if delivery_same_as_billing is true
                  const street =
                    supp.delivery_street ||
                    (supp.delivery_same_as_billing ? supp.billing_street : undefined)
                  const city =
                    supp.delivery_city ||
                    (supp.delivery_same_as_billing ? supp.billing_city : undefined)
                  const state =
                    supp.delivery_state ||
                    (supp.delivery_same_as_billing ? supp.billing_state : undefined)
                  const postcode =
                    supp.delivery_postcode ||
                    (supp.delivery_same_as_billing ? supp.billing_postcode : undefined)
                  data.supplierAddress = [street, city, state, postcode].filter(Boolean).join(', ')
                  data.supplierLocation = [city, state].filter(Boolean).join(', ')
                  data.supplierState = state || ''
                  data.supplierContactName = supp.contact_name || ''
                }
              }
            }
          } catch (error) {
            console.error('Error fetching supplier:', error)
          }
        }

        // Auto-fetch transport company info when transportCompanyId is set
        if (data.transportCompanyId && req?.payload) {
          try {
            const transportCompanyId =
              typeof data.transportCompanyId === 'object'
                ? (data.transportCompanyId as { id: number }).id
                : data.transportCompanyId

            if (transportCompanyId) {
              const transportCompany = await req.payload.findByID({
                collection: 'transport-companies',
                id: transportCompanyId,
              })

              if (transportCompany) {
                const tc = transportCompany as { contact?: string; mobile?: string }
                data.transportContact = tc.contact || ''
                data.transportMobile = tc.mobile || ''
              }
            }
          } catch (error) {
            console.error('Error fetching transport company:', error)
          }
        }

        return data
      },
    ],
  },
}
