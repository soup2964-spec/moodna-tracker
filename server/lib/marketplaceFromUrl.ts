import type { Marketplace } from "./types.js"
import { getDomain } from "./urlUtils.js"

export type SearchListingResult = {
  title: string
  url: string
  snippet?: string
}

const HOST_PATTERNS: Array<{ pattern: RegExp; marketplace: Marketplace }> = [
  { pattern: /(^|\.)amazon\./i, marketplace: "amazon" },
  { pattern: /(^|\.)walmart\./i, marketplace: "walmart" },
  { pattern: /(^|\.)ebay\./i, marketplace: "ebay" },
  { pattern: /(^|\.)etsy\.com$/i, marketplace: "etsy" },
  { pattern: /(^|\.)aliexpress\./i, marketplace: "aliexpress" },
  { pattern: /myshopify\.com$/i, marketplace: "shopify" },
  { pattern: /(^|\.)reddit\.com$/i, marketplace: "reddit" },
  { pattern: /(^|\.)t\.me$/i, marketplace: "telegram" },
  { pattern: /(^|\.)x\.com$/i, marketplace: "twitter" },
  { pattern: /(^|\.)twitter\.com$/i, marketplace: "twitter" },
  { pattern: /(^|\.)discord\.com$/i, marketplace: "discord" },
  { pattern: /(^|\.)kemono\./i, marketplace: "kemono" },
  { pattern: /(^|\.)bunkr\./i, marketplace: "bunkr" },
  { pattern: /(^|\.)simpcity\./i, marketplace: "simpcity" },
  { pattern: /(^|\.)thothub\./i, marketplace: "thothub" },
]

export function normalizeBrandText(value: string) {
  return value
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function brandNameMatches(haystack: string, brandName: string) {
  const normalizedBrand = normalizeBrandText(brandName)
  if (!normalizedBrand) return false

  const normalizedHaystack = normalizeBrandText(haystack)
  if (normalizedHaystack.includes(normalizedBrand)) return true

  const compactBrand = normalizedBrand.replace(/\s+/g, "")
  const compactHaystack = normalizedHaystack.replace(/\s+/g, "")
  return compactHaystack.includes(compactBrand)
}

export function inferMarketplaceFromUrl(url: string): Marketplace | null {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    for (const entry of HOST_PATTERNS) {
      if (entry.pattern.test(hostname)) return entry.marketplace
    }
    if (entryMatchesShopifyStore(parsed.pathname)) return "shopify"
    return null
  } catch {
    return null
  }
}

export function resolveMarketplaceFromUrl(url: string): Marketplace {
  return inferMarketplaceFromUrl(url) ?? "web"
}

function entryMatchesShopifyStore(pathname: string) {
  return /\/products\/|\/collections\//i.test(pathname)
}

function isAmazonUrl(url: string) {
  try {
    return /(^|\.)amazon\./i.test(new URL(url).hostname)
  } catch {
    return /amazon\.(com|[a-z]{2,3})/i.test(url)
  }
}

export function isOfficialBrandUrl(candidateUrl: string, brandWebsiteUrl: string) {
  try {
    const candidateHost = new URL(candidateUrl).hostname.replace(/^www\./, "").toLowerCase()
    const brandHost = new URL(brandWebsiteUrl).hostname.replace(/^www\./, "").toLowerCase()
    if (candidateHost === brandHost) return true
    if (candidateHost.endsWith(`.${brandHost}`)) return true
    return false
  } catch {
    return false
  }
}

export function buildExcludeOfficialSiteQuery(brandWebsiteUrl: string) {
  const brandDomain = getDomain(brandWebsiteUrl)
  if (!brandDomain) return ""
  return `-site:${brandDomain} -inurl:/stores/ -inurl:/store/`
}

export function buildAmazonExcludeOfficialQuery(brandNames: string[]) {
  const exclusions = ['-inurl:/stores/', '-inurl:/store/', '-intitle:"Visit the"']
  for (const brandName of brandNames) {
    const normalized = normalizeBrandText(brandName)
    if (!normalized) continue
    const tokens = normalized.split(" ").filter((token) => token.length > 3)
    for (const token of tokens.slice(0, 2)) {
      exclusions.push(`-intitle:"Visit the ${token}"`)
    }
  }
  return exclusions.join(" ")
}

