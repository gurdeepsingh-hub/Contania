'use client'

import * as React from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

export interface ComboboxOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface ComboboxProps {
  options: ComboboxOption[]
  value?: string | number
  onValueChange?: (value: string | number | undefined) => void
  placeholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  clearable?: boolean
  name?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select option...',
  emptyText = 'No option found.',
  className,
  disabled = false,
  clearable = false,
  name,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState('')
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const selectedOption = React.useMemo(
    () => {
      if (!value) return undefined
      return options.find((option) => String(option.value) === String(value))
    },
    [options, value]
  )

  // Filter options based on input value
  const filteredOptions = React.useMemo(() => {
    if (!inputValue.trim()) return options
    const searchLower = inputValue.toLowerCase()
    return options.filter((option) => option.label.toLowerCase().includes(searchLower))
  }, [options, inputValue])

  // Update input value when selection changes externally or when options load with a value
  React.useEffect(() => {
    // When selectedOption is found, always update the input value
    if (selectedOption) {
      setInputValue(selectedOption.label)
      return
    }

    // If dropdown is closed, handle clearing logic
    if (!open) {
      if (!value) {
        // No value - clear input
        setInputValue('')
      } else if (options.length > 0) {
        // We have a value but no selectedOption found after options loaded
        // This means the value doesn't match any option - clear input
        setInputValue('')
      }
      // If options.length === 0, we're still loading - don't clear yet
    }
  }, [selectedOption, open, value, options])

  // Reset highlighted index when options change
  React.useEffect(() => {
    setHighlightedIndex(-1)
  }, [filteredOptions])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setOpen(true)
    setHighlightedIndex(-1)

    // Clear selection if input doesn't match selected option
    if (selectedOption && newValue !== selectedOption.label) {
      onValueChange?.(undefined)
    }
  }

  // Handle input focus
  const handleInputFocus = () => {
    if (!disabled) {
      setOpen(true)
    }
  }

  // Handle input blur
  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Don't close if clicking on dropdown items
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return
    }
    setOpen(false)
    // Reset input to selected option label if no selection made
    if (selectedOption) {
      setInputValue(selectedOption.label)
    } else {
      setInputValue('')
    }
    setHighlightedIndex(-1)
  }

  // Handle option selection
  const handleSelect = (option: ComboboxOption) => {
    if (option.disabled) return
    onValueChange?.(option.value)
    setInputValue(option.label)
    setOpen(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  // Handle clear button
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange?.(undefined)
    setInputValue('')
    setOpen(false)
    inputRef.current?.focus()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) {
          setOpen(true)
        } else {
          setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev))
        }
        break

      case 'ArrowUp':
        e.preventDefault()
        if (open) {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        }
        break

      case 'Enter':
        e.preventDefault()
        if (open && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex])
        } else if (open && filteredOptions.length === 1) {
          // If only one option matches, select it
          handleSelect(filteredOptions[0])
        }
        break

      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setHighlightedIndex(-1)
        if (selectedOption) {
          setInputValue(selectedOption.label)
        } else {
          setInputValue('')
        }
        break

      case 'Tab':
        setOpen(false)
        break

      default:
        // Open dropdown when typing
        if (!open && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          setOpen(true)
        }
        break
    }
  }

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement
      if (item) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [highlightedIndex])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        if (selectedOption) {
          setInputValue(selectedOption.label)
        } else {
          setInputValue('')
        }
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [open, selectedOption])

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? 'combobox-listbox' : undefined}
          aria-autocomplete="list"
          role="combobox"
          className={cn('pr-8', clearable && value && 'pr-16')}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
          {clearable && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              className="pointer-events-auto rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Clear selection"
              tabIndex={-1}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <ChevronDown
            className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')}
          />
        </div>
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover text-popover-foreground shadow-md">
          <ul
            ref={listRef}
            id="combobox-listbox"
            role="listbox"
            className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1"
          >
            {filteredOptions.length === 0 ? (
              <li
                role="option"
                aria-selected="false"
                className="px-2 py-1.5 text-sm text-muted-foreground text-center"
              >
                {emptyText}
              </li>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = String(value) === String(option.value)
                const isHighlighted = index === highlightedIndex

                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelect(option)
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                      'hover:bg-accent hover:text-accent-foreground',
                      isHighlighted && 'bg-accent text-accent-foreground',
                      isSelected && 'bg-accent/50',
                      option.disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
                    )}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex-1">{option.label}</span>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}

      {/* Hidden input for form submission */}
      {name && (
        <input type="hidden" name={name} value={value ?? ''} aria-hidden="true" tabIndex={-1} />
      )}
    </div>
  )
}
