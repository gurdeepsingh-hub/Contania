'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
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
  onValidationChange?: (isValid: boolean) => void
  className?: string
}

export function PickupLPNInput({
  availableLPNs,
  selectedLPNs,
  onLPNAdd,
  onLPNRemove,
  onValidationChange,
  className,
}: PickupLPNInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [validationResult, setValidationResult] = useState<LPNValidationResult | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    if (inputValue.trim()) {
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
  }, [inputValue, availableLPNs, selectedLPNs])

  const validateLPN = (lpnNumber: string) => {
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
  }

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

  // Filter suggestions based on input
  const suggestions = availableLPNs.filter(
    (lpn) =>
      lpn.lpnNumber.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedLPNs.includes(lpn.lpnNumber) &&
      !lpn.isPickedUp,
  )

  return (
    <div className={cn('space-y-2', className)}>
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
              // Delay hiding suggestions to allow clicking on them
              setTimeout(() => setShowSuggestions(false), 200)
            }}
            className={cn(
              validationResult?.valid && 'border-green-500',
              validationResult && !validationResult.valid && 'border-red-500',
            )}
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
        <Button
          type="button"
          onClick={handleAdd}
          disabled={!validationResult?.valid}
          size="sm"
        >
          Add
        </Button>
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
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
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

      {selectedLPNs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedLPNs.map((lpnNumber) => {
            const lpn = availableLPNs.find((l) => l.lpnNumber === lpnNumber)
            return (
              <div
                key={lpnNumber}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm"
              >
                <span className="font-mono font-medium">{lpnNumber}</span>
                {lpn && (
                  <span className="text-xs text-muted-foreground">
                    ({lpn.huQty} qty)
                  </span>
                )}
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
      )}
    </div>
  )
}

