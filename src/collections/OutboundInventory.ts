import type { CollectionConfig } from 'payload'

/**
 * Generate a random alphanumeric code
 */
function generateJobCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Generate a unique job code for a tenant
 */
async function generateUniqueJobCode(
  payload: any,
  tenantId: number | string,
  maxAttempts: number = 10,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateJobCode(8) // 8 character code

    // Check if this code already exists for this tenant
    const existing = await payload.find({
      collection: 'outbound-inventory',
      where: {
        and: [
          {
            tenantId: {
              equals: tenantId,
            },
          },
          {
            jobCode: {
              equals: code,
            },
          },
        ],
      },
      limit: 1,
    })

    if (existing.docs.length === 0) {
      return code
    }
  }

  // Fallback: use timestamp-based code if all attempts fail
  return generateJobCode(6) + Date.now().toString().slice(-4)
}

export const OutboundInventory: CollectionConfig = {
  slug: 'outbound-inventory',
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
        description: 'Links outbound inventory to their company (tenant)',
      },
    },
    {
      name: 'jobCode',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique job code for this tenant (auto-generated)',
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Allocated', value: 'allocated' },
        { label: 'Ready to Pick', value: 'ready_to_pick' },
        { label: 'Picked', value: 'picked' },
        { label: 'Ready to Dispatch', value: 'ready_to_dispatch' },
      ],
      defaultValue: 'draft',
      admin: {
        description: 'Current status of the outbound job',
      },
    },
    // Basic Info
    {
      name: 'customerRefNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Customer-provided reference number for this outbound job',
      },
    },
    {
      name: 'consigneeRefNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Reference number provided by the consignee/receiver',
      },
    },
    {
      name: 'containerNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Container number assigned to this outbound job',
      },
    },
    {
      name: 'inspectionNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Inspection or quality check reference number',
      },
    },
    {
      name: 'warehouseId',
      type: 'relationship',
      relationTo: 'warehouses',
      required: true,
      admin: {
        description: 'Warehouse responsible for processing this outbound job',
      },
    },
    {
      name: 'inboundJobNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Inbound job number from which stock will be allocated',
      },
    },
    // Customer Details
    {
      name: 'customerId',
      type: 'text',
      admin: {
        description:
          'Customer ID in format "collection:id" (e.g., "customers:123" or "paying-customers:456")',
      },
    },
    {
      name: 'customerName',
      type: 'text',
      admin: {
        description: 'Auto-fetched customer name',
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
      name: 'customerContact',
      type: 'text',
      admin: {
        description: 'Customer primary contact/phone',
        readOnly: true,
      },
    },
    // Customer To Details
    {
      name: 'customerToId',
      type: 'text',
      admin: {
        description:
          'Delivery destination ID in format "collection:id" (can be customer or warehouse)',
      },
    },
    {
      name: 'customerToName',
      type: 'text',
      admin: {
        description: 'Destination name (customer/warehouse)',
        readOnly: true,
      },
    },
    {
      name: 'customerToLocation',
      type: 'text',
      admin: {
        description: 'Destination city/location',
        readOnly: true,
      },
    },
    {
      name: 'customerToState',
      type: 'text',
      admin: {
        description: 'Destination state/region',
        readOnly: true,
      },
    },
    {
      name: 'customerToContact',
      type: 'text',
      admin: {
        description: 'Destination primary contact',
        readOnly: true,
      },
    },
    // Customer From Details
    {
      name: 'customerFromId',
      type: 'text',
      admin: {
        description: 'Pickup location ID in format "collection:id" (can be customer or warehouse)',
      },
    },
    {
      name: 'customerFromName',
      type: 'text',
      admin: {
        description: 'Pickup party/warehouse name',
        readOnly: true,
      },
    },
    {
      name: 'customerFromLocation',
      type: 'text',
      admin: {
        description: 'Pickup location city',
        readOnly: true,
      },
    },
    {
      name: 'customerFromState',
      type: 'text',
      admin: {
        description: 'Pickup location state',
        readOnly: true,
      },
    },
    {
      name: 'customerFromContact',
      type: 'text',
      admin: {
        description: 'Pickup party contact number',
        readOnly: true,
      },
    },
    // Date & Additional Details
    {
      name: 'requiredDateTime',
      type: 'date',
      admin: {
        description: 'Requested date/time for dispatch or pickup',
      },
    },
    {
      name: 'orderNotes',
      type: 'textarea',
      admin: {
        description: 'Special handling notes or instructions from the customer',
      },
    },
    {
      name: 'palletCount',
      type: 'number',
      admin: {
        description: 'Total number of pallets planned for this outbound job',
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

        // Generate unique job code when creating a new job
        if (operation === 'create' && !data.jobCode && req?.payload && data.tenantId) {
          const tenantId =
            typeof data.tenantId === 'object' ? (data.tenantId as { id: number }).id : data.tenantId
          if (tenantId) {
            data.jobCode = await generateUniqueJobCode(req.payload, tenantId)
          }
        }

        return data
      },
      async ({ data, req }) => {
        // Auto-fetch customer info when customerId is set
        if (data.customerId && req?.payload) {
          try {
            const customerIdStr = data.customerId as string
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
                    city?: string
                    state?: string
                    contact_name?: string
                    phone?: string
                  }
                  data.customerName = cust.customer_name || ''
                  data.customerLocation = cust.city || ''
                  data.customerState = cust.state || ''
                  data.customerContact = cust.contact_name || cust.phone || ''
                } else if (collection === 'paying-customers') {
                  const cust = customer as {
                    customer_name?: string
                    delivery_city?: string
                    delivery_state?: string
                    billing_city?: string
                    billing_state?: string
                    delivery_same_as_billing?: boolean
                    contact_name?: string
                    phone?: string
                  }
                  data.customerName = cust.customer_name || ''
                  const city =
                    cust.delivery_city ||
                    (cust.delivery_same_as_billing ? cust.billing_city : undefined)
                  const state =
                    cust.delivery_state ||
                    (cust.delivery_same_as_billing ? cust.billing_state : undefined)
                  data.customerLocation = city || ''
                  data.customerState = state || ''
                  data.customerContact = cust.contact_name || cust.phone || ''
                }
              }
            }
          } catch (error) {
            console.error('Error fetching customer:', error)
          }
        }

        // Auto-fetch customerTo info when customerToId is set
        if (data.customerToId && req?.payload) {
          try {
            const customerToIdStr = data.customerToId as string
            const [collection, idStr] = customerToIdStr.split(':')
            const customerToId = parseInt(idStr, 10)

            if (collection && customerToId) {
              if (collection === 'warehouses') {
                const warehouse = await req.payload.findByID({
                  collection: 'warehouses',
                  id: customerToId,
                })

                if (warehouse) {
                  const wh = warehouse as { name?: string; city?: string; state?: string }
                  data.customerToName = wh.name || ''
                  data.customerToLocation = wh.city || ''
                  data.customerToState = wh.state || ''
                }
              } else if (collection === 'customers' || collection === 'paying-customers') {
                const customer = await req.payload.findByID({
                  collection: collection as 'customers' | 'paying-customers',
                  id: customerToId,
                })

                if (customer) {
                  if (collection === 'customers') {
                    const cust = customer as {
                      customer_name?: string
                      city?: string
                      state?: string
                      contact_name?: string
                      phone?: string
                    }
                    data.customerToName = cust.customer_name || ''
                    data.customerToLocation = cust.city || ''
                    data.customerToState = cust.state || ''
                    data.customerToContact = cust.contact_name || cust.phone || ''
                  } else if (collection === 'paying-customers') {
                    const cust = customer as {
                      customer_name?: string
                      delivery_city?: string
                      delivery_state?: string
                      billing_city?: string
                      billing_state?: string
                      delivery_same_as_billing?: boolean
                      contact_name?: string
                      phone?: string
                    }
                    data.customerToName = cust.customer_name || ''
                    const city =
                      cust.delivery_city ||
                      (cust.delivery_same_as_billing ? cust.billing_city : undefined)
                    const state =
                      cust.delivery_state ||
                      (cust.delivery_same_as_billing ? cust.billing_state : undefined)
                    data.customerToLocation = city || ''
                    data.customerToState = state || ''
                    data.customerToContact = cust.contact_name || cust.phone || ''
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error fetching customerTo:', error)
          }
        }

        // Auto-fetch customerFrom info when customerFromId is set
        if (data.customerFromId && req?.payload) {
          try {
            const customerFromIdStr = data.customerFromId as string
            const [collection, idStr] = customerFromIdStr.split(':')
            const customerFromId = parseInt(idStr, 10)

            if (collection && customerFromId) {
              if (collection === 'warehouses') {
                const warehouse = await req.payload.findByID({
                  collection: 'warehouses',
                  id: customerFromId,
                })

                if (warehouse) {
                  const wh = warehouse as { name?: string; city?: string; state?: string }
                  data.customerFromName = wh.name || ''
                  data.customerFromLocation = wh.city || ''
                  data.customerFromState = wh.state || ''
                }
              } else if (collection === 'customers' || collection === 'paying-customers') {
                const customer = await req.payload.findByID({
                  collection: collection as 'customers' | 'paying-customers',
                  id: customerFromId,
                })

                if (customer) {
                  if (collection === 'customers') {
                    const cust = customer as {
                      customer_name?: string
                      city?: string
                      state?: string
                      contact_name?: string
                      phone?: string
                    }
                    data.customerFromName = cust.customer_name || ''
                    data.customerFromLocation = cust.city || ''
                    data.customerFromState = cust.state || ''
                    data.customerFromContact = cust.contact_name || cust.phone || ''
                  } else if (collection === 'paying-customers') {
                    const cust = customer as {
                      customer_name?: string
                      delivery_city?: string
                      delivery_state?: string
                      billing_city?: string
                      billing_state?: string
                      delivery_same_as_billing?: boolean
                      contact_name?: string
                      phone?: string
                    }
                    data.customerFromName = cust.customer_name || ''
                    const city =
                      cust.delivery_city ||
                      (cust.delivery_same_as_billing ? cust.billing_city : undefined)
                    const state =
                      cust.delivery_state ||
                      (cust.delivery_same_as_billing ? cust.billing_state : undefined)
                    data.customerFromLocation = city || ''
                    data.customerFromState = state || ''
                    data.customerFromContact = cust.contact_name || cust.phone || ''
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error fetching customerFrom:', error)
          }
        }

        return data
      },
    ],
  },
}
