import type { BrandProfile, IpAsset, Marketplace, ScanCandidate } from "./types.js"
import { listingFingerprint } from "./dedupe.js"
import {
  buildAmazonExcludeOfficialQuery,
  buildExcludeOfficialSiteQuery,
  inferMarketplaceFromUrl,
  isLikelyOfficialListing,
} from "./marketplaceFromUrl.js"
import { getDomain, normalizeUrl } from "./urlUtils.js"
import { hasSerper } from "./env.js"
import { searchSerper } from "./serperClient.js"
import { getScanTarget, getScanTargetLabel } from "./scanTargets.js"
import { extractCopycatSearchPhrases, extractCoreBrandToken, type SearchTermContext } from "./searchTerms.js"
import {
  brandAliasesFromProfile,
  isJunkListingUrl,
  isLikelyOfficialBrandProduct,
  normalizeBrandNameForSearch,
} from "./candidateQuality.js"

export type SerperScanContext = SearchTermContext & {
  marketplaces: Marketplace[]
}

const SERPER_ECOMMERCE_MARKETPLACES = new Set<Marketplace>([
  "amazon",
  "walmart",
  "ebay",
  "etsy",
  "aliexpress",
  "shopify",
])

function buildSerperQueries(
  marketplace: Marketplace,
  brand: BrandProfile,
  keywords: string[],
  ipAssets?: IpAsset[],
) {
  const target = getScanTarget(marketplace)
  const context = { brand, keywords, ipAssets }
  const coreBrand = extractCoreBrandToken(brand, ipAssets)
  const brandTerms = [coreBrand, ...brandAliasesFromProfile(brand, ipAssets).slice(0, 2)]
    .map((term) => normalizeBrandNameForSearch(term))
    .filter(Boolean)
  const brandQuery = brandTerms.map((term) => `"${term}"`).join(" OR ")
  const excludeOfficial = buildExcludeOfficialSiteQuery(brand.websiteUrl)
  const brandAliases = brandAliasesFromProfile(brand, ipAssets)
  const copycatPhrases = extractCopycatSearchPhrases(context)
  const queries: string[] = []

  if (marketplace === "amazon") {
    const amazonExclusions = buildAmazonExcludeOfficialQuery(brandAliases)
    queries.push(`site:amazon.com (${brandQuery}) ${excludeOfficial} ${amazonExclusions}`.trim())
    for (const phrase of copycatPhrases.slice(0, 3)) {
      queries.push(`site:amazon.com "${phrase}" ${excludeOfficial} ${amazonExclusions}`.trim())
    }
  } else if (marketplace === "shopify") {
    queries.push(
      `(site:myshopify.com OR inurl:/products OR inurl:/collections) (${brandQuery}) ${excludeOfficial}`.trim(),
    )
    queries.push(`"${coreBrand}" "add to cart" (inurl:/products OR site:myshopify.com) ${excludeOfficial}`.trim())
    for (const phrase of copycatPhrases.slice(0, 3)) {
      queries.push(`"${phrase}" (inurl:/products OR site:myshopify.com) ${excludeOfficial}`.trim())
    }
  } else if (target?.siteQuery) {
    queries.push(`${target.siteQuery} (${brandQuery}) ${excludeOfficial}`.trim())
    for (const phrase of copycatPhrases.slice(0, 3)) {
      queries.push(`${target.siteQuery} "${phrase}" ${excludeOfficial}`.trim())
    }
  }

  return [...new Set(queries.filter(Boolean))].slice(0, 8)
}

function extractSellerFromUrl(url: string, marketplace: Marketplace) {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, "")
  } catch {
    return marketplace
  }
}

function serperResultToCandidate(
  marketplace: Marketplace,
  result: { title: string; link: string; snippet?: string },
  query: string,
  brandWebsiteUrl: string,
): ScanCandidate | null {
  const listingUrl = normalizeUrl(result.link)
  if (isJunkListingUrl(listingUrl)) return null

  const resolvedMarketplace = inferMarketplaceFromUrl(listingUrl)
  if (resolvedMarketplace !== marketplace) return null

  const label = getScanTargetLabel(marketplace)
  return {
    marketplace: resolvedMarketplace,
    sellerName: extractSellerFromUrl(listingUrl, marketplace),
    listingTitle: result.title,
    listingUrl,
    confidence: 0,
    matchReason: result.snippet
      ? `Serper matched ${label} listing: ${result.snippet}`
      : `Serper search hit on ${label} for "${query}".`,
    evidenceUrls: [brandWebsiteUrl, listingUrl],
    snippet: result.snippet,
  }
}

export async function scanSerper(context: SerperScanContext): Promise<ScanCandidate[]> {
  if (!hasSerper()) {
    console.warn("Serper not configured — skipping marketplace listing search.")
    return []
  }

  const brandDomain = getDomain(context.brand.websiteUrl)
  const brandAliases = brandAliasesFromProfile(context.brand, context.ipAssets)

  const seenFingerprints = new Set<string>()
  const rawCandidates: ScanCandidate[] = []

  for (const marketplace of context.marketplaces) {
    if (!SERPER_ECOMMERCE_MARKETPLACES.has(marketplace)) continue

    const queries = buildSerperQueries(
      marketplace,
      context.brand,
      context.keywords,
      context.ipAssets,
    )

    for (const query of queries) {
      try {
        const result = await searchSerper(query, 10)

        for (const row of result.organic) {
          const candidate = serperResultToCandidate(marketplace, row, query, context.brand.websiteUrl)
          if (!candidate) continue

          if (isLikelyOfficialBrandProduct(candidate, brandAliases)) continue

          if (
            isLikelyOfficialListing(
              {
                title: candidate.listingTitle,
                url: candidate.listingUrl,
                snippet: candidate.snippet,
              },
              context.brand.websiteUrl,
              brandAliases,
            )
          ) {
            continue
          }

          const domainName = getDomain(candidate.listingUrl)
          if (domainName === brandDomain) continue

          const fingerprint = listingFingerprint(candidate.listingUrl)
          if (seenFingerprints.has(fingerprint)) continue
          seenFingerprints.add(fingerprint)

          rawCandidates.push(candidate)
        }
      } catch (error) {
        console.error(`Serper search failed for "${query}":`, error)
      }
    }
  }

  return rawCandidates.slice(0, 40)
}
