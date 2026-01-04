'use client'

import * as React from 'react'
import { Input } from './input'
import { Label } from './label'
import { Select } from './select'
import { Textarea } from './textarea'
import { Combobox, type ComboboxOption } from './combobox'
import { cn } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'

export interface FormFieldProps {
  label?: string
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
  htmlFor?: string
}

export function FormField({
  label,
  error,
  required,
  className,
  children,
  htmlFor,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label
          htmlFor={htmlFor}
          required={required}
        >
          {label}
        </Label>
      )}
      {children}
      {error && (
        <div className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

export interface FormInputProps extends React.ComponentProps<typeof Input> {
  label?: string
  error?: string
  required?: boolean
  containerClassName?: string
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, required, containerClassName, className, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

    return (
      <FormField
        label={label}
        error={error}
        required={required}
        htmlFor={inputId}
        className={containerClassName}
      >
        <Input
          id={inputId}
          ref={ref}
          className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
      </FormField>
    )
  },
)
FormInput.displayName = 'FormInput'

export interface FormSelectProps extends React.ComponentProps<typeof Select> {
  label?: string
  error?: string
  required?: boolean
  containerClassName?: string
  placeholder?: string
  options?: Array<{ value: string | number; label: string }>
}

export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  (
    {
      label,
      error,
      required,
      containerClassName,
      className,
      id,
      placeholder,
      options,
      children,
      ...props
    },
    ref,
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`

    return (
      <FormField
        label={label}
        error={error}
        required={required}
        htmlFor={selectId}
        className={containerClassName}
      >
        <Select
          id={selectId}
          ref={ref}
          className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : undefined}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          {children}
        </Select>
      </FormField>
    )
  },
)
FormSelect.displayName = 'FormSelect'

export interface FormTextareaProps extends React.ComponentProps<typeof Textarea> {
  label?: string
  error?: string
  required?: boolean
  containerClassName?: string
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, required, containerClassName, className, id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`

    return (
      <FormField
        label={label}
        error={error}
        required={required}
        htmlFor={textareaId}
        className={containerClassName}
      >
        <Textarea
          id={textareaId}
          ref={ref}
          className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          {...props}
        />
      </FormField>
    )
  },
)
FormTextarea.displayName = 'FormTextarea'

export interface FormComboboxProps {
  label?: string
  error?: string
  required?: boolean
  containerClassName?: string
  placeholder?: string
  emptyText?: string
  options?: ComboboxOption[]
  value?: string | number
  onValueChange?: (value: string | number | undefined) => void
  disabled?: boolean
  className?: string
  id?: string
}

export const FormCombobox = React.forwardRef<HTMLButtonElement, FormComboboxProps>(
  ({ label, error, required, containerClassName, className, id, value, options, ...props }, ref) => {
    const comboboxId = id || `combobox-${Math.random().toString(36).substr(2, 9)}`

    return (
      <FormField
        label={label}
        error={error}
        required={required}
        htmlFor={comboboxId}
        className={containerClassName}
      >
        <Combobox
          {...props}
          value={value}
          options={options || []}
          className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
        />
      </FormField>
    )
  },
)
FormCombobox.displayName = 'FormCombobox'
