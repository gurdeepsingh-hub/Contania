'use client'

/**
 * Example usage of the Combobox component
 * This file demonstrates how to use the accessible combobox component
 */

import * as React from 'react'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'

export function ComboboxExample() {
  const [selectedValue, setSelectedValue] = React.useState<string | number>()

  const options: ComboboxOption[] = [
    { value: '1', label: 'Apple' },
    { value: '2', label: 'Banana' },
    { value: '3', label: 'Cherry' },
    { value: '4', label: 'Date' },
    { value: '5', label: 'Elderberry' },
    { value: '6', label: 'Fig' },
    { value: '7', label: 'Grape' },
  ]

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <Label htmlFor="fruit-combobox">Select a fruit</Label>
        <Combobox
          options={options}
          value={selectedValue}
          onValueChange={setSelectedValue}
          placeholder="Choose a fruit..."
          emptyText="No fruits found."
          clearable
          name="fruit"
          aria-label="Fruit selection"
        />
      </div>

      <div className="text-sm text-muted-foreground">
        <p>Selected value: {selectedValue ?? 'None'}</p>
        <p className="mt-2">
          <strong>Keyboard shortcuts:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>Type to search and open dropdown</li>
          <li>Arrow keys to navigate</li>
          <li>Enter to select</li>
          <li>Escape to close</li>
          <li>Backspace to clear (when clearable)</li>
        </ul>
      </div>
    </div>
  )
}
