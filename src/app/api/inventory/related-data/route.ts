import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

/**
 * Endpoint to fetch related field data for auto-fill functionality
 * Examples:
 * - Given batch → return SKU ID
 * - Given SKU ID → return SKU description, expiry, attribute1, attribute2 (filtered by warehouse)
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'inventory_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const url = new URL(request.url)
    const field = url.searchParams.get('field')
    const value = url.searchParams.get('value')
    const warehouseId = url.searchParams.get('warehouseId')

    if (!field || !value) {
      return NextResponse.json(
        { message: 'Field and value parameters are required' },
        { status: 400 }
      )
    }

    const tenantWhere: any = {
      tenantId: {
        equals: tenant.id,
      },
    }

    switch (field) {
      case 'batch': {
        // Given batch → return SKU ID
        // Find the batch in inbound-product-line and get its SKU
        const productLines = await payload.find({
          collection: 'inbound-product-line',
          where: {
            and: [
              {
                batchNumber: {
                  equals: value,
                },
              },
            ],
          },
          depth: 1,
          limit: 1,
        })

        if (productLines.docs.length === 0) {
          return NextResponse.json({
            success: true,
            data: {},
          })
        }

        const productLine = productLines.docs[0] as any
        const skuId =
          typeof productLine.skuId === 'object' ? productLine.skuId : productLine.skuId
        const skuCode =
          typeof productLine.skuId === 'object' ? productLine.skuId.skuCode : undefined

        // If warehouse is provided, verify this batch exists in put-away-stock for that warehouse
        if (warehouseId) {
          const putAwayRecords = await payload.find({
            collection: 'put-away-stock',
            where: {
              and: [
                tenantWhere,
                {
                  warehouseId: {
                    equals: Number(warehouseId),
                  },
                },
                {
                  inboundProductLineId: {
                    equals: productLine.id,
                  },
                },
                {
                  isDeleted: {
                    equals: false,
                  },
                },
              ],
            },
            limit: 1,
          })

          if (putAwayRecords.docs.length === 0) {
            return NextResponse.json({
              success: true,
              data: {},
            })
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            skuId: skuCode || skuId?.toString(),
          },
        })
      }

      case 'skuId': {
        // Given SKU ID → return SKU description, expiry, attribute1, attribute2 (filtered by warehouse)
        // First find the SKU
        const skuResult = await payload.find({
          collection: 'skus',
          where: {
            and: [
              tenantWhere,
              {
                skuCode: {
                  equals: value,
                },
              },
            ],
          },
          limit: 1,
        })

        if (skuResult.docs.length === 0) {
          return NextResponse.json({
            success: true,
            data: {},
          })
        }

        const sku = skuResult.docs[0] as any
        const result: any = {
          skuDescription: sku.description || '',
        }

        // If warehouse is provided, get expiry, attribute1, attribute2 from actual inventory records
        if (warehouseId) {
          const putAwayRecords = await payload.find({
            collection: 'put-away-stock',
            where: {
              and: [
                tenantWhere,
                {
                  warehouseId: {
                    equals: Number(warehouseId),
                  },
                },
                {
                  skuId: {
                    equals: sku.id,
                  },
                },
                {
                  isDeleted: {
                    equals: false,
                  },
                },
              ],
            },
            depth: 2,
            limit: 100,
          })

          // Get unique values from product lines
          const expirySet = new Set<string>()
          const attr1Set = new Set<string>()
          const attr2Set = new Set<string>()

          for (const record of putAwayRecords.docs) {
            const productLine =
              typeof (record as any).inboundProductLineId === 'object'
                ? (record as any).inboundProductLineId
                : null

            if (productLine) {
              if (productLine.expiryDate) {
                expirySet.add(productLine.expiryDate)
              }
              if (productLine.attribute1) {
                attr1Set.add(productLine.attribute1)
              }
              if (productLine.attribute2) {
                attr2Set.add(productLine.attribute2)
              }
            }
          }

          // Use first value found (or most common if we want to enhance later)
          if (expirySet.size > 0) {
            result.expiry = Array.from(expirySet)[0]
          }
          if (attr1Set.size > 0) {
            result.attribute1 = Array.from(attr1Set)[0]
          }
          if (attr2Set.size > 0) {
            result.attribute2 = Array.from(attr2Set)[0]
          }
        }

        return NextResponse.json({
          success: true,
          data: result,
        })
      }

      default:
        return NextResponse.json({ message: `Unknown field: ${field}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Error fetching related data:', error)
    return NextResponse.json(
      { message: 'Failed to fetch related data' },
      { status: 500 }
    )
  }
}



