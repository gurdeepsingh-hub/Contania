'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertCircle, CheckCircle2, X, Scan, Upload, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

type LPNValidationResult = {
  valid: boolean
  lpnNumber: string
  lpnId?: number
  huQty?: number
  location?: string
  message?: string
  warning?: boolean
}

interface PickupLPNInputProps {
  availableLPNs: Array<{
    id: number
    lpnNumber: string
    location: string
    huQty: number
    isPickedUp: boolean
  }>
  selectedLPNs: string[]
  onLPNAdd: (lpnNumber: string) => void
  onLPNRemove: (lpnNumber: string) => void
  onLPNAddBulk?: (lpnNumbers: string[]) => void
  onValidationChange?: (isValid: boolean) => void
  className?: string
}

export function PickupLPNInput({
  availableLPNs,
  selectedLPNs,
  onLPNAdd,
  onLPNRemove,
  onLPNAddBulk,
  onValidationChange,
  className,
}: PickupLPNInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [bulkInputValue, setBulkInputValue] = useState('')
  const [validationResult, setValidationResult] = useState<LPNValidationResult | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mode, setMode] = useState<'scan' | 'bulk' | 'checkbox'>('scan')
  const [filterLocation, setFilterLocation] = useState<string>('all')
  const [autoAdd, setAutoAdd] = useState(false) // Auto-add on valid scan

  // Get unique locations for filtering
  const locations = ['all', ...Array.from(new Set(availableLPNs.map((lpn) => lpn.location)))]

  // Filter available LPNs based on location filter
  const filteredLPNs = availableLPNs.filter((lpn) => {
    if (filterLocation === 'all') return true
    return lpn.location === filterLocation
  })

  // Available LPNs that aren't selected or picked up
  const selectableLPNs = filteredLPNs.filter(
    (lpn) => !selectedLPNs.includes(lpn.lpnNumber) && !lpn.isPickedUp,
  )

  const validateLPN = useCallback(
    (lpnNumber: string) => {
      // Check if already selected
      if (selectedLPNs.includes(lpnNumber)) {
        setValidationResult({
          valid: false,
          lpnNumber,
          message: 'LPN already selected',
          warning: true,
        })
        // Don't hide suggestions - user might want to see other options
        onValidationChange?.(false)
        return
      }

      // Find LPN in available list (exact match)
      const lpn = availableLPNs.find((l) => l.lpnNumber === lpnNumber)

      if (!lpn) {
        // No exact match - show suggestions but don't show error yet
        // Only show error if user has typed enough characters
        if (lpnNumber.length >= 3) {
          setValidationResult({
            valid: false,
            lpnNumber,
            message: 'LPN not found or not allocated to this product line',
            warning: false,
          })
        } else {
          setValidationResult(null)
        }
        // Keep suggestions visible
        onValidationChange?.(false)
        return
      }

      if (lpn.isPickedUp) {
        setValidationResult({
          valid: false,
          lpnNumber,
          message: 'LPN already picked up',
          warning: false,
        })
        setShowSuggestions(false)
        onValidationChange?.(false)
        return
      }

      // Valid LPN - exact match found
      setValidationResult({
        valid: true,
        lpnNumber: lpn.lpnNumber,
        lpnId: lpn.id,
        huQty: lpn.huQty,
        location: lpn.location,
        message: `LPN found: ${lpn.huQty} qty at ${lpn.location}`,
      })
      // Hide suggestions when exact match is found
      setShowSuggestions(false)
      onValidationChange?.(true)
    },
    [selectedLPNs, availableLPNs, onValidationChange],
  )

  useEffect(() => {
    if (inputValue.trim() && mode === 'scan') {
      validateLPN(inputValue.trim())
      // Show suggestions immediately when typing if there are matches
      const filtered = availableLPNs.filter(
        (lpn) =>
          lpn.lpnNumber.toLowerCase().includes(inputValue.toLowerCase()) &&
          !selectedLPNs.includes(lpn.lpnNumber) &&
          !lpn.isPickedUp,
      )
      if (filtered.length > 0) {
        setShowSuggestions(true)
      } else {
        setShowSuggestions(false)
      }
    } else {
      setValidationResult(null)
      setShowSuggestions(false)
    }
  }, [inputValue, availableLPNs, selectedLPNs, mode, validateLPN])

  // Auto-add on valid scan if enabled
  useEffect(() => {
    if (autoAdd && mode === 'scan' && validationResult?.valid) {
      const timer = setTimeout(() => {
        if (validationResult?.valid && validationResult.lpnNumber) {
          onLPNAdd(validationResult.lpnNumber)
          setInputValue('')
          setValidationResult(null)
          onValidationChange?.(false)
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoAdd, mode, validationResult, onLPNAdd, onValidationChange])

  const handleAdd = () => {
    if (validationResult?.valid && validationResult.lpnNumber) {
      onLPNAdd(validationResult.lpnNumber)
      setInputValue('')
      setValidationResult(null)
      onValidationChange?.(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && validationResult?.valid) {
      e.preventDefault()
      handleAdd()
    }
  }

  const handleBulkPaste = () => {
    if (!bulkInputValue.trim()) return

    // Parse LPNs from various formats: comma-separated, newline-separated, space-separated
    const lpnNumbers = bulkInputValue
      .split(/[,\n\r\t\s]+/)
      .map((lpn) => lpn.trim().toUpperCase())
      .filter((lpn) => lpn.length > 0)

    const validLPNs: string[] = []
    const invalidLPNs: string[] = []

    lpnNumbers.forEach((lpnNumber) => {
      const lpn = availableLPNs.find(
        (l) => l.lpnNumber === lpnNumber && !l.isPickedUp && !selectedLPNs.includes(lpnNumber),
      )
      if (lpn) {
        validLPNs.push(lpnNumber)
      } else {
        invalidLPNs.push(lpnNumber)
      }
    })

    if (validLPNs.length > 0) {
      if (onLPNAddBulk) {
        onLPNAddBulk(validLPNs)
      } else {
        validLPNs.forEach((lpn) => onLPNAdd(lpn))
      }
      setBulkInputValue('')
    }

    if (invalidLPNs.length > 0) {
      alert(
        `Could not add ${invalidLPNs.length} LPN(s): ${invalidLPNs.join(', ')}\n\nReasons: Not found, already selected, or already picked up.`,
      )
    }

    if (validLPNs.length > 0) {
      alert(`Successfully added ${validLPNs.length} LPN(s)`)
    }
  }

  const handleSelectAll = () => {
    const lpnNumbers = selectableLPNs.map((lpn) => lpn.lpnNumber)
    if (onLPNAddBulk) {
      onLPNAddBulk(lpnNumbers)
    } else {
      lpnNumbers.forEach((lpn) => onLPNAdd(lpn))
    }
  }

  // Filter suggestions based on input
  const suggestions = availableLPNs.filter(
    (lpn) =>
      lpn.lpnNumber.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedLPNs.includes(lpn.lpnNumber) &&
      !lpn.isPickedUp,
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* Mode Switcher */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          type="button"
          variant={mode === 'scan' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setMode('scan')}
          className="flex items-center gap-2"
        >
          <Scan className="h-4 w-4" />
          Scan
        </Button>
        <Button
          type="button"
          variant={mode === 'bulk' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setMode('bulk')}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Bulk Paste
        </Button>
        <Button
          type="button"
          variant={mode === 'checkbox' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setMode('checkbox')}
          className="flex items-center gap-2"
        >
          <CheckSquare className="h-4 w-4" />
          Select
        </Button>
      </div>

      {/* Scan Mode */}
      {mode === 'scan' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <Label>Scan or Type LPN</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-add"
                checked={autoAdd}
                onCheckedChange={(checked) => setAutoAdd(checked === true)}
              />
              <Label htmlFor="auto-add" className="text-xs cursor-pointer">
                Auto-add on scan
              </Label>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Enter or scan LPN number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (inputValue.trim() && suggestions.length > 0) {
                    setShowSuggestions(true)
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200)
                }}
                className={cn(
                  validationResult?.valid && 'border-green-500',
                  validationResult && !validationResult.valid && 'border-red-500',
                )}
                autoFocus
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {suggestions.slice(0, 5).map((lpn) => (
                    <button
                      key={lpn.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                      onClick={() => {
                        setInputValue(lpn.lpnNumber)
                        validateLPN(lpn.lpnNumber)
                        setShowSuggestions(false)
                      }}
                    >
                      <div className="font-medium">{lpn.lpnNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        Qty: {lpn.huQty} | Location: {lpn.location}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!autoAdd && (
              <Button
                type="button"
                onClick={handleAdd}
                disabled={!validationResult?.valid}
                size="sm"
              >
                Add
              </Button>
            )}
          </div>

          {validationResult && (
            <div
              className={cn(
                'flex items-start gap-2 p-2 rounded-md text-sm',
                validationResult.valid
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : validationResult.warning
                    ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                    : 'bg-red-50 text-red-800 border border-red-200',
              )}
            >
              {validationResult.valid ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <div className="flex-1">
                <div className="font-medium">{validationResult.message}</div>
                {validationResult.valid && validationResult.huQty && (
                  <div className="text-xs mt-1">
                    Quantity: {validationResult.huQty} | Location: {validationResult.location}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Paste Mode */}
      {mode === 'bulk' && (
        <div className="space-y-2">
          <div className="space-y-2">
            <Label>Paste Multiple LPNs</Label>
            <Textarea
              placeholder="Paste LPNs separated by commas, spaces, or new lines&#10;Example: LPN001, LPN002, LPN003&#10;Or: LPN001&#10;LPN002&#10;LPN003"
              value={bulkInputValue}
              onChange={(e) => setBulkInputValue(e.target.value.toUpperCase())}
              rows={6}
              className="font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {bulkInputValue.split(/[,\n\r\t\s]+/).filter((l) => l.trim()).length} LPN(s)
                detected
              </p>
              <Button onClick={handleBulkPaste} disabled={!bulkInputValue.trim()}>
                Add All Valid LPNs
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Checkbox Selection Mode */}
      {mode === 'checkbox' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <Label>Select LPNs</Label>
            <div className="flex items-center gap-2">
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="flex h-9 w-[180px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc === 'all' ? 'All Locations' : loc}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={selectableLPNs.length === 0}
              >
                Select All ({selectableLPNs.length})
              </Button>
            </div>
          </div>
          <div className="border rounded-md max-h-[300px] overflow-y-auto p-2">
            {selectableLPNs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {filterLocation !== 'all'
                  ? 'No available LPNs at this location'
                  : 'All LPNs are already selected or picked up'}
              </div>
            ) : (
              <div className="space-y-2">
                {selectableLPNs.map((lpn) => {
                  const isSelected = selectedLPNs.includes(lpn.lpnNumber)
                  return (
                    <div
                      key={lpn.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-md hover:bg-muted/50',
                        isSelected && 'bg-muted',
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onLPNAdd(lpn.lpnNumber)
                          } else {
                            onLPNRemove(lpn.lpnNumber)
                          }
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-mono font-medium">{lpn.lpnNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          Qty: {lpn.huQty} | Location: {lpn.location}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected LPNs Display */}
      {selectedLPNs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Selected LPNs ({selectedLPNs.length})</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                selectedLPNs.forEach((lpn) => onLPNRemove(lpn))
              }}
            >
              Clear All
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-2 border rounded-md">
            {selectedLPNs.map((lpnNumber) => {
              const lpn = availableLPNs.find((l) => l.lpnNumber === lpnNumber)
              return (
                <div
                  key={lpnNumber}
                  className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm"
                >
                  <span className="font-mono font-medium">{lpnNumber}</span>
                  {lpn && <span className="text-xs text-muted-foreground">({lpn.huQty} qty)</span>}
                  <button
                    type="button"
                    onClick={() => onLPNRemove(lpnNumber)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
