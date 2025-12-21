'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AggregatedInventoryItem } from '@/lib/inventory-helpers'

type InventoryResultsTableProps = {
  results: AggregatedInventoryItem[]
  loading?: boolean
}

export function InventoryResultsTable({
  results,
  loading = false,
}: InventoryResultsTableProps) {
  const router = useRouter()

  const handleMultiValueClick = (
    filterType: string,
    value: string,
  ) => {
    router.push(`/dashboard/inventory/${filterType}/${encodeURIComponent(value)}`)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading results...</div>
        </CardContent>
      </Card>
    )
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">No inventory found matching your search criteria.</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Results ({results.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">SKU ID</th>
                <th className="text-left p-2 font-medium">Description</th>
                <th className="text-left p-2 font-medium">QTY Available</th>
                <th className="text-left p-2 font-medium">QTY Received</th>
                <th className="text-left p-2 font-medium">QTY Allocated</th>
                <th className="text-left p-2 font-medium">QTY Picked</th>
                <th className="text-left p-2 font-medium">QTY Dispatched</th>
                <th className="text-left p-2 font-medium">QTY Hold</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">Batch</th>
                <th className="text-left p-2 font-medium">Expiry</th>
                <th className="text-left p-2 font-medium">Attribute 1</th>
                <th className="text-left p-2 font-medium">Attribute 2</th>
                <th className="text-left p-2 font-medium">LPN</th>
                <th className="text-left p-2 font-medium">Weight Available</th>
                <th className="text-left p-2 font-medium">Cubic Available</th>
                <th className="text-left p-2 font-medium">SQM/SU</th>
                <th className="text-left p-2 font-medium">Location</th>
                <th className="text-left p-2 font-medium">Zone</th>
                <th className="text-left p-2 font-medium">Inbound Order</th>
                <th className="text-left p-2 font-medium">Customer Reference</th>
                <th className="text-left p-2 font-medium">Container Number</th>
                <th className="text-left p-2 font-medium">Customer Name</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item, index) => (
                <tr key={index} className="border-b hover:bg-muted/50">
                  <td className="p-2 font-medium">{item.skuId}</td>
                  <td className="p-2">{item.skuDescription || 'N/A'}</td>
                  <td className="p-2">{formatNumber(item.qtyAvailable)}</td>
                  <td className="p-2">{formatNumber(item.qtyReceived)}</td>
                  <td className="p-2">{formatNumber(item.qtyAllocated)}</td>
                  <td className="p-2">{formatNumber(item.qtyPicked)}</td>
                  <td className="p-2">{formatNumber(item.qtyDispatched)}</td>
                  <td className="p-2">{formatNumber(item.qtyHold)}</td>
                  <td className="p-2">
                    {item.status.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.status.map((status, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            onClick={() => handleMultiValueClick('status', status)}
                          >
                            {status}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="p-2">
                    {item.batches.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.batches.map((batch, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            onClick={() => handleMultiValueClick('batch', batch)}
                          >
                            {batch}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="p-2">{formatDate(item.expiry)}</td>
                  <td className="p-2">{item.attribute1 || 'N/A'}</td>
                  <td className="p-2">{item.attribute2 || 'N/A'}</td>
                  <td className="p-2">
                    {item.lpns.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.lpns.map((lpn, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            onClick={() => handleMultiValueClick('lpn', lpn)}
                          >
                            {lpn}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="p-2">{formatNumber(item.weightAvailable)}</td>
                  <td className="p-2">{formatNumber(item.cubicAvailable)}</td>
                  <td className="p-2">{item.sqmPerSU ? formatNumber(item.sqmPerSU) : 'N/A'}</td>
                  <td className="p-2">
                    {item.locations.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.locations.map((location, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            onClick={() => handleMultiValueClick('location', location)}
                          >
                            {location}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="p-2">{item.zone || 'N/A'}</td>
                  <td className="p-2">
                    {item.inboundOrderNumbers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.inboundOrderNumbers.map((order, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            onClick={() => handleMultiValueClick('inbound-order', order)}
                          >
                            {order}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="p-2">
                    {item.customerReferences.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.customerReferences.map((ref, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            onClick={() => handleMultiValueClick('customer-reference', ref)}
                          >
                            {ref}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="p-2">
                    {item.containerNumbers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.containerNumbers.map((container, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            onClick={() => handleMultiValueClick('container', container)}
                          >
                            {container}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="p-2">{item.customerName || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}




