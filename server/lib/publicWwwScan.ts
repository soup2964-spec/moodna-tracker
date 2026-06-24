import type { BrandProfile, IpAsset, Marketplace, ScanCandidate } from "./types.js"
import { listingFingerprint } from "./dedupe.js"
import {
  inferMarketplaceFromUrl,
  isLikelyOfficialListing,
} from "./marketplaceFromUrl.js"
import { getDomain, normalizeUrl } from "./urlUtils.js"
import { hasPublicWww } from "./env.js"
import { searchPublicWww } from "./publicWwwClient.js"
import { getScanTarget } from "./scanTargets.js"
import {
  extractPublicWwwSnippets,
  extractCopycatSearchPhrases,
  quotePublicWwwPhrase,
  type SearchTermContext,
} from "./searchTerms.js"
import {
  brandAliasesFromProfile,
  isJunkListingUrl,
  isLikelyOfficialBrandProduct,
} from "./candidateQuality.js"

export type PublicWwwScanContext = SearchTermContext & {
  marketplaces: Marketplace[]
}

const MARKETPLACE_HOST_HINTS: Partial<Record<Marketplace, string>> = {
  amazon: "amazon.com",
  walmart: "walmart.com",
  ebay: "ebay.com",
  etsy: "etsy.com",
  aliexpress: "aliexpress.com",
  shopify: "myshopify.com",
  reddit: "reddit.com",
  telegram: "t.me",
  twitter: "twitter.com",
  discord: "discord.com",
  kemono: "kemono",
  bunkr: "bunkr",
  simpcity: "simpcity",
  thothub: "thothub",
}

function siteToUrl(site: string) {
  const trimmed = site.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return normalizeUrl(trimmed)
  return normalizeUrl(`https://${trimmed.replace(/^www\./, "")}`)
}

function matchesMarketplace(url: string, marketplace: Marketplace) {
  const inferred = inferMarketplaceFromUrl(url)
  if (inferred === marketplace) return true

  const hint = MARKETPLACE_HOST_HINTS[marketplace]
  if (!hint) return inferred === marketplace
  return url.toLowerCase().includes(hint.toLowerCase())
}

function buildQueriesForMarketplace(marketplace: Marketplace, snippets: string[]) {
  const target = getScanTarget(marketplace)
  const hostHint = MARKETPLACE_HOST_HINTS[marketplace]
  const queries: string[] = []

  for (const snippet of snippets) {
    const phrase = quotePublicWwwPhrase(snippet)
    if (hostHint) {
      queries.push(`${phrase} ${hostHint}`)
    } else if (target?.siteQuery) {
      queries.push(`${phrase} ${target.siteQuery.replace(/^site:/i, "")}`)
    } else {
      queries.push(phrase)
    }
  }

  if (marketplace === "shopify") {
    queries.push('"/cdn/shop/files/" ' + (snippets[0] ? quotePublicWwwPhrase(snippets[0]) : ""))
    queries.push('"cdn.shopify.com" ' + (snippets[0] ? quotePublicWwwPhrase(snippets[0]) : ""))
    queries.push('"Shopify.theme" ' + (snippets[0] ? quotePublicWwwPhrase(snippets[0]) : ""))
    if (snippets[0]) {
      queries.push(`${quotePublicWwwPhrase(snippets[0])} "/products/"`)
    }
    queries.push('"/products/" ' + (snippets[0] ? quotePublicWwwPhrase(snippets[0]) : ""))
    queries.push('"/collections/" ' + (snippets[0] ? quotePublicWwwPhrase(snippets[0]) : ""))
  }

  return [...new Set(queries.filter((query) => query.replace(/"/g, "").trim().length >= 4))].slice(0, 10)
}

function resultToCandidate(
  site: string,
  snippet: string | undefined,
  marketplace: Marketplace,
  query: string,
  brandWebsiteUrl: string,
): ScanCandidate | null {
  const listingUrl = siteToUrl(site)
  if (!listingUrl || isJunkListingUrl(listingUrl)) return null

  const resolvedMarketplace = inferMarketplaceFromUrl(listingUrl) ?? marketplace
  const label = getScanTarget(resolvedMarketplace)?.label ?? resolvedMarketplace

  return {
    marketplace: resolvedMarketplace,
    sellerName: getDomain(listingUrl),
    listingTitle: snippet?.slice(0, 120) || `${label} source match`,
    listingUrl,
    confidence: 0,
    matchReason: `PublicWWW matched HTML source for query ${query}.`,
    evidenceUrls: [brandWebsiteUrl, listingUrl],
    snippet,
  }
}

export async function scanPublicWww(context: PublicWwwScanContext): Promise<ScanCandidate[]> {
  if (!hasPublicWww()) {
    console.warn("PublicWWW not configured — skipping source-code copycat search.")
    return []
  }

  const snippets = [
    ...extractPublicWwwSnippets(context),
    ...extractCopycatSearchPhrases(context),
  ]
  const uniqueSnippets = [...new Set(snippets.map((s) => s.trim()).filter(Boolean))]
  if (uniqueSnippets.length === 0) {
    console.warn("No PublicWWW search snippets derived from brand assets.")
    return []
  }

  const brandDomain = getDomain(context.brand.websiteUrl)
  const brandAliases = brandAliasesFromProfile(context.brand, context.ipAssets)

  const seenFingerprints = new Set<string>()
  const rawCandidates: ScanCandidate[] = []

  for (const marketplace of context.marketplaces) {
    const queries = buildQueriesForMarketplace(marketplace, uniqueSnippets)

    for (const query of queries) {
      try {
        const results = await searchPublicWww(query, { snippets: true, maxResults: 50 })

        for (const result of results) {
          const listingUrl = siteToUrl(result.site)
          if (!listingUrl) continue
          if (!matchesMarketplace(listingUrl, marketplace)) continue

          const candidate = resultToCandidate(
            result.site,
            result.snippet,
            marketplace,
            query,
            context.brand.websiteUrl,
          )
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
        console.error(`PublicWWW search failed for "${query}":`, error)
      }
    }
  }

  return rawCandidates.slice(0, 40)
}
