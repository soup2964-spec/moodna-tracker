import type { ScanResult, SuppressedListing } from "./types.js"
import { checkListingSuppression } from "./suppression.js"

export function normalizeListingUrl(url: string) {
  try {
    const parsed = new URL(url)
    parsed.hash = ""
    parsed.search = ""
    return parsed.href.replace(/\/$/, "").toLowerCase()
  } catch {
    return url.trim().toLowerCase().replace(/\/$/, "")
  }
}

export function listingFingerprint(url: string) {
  const normalized = normalizeListingUrl(url)

  const asinMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
  if (asinMatch) return `amazon:asin:${asinMatch[1].toUpperCase()}`

  const etsyMatch = url.match(/etsy\.com\/listing\/(\d+)/i)
  if (etsyMatch) return `etsy:listing:${etsyMatch[1]}`

  const ebayMatch = url.match(/ebay\.(?:com|[a-z]{2,3})\/.+\/(\d{6,})/i)
  if (ebayMatch) return `ebay:item:${ebayMatch[1]}`

  try {
    const parsed = new URL(normalized)
    const host = parsed.hostname.replace(/^www\./, "")
    if (parsed.pathname === "/" || parsed.pathname === "") {
      return `site:${host}`
    }
    return `${host}${parsed.pathname}`.toLowerCase()
  } catch {
    return normalized
  }
}

const OPEN_REVIEW_STATUSES = new Set<ScanResult["status"]>(["new", "reviewing", "approved", "reappeared"])

export function isDuplicateResult(
  existingResults: ScanResult[],
  brandProfileId: string,
  listingUrl: string,
  suppressions: SuppressedListing[] = [],
) {
  const suppression = checkListingSuppression(suppressions, existingResults, brandProfileId, listingUrl)
  if (suppression.suppressed && !suppression.monitorForReturn) return true

  const fingerprint = listingFingerprint(listingUrl)
  const normalized = normalizeListingUrl(listingUrl)

  return existingResults.some((result) => {
    if (result.brandProfileId !== brandProfileId) return false
    if (!OPEN_REVIEW_STATUSES.has(result.status)) return false

    return (
      listingFingerprint(result.listingUrl) === fingerprint ||
      normalizeListingUrl(result.listingUrl) === normalized
    )
  })
}

export function dedupeScanResults(results: ScanResult[]) {
  const kept: ScanResult[] = []

  for (const result of results) {
    const duplicate = kept.some(
      (existing) =>
        existing.brandProfileId === result.brandProfileId &&
        listingFingerprint(existing.listingUrl) === listingFingerprint(result.listingUrl),
    )
    if (!duplicate) kept.push(result)
  }

  return kept
}

export function mergeScanResults(existing: ScanResult[], incoming: ScanResult[]) {
  return dedupeScanResults([...incoming, ...existing])
}
