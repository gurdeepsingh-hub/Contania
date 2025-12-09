/**
 * Utility functions for subdomain generation and management
 */

/**
 * Generate a slug from a string (for subdomain)
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Generate a unique subdomain from company name
 */
export async function generateUniqueSubdomain(
  companyName: string,
  checkUniqueness: (subdomain: string) => Promise<boolean>,
): Promise<string> {
  const baseSubdomain = slugify(companyName)

  // Check if base subdomain is available
  const isAvailable = await checkUniqueness(baseSubdomain)

  if (isAvailable) {
    return baseSubdomain
  }

  // If not available, try with numbers
  for (let i = 1; i <= 999; i++) {
    const candidate = `${baseSubdomain}-${i}`
    const available = await checkUniqueness(candidate)
    if (available) {
      return candidate
    }
  }

  // Fallback: use timestamp
  return `${baseSubdomain}-${Date.now()}`
}

/**
 * Get full subdomain URL (e.g., "abc-trucking.containa.io")
 */
export function getSubdomainUrl(subdomain: string, baseDomain?: string): string {
  const domain = baseDomain || process.env.DEFAULT_HOST || 'containa.io'
  return `${subdomain}.${domain}`
}
