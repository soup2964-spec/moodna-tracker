import type { BrandProfile, IpAsset } from "./types.js"
import { getDomain, normalizeUrl } from "./urlUtils.js"

const STOCKIST_PAGE_PATTERN =
  /stockist|stockists|dealer|dealers|retailer|retailers|where-to-buy|store-locator|find-a-store|authorized|partner|reseller/i

const STOCKIST_CONTEXT_PATTERN =
  /authorized dealer|official stockist|authorized retailer|our partners|where to buy|find a store/i

function normalizeDomain(hostname: string) {
  return hostname.replace(/^www\./, "").toLowerCase()
}

function isBrandDomain(hostname: string, brandDomain: string) {
  const normalized = normalizeDomain(hostname)
  return normalized === brandDomain || normalized.endsWith(`.${brandDomain}`)
}

function extractExternalDomainsFromText(text: string, brandDomain: string) {
  const domains = new Set<string>()
  const urlMatches = text.match(/https?:\/\/[^\s"'<>]+/gi) ?? []

  for (const rawUrl of urlMatches) {
    try {
      const hostname = normalizeDomain(new URL(rawUrl).hostname)
      if (!hostname.includes(".")) continue
      if (isBrandDomain(hostname, brandDomain)) continue
      domains.add(hostname)
    } catch {
      // skip
    }
  }

  return domains
}

export function extractAuthorizedRetailerDomains(brand: BrandProfile, ipAssets?: IpAsset[]) {
  const brandDomain = getDomain(brand.websiteUrl).toLowerCase()
  const domains = new Set<string>()

  for (const asset of ipAssets ?? []) {
    const sourceUrl = asset.sourceUrl ?? asset.value
    const onStockistPage =
      STOCKIST_PAGE_PATTERN.test(sourceUrl) ||
      STOCKIST_CONTEXT_PATTERN.test(asset.value.slice(0, 500))

    if (asset.type === "page_content" && onStockistPage) {
      for (const domain of extractExternalDomainsFromText(asset.value, brandDomain)) {
        domains.add(domain)
      }
    }

    if (STOCKIST_CONTEXT_PATTERN.test(asset.value)) {
      for (const domain of extractExternalDomainsFromText(asset.value, brandDomain)) {
        domains.add(domain)
      }
    }
  }

  return [...domains]
}

export function isAuthorizedRetailerListing(
  listingUrl: string,
  brand: BrandProfile,
  ipAssets?: IpAsset[],
) {
  let hostname = ""
  try {
    hostname = normalizeDomain(new URL(normalizeUrl(listingUrl)).hostname)
  } catch {
    return false
  }

  const brandDomain = getDomain(brand.websiteUrl).toLowerCase()
  if (isBrandDomain(hostname, brandDomain)) return true

  const allowlist = extractAuthorizedRetailerDomains(brand, ipAssets)
  if (allowlist.includes(hostname)) return true

  return allowlist.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
}

export function filterUnauthorizedCandidates<T extends { listingUrl: string }>(
  candidates: T[],
  brand: BrandProfile,
  ipAssets?: IpAsset[],
) {
  return candidates.filter(
    (candidate) => !isAuthorizedRetailerListing(candidate.listingUrl, brand, ipAssets),
  )
}
