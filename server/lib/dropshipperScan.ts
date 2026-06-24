import type { BrandProfile, IpAsset, Marketplace, ScanCandidate } from "./types.js"
import { listingFingerprint } from "./dedupe.js"
import { isJunkListingUrl } from "./candidateQuality.js"
import { filterUnauthorizedCandidates } from "./authorizedRetailers.js"
import { isLikelyOfficialListing } from "./marketplaceFromUrl.js"
import { resolveMarketplaceFromUrl } from "./marketplaceFromUrl.js"
import { getDomain, normalizeUrl } from "./urlUtils.js"
import { hasKieAi, hasSerper } from "./env.js"
import { searchSerper } from "./serperClient.js"
import { getScanTargetLabel } from "./scanTargets.js"
import { isProductImageUrl } from "./productImageIntake.js"
import { buildGenericProfilesFromImages } from "./productVision.js"
import { brandAliasesFromProfile } from "./candidateQuality.js"
import { buildExcludeOfficialSiteQuery } from "./marketplaceFromUrl.js"

export type DropshipperScanContext = {
  brand: BrandProfile
  ipAssets?: IpAsset[]
  marketplaces: Marketplace[]
}

const DROPSHIPPER_MARKETPLACES = new Set<Marketplace>([
  "aliexpress",
  "amazon",
  "shopify",
  "web",
  "walmart",
  "ebay",
])

const MAX_PRODUCT_IMAGES = 3
const MAX_QUERIES_PER_PROFILE = 4
const MAX_TOTAL_CANDIDATES = 25

function collectProductImageUrls(ipAssets?: IpAsset[]) {
  const seen = new Set<string>()
  const urls: string[] = []

  for (const asset of ipAssets ?? []) {
    if (asset.type !== "product_image") continue
    if (!isProductImageUrl(asset.value)) continue
    const normalized = asset.value.trim()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    urls.push(normalized)
    if (urls.length >= MAX_PRODUCT_IMAGES) break
  }

  return urls
}

function buildDropshipperQueries(
  genericQuery: string,
  brand: BrandProfile,
  marketplace: Marketplace,
) {
  const excludeOfficial = buildExcludeOfficialSiteQuery(brand.websiteUrl)
  const brandToken = brand.brandName.replace(/[^a-z0-9]/gi, " ").trim()
  const noBrand = `-${brandToken.split(/\s+/).join(" -")}`.replace(/-\s*$/, "")

  if (marketplace === "aliexpress") {
    return [`site:aliexpress.com "${genericQuery}" ${noBrand}`.trim()]
  }
  if (marketplace === "amazon") {
    return [`site:amazon.com "${genericQuery}" ${noBrand} ${excludeOfficial}`.trim()]
  }
  if (marketplace === "shopify" || marketplace === "web") {
    return [
      `"${genericQuery}" (inurl:/products OR site:myshopify.com) ${noBrand} ${excludeOfficial}`.trim(),
    ]
  }

  const target = getScanTargetLabel(marketplace)
  if (target) {
    return [`"${genericQuery}" ${marketplace} ${noBrand}`.trim()]
  }

  return [`"${genericQuery}" ${noBrand}`.trim()]
}

function serperRowToCandidate(
  row: { title: string; link: string; snippet?: string },
  profile: { sourceImageUrl: string; genericDescription: string },
  brandWebsiteUrl: string,
): ScanCandidate | null {
  const listingUrl = normalizeUrl(row.link)
  if (isJunkListingUrl(listingUrl)) return null

  const marketplace = resolveMarketplaceFromUrl(listingUrl)
  const label = getScanTargetLabel(marketplace)

  return {
    marketplace,
    sellerName: getDomain(listingUrl),
    listingTitle: row.title,
    listingUrl,
    confidence: 0,
    matchReason: `Dropshipper search (de-branded vision): "${profile.genericDescription}" on ${label}.`,
    evidenceUrls: [profile.sourceImageUrl, listingUrl, brandWebsiteUrl],
    snippet: row.snippet,
    discoveryMethod: "dropshipper_search",
    sourceImageUrl: profile.sourceImageUrl,
  }
}

export async function scanDropshippers(context: DropshipperScanContext): Promise<ScanCandidate[]> {
  if (!hasSerper() || !hasKieAi()) {
    console.warn("Dropshipper scan requires SERPER_API_KEY and KIE_AI_API_KEY.")
    return []
  }

  const productImages = collectProductImageUrls(context.ipAssets)
  if (productImages.length === 0) return []

  const profiles = await buildGenericProfilesFromImages(productImages, MAX_PRODUCT_IMAGES)
  if (profiles.length === 0) return []

  let targetMarketplaces = context.marketplaces.filter((marketplace) =>
    DROPSHIPPER_MARKETPLACES.has(marketplace),
  )
  if (targetMarketplaces.length === 0) {
    targetMarketplaces = ["aliexpress", "amazon", "shopify"]
  }

  const brandDomain = getDomain(context.brand.websiteUrl)
  const brandAliases = brandAliasesFromProfile(context.brand, context.ipAssets)
  const seenFingerprints = new Set<string>()
  const rawCandidates: ScanCandidate[] = []

  for (const profile of profiles) {
    const queries = profile.searchQueries.slice(0, MAX_QUERIES_PER_PROFILE)

    for (const genericQuery of queries) {
      for (const marketplace of targetMarketplaces) {
        const builtQueries = buildDropshipperQueries(genericQuery, context.brand, marketplace)

        for (const query of builtQueries) {
          try {
            const result = await searchSerper(query, 8)

            for (const row of result.organic) {
              const candidate = serperRowToCandidate(row, profile, context.brand.websiteUrl)
              if (!candidate) continue

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
              if (rawCandidates.length >= MAX_TOTAL_CANDIDATES) {
                return filterUnauthorizedCandidates(rawCandidates, context.brand, context.ipAssets)
              }
            }
          } catch (error) {
            console.error(`Dropshipper Serper search failed for "${query}":`, error)
          }
        }
      }
    }
  }

  return filterUnauthorizedCandidates(rawCandidates, context.brand, context.ipAssets)
}
