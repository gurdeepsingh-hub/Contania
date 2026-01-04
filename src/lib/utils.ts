import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Helper function for react-hook-form register options
 * Converts empty strings to undefined before converting to number
 * This prevents NaN errors when select boxes have placeholder/empty options
 */
export function valueAsNumberOrUndefined(value: string): number | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }
  const num = Number(value)
  return isNaN(num) ? undefined : num
}