function isLikelyOfficialAmazonListing(result: SearchListingResult, brandNames: string[]) {
  const title = result.title
  const snippet = result.snippet ?? ""
  const haystack = `${title} ${snippet}`
  const url = result.url.toLowerCase()

  if (url.includes("/stores/") || url.includes("/store/") || url.includes("/s?me=")) {
    return true
  }

  if (/\/dp\/|\/gp\/product\//i.test(url)) {
    for (const brandName of brandNames) {
      if (!brandName.trim()) continue
      if (!brandNameMatches(title, brandName)) continue
      if (/(counterfeit|replica|knockoff|compatible with|unauthorized|fake|look[- ]?alike|inspired by)/i.test(haystack)) {
        continue
      }
      return true
    }
  }

  if (/visit the .+ store/i.test(haystack)) return true
  if (/shop .+ on amazon/i.test(haystack)) return true
  if (/official (brand )?store/i.test(haystack)) return true
  if (/brand storefront/i.test(haystack)) return true

  for (const brandName of brandNames) {
    if (!brandName.trim()) continue

    if (/brand:\s*/i.test(snippet) && brandNameMatches(snippet, brandName)) return true

    const soldByMatch =
      snippet.match(/sold by\s+([^.;]+)/i) ??
      snippet.match(/ships from and sold by\s+([^.;]+)/i)
    if (soldByMatch && brandNameMatches(soldByMatch[1], brandName)) return true

    if (brandNameMatches(title, brandName) && /:\s*amazon\.com/i.test(title)) {
      if (!/(other sellers|new from|used from|by [^|]{3,40}(?: LLC|Inc|Co\.|Ltd))/i.test(snippet)) {
        return true
      }
    }

    if (
      brandNameMatches(title, brandName) &&
      /amazon\.com/i.test(haystack) &&
      /(free delivery|prime|subscribe|save|in stock)/i.test(snippet) &&
      !/(counterfeit|replica|knockoff|compatible with|unauthorized|fake)/i.test(haystack) &&
      !/(other sellers|new from|used from)/i.test(snippet)
    ) {
      return true
    }
  }

  return false
}

export function isLikelyOfficialListing(
  result: SearchListingResult,
  brandWebsiteUrl: string,
  brandNames: string | string[] = "",
) {
  const aliases = (Array.isArray(brandNames) ? brandNames : [brandNames]).filter(Boolean)

  if (isOfficialBrandUrl(result.url, brandWebsiteUrl)) return true

  const brandDomain = getDomain(brandWebsiteUrl).toLowerCase()
  const candidateDomain = getDomain(result.url).toLowerCase()
  const haystack = `${result.title} ${result.snippet ?? ""} ${result.url}`.toLowerCase()

  if (candidateDomain === brandDomain || candidateDomain.endsWith(`.${brandDomain}`)) {
    return true
  }

  if (brandDomain && haystack.includes(brandDomain)) {
    if (/official|authorized|brand store|visit the/i.test(haystack)) {
      return true
    }
  }

  if (isAmazonUrl(result.url) && isLikelyOfficialAmazonListing(result, aliases)) {
    return true
  }

  for (const brandName of aliases) {
    if (/visit the .+ store on amazon/i.test(haystack) && brandNameMatches(haystack, brandName)) {
      return true
    }
    if (/official store/i.test(haystack) && brandNameMatches(haystack, brandName)) {
      return true
    }
    if (/authorized (seller|dealer|retailer)/i.test(haystack) && brandNameMatches(haystack, brandName)) {
      return true
    }
  }

  return false
}

export function filterOfficialListings(
  results: SearchListingResult[],
  brandWebsiteUrl: string,
  brandNames: string | string[] = "",
) {
  const fraudulent = results.filter(
    (result) => !isLikelyOfficialListing(result, brandWebsiteUrl, brandNames),
  )
  const excludedCount = results.length - fraudulent.length

  return {
    results: fraudulent,
    excludedOfficialCount: excludedCount,
    note:
      excludedCount > 0
        ? `Excluded ${excludedCount} official brand listing(s). Only potentially fraudulent copycats are returned.`
        : "Only potentially fraudulent copycats are returned — official brand listings are excluded.",
  }
}

export function isPublicImageUrl(url: string) {
  return /^https?:\/\//i.test(url) && !url.startsWith("data:")
}
