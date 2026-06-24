import type { BrandProfile, IpAsset, Marketplace, ScanCandidate } from "./types.js"
import { listingFingerprint } from "./dedupe.js"
import {
  brandAliasesFromProfile,
  isJunkListingUrl,
  isLikelyOfficialBrandProduct,
} from "./candidateQuality.js"
import { isLikelyOfficialListing, resolveMarketplaceFromUrl } from "./marketplaceFromUrl.js"
import { getDomain, normalizeUrl } from "./urlUtils.js"
import { hasSerper } from "./env.js"
import { searchSerperLens } from "./serperClient.js"
import { getScanTargetLabel } from "./scanTargets.js"
import { isProductImageUrl } from "./productImageIntake.js"

export type ReverseImageScanContext = {
  brand: BrandProfile
  ipAssets?: IpAsset[]
}

const MAX_PRODUCT_IMAGES = 5
const MAX_RESULTS_PER_IMAGE = 10
const MAX_TOTAL_CANDIDATES = 50

const REVERSE_IMAGE_SKIP_HOSTS = [
  /^google\./i,
  /^gstatic\./i,
  /^googleusercontent\./i,
  /^lens\.google\./i,
]

function productImageLabel(imageUrl: string) {
  try {
    const pathname = new URL(imageUrl).pathname
    const filename = pathname.split("/").pop()?.replace(/\?.*$/, "") ?? "product image"
    return filename.replace(/\.(?:jpg|jpeg|png|webp|avif|gif)$/i, "").replace(/[-_]+/g, " ")
  } catch {
    return "product image"
  }
}

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

function extractSellerFromUrl(url: string, marketplace: Marketplace) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return marketplace
  }
}

function shouldSkipReverseImageUrl(url: string) {
  if (isJunkListingUrl(url)) return true

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "")
    if (REVERSE_IMAGE_SKIP_HOSTS.some((pattern) => pattern.test(hostname))) return true
  } catch {
    return true
  }

  return false
}

function lensResultToCandidate(
  result: { title: string; link: string; source?: string },
  sourceImageUrl: string,
  brandWebsiteUrl: string,
): ScanCandidate | null {
  const listingUrl = normalizeUrl(result.link)
  if (shouldSkipReverseImageUrl(listingUrl)) return null

  const marketplace = resolveMarketplaceFromUrl(listingUrl)
  const label = getScanTargetLabel(marketplace)
  const imageLabel = productImageLabel(sourceImageUrl)
  const snippet = result.source ? `Source: ${result.source}` : undefined

  return {
    marketplace,
    sellerName: extractSellerFromUrl(listingUrl, marketplace),
    listingTitle: result.title,
    listingUrl,
    confidence: 0,
    matchReason: `Reverse image match via Serper Lens (${imageLabel}) on ${label}.`,
    evidenceUrls: [sourceImageUrl, listingUrl, brandWebsiteUrl],
    snippet,
    discoveryMethod: "reverse_image",
    sourceImageUrl,
  }
}

export async function scanReverseImage(context: ReverseImageScanContext): Promise<ScanCandidate[]> {
  if (!hasSerper()) {
    console.warn("Serper not configured — skipping reverse image search.")
    return []
  }

  const productImages = collectProductImageUrls(context.ipAssets)
  if (productImages.length === 0) {
    console.warn("No product images in brand intake — skipping reverse image search.")
    return []
  }

  const brandDomain = getDomain(context.brand.websiteUrl)
  const brandAliases = brandAliasesFromProfile(context.brand, context.ipAssets)
  const seenFingerprints = new Set<string>()
  const rawCandidates: ScanCandidate[] = []

  for (const imageUrl of productImages) {
    try {
      const result = await searchSerperLens(imageUrl, { num: MAX_RESULTS_PER_IMAGE })

      for (const row of result.organic) {
        const candidate = lensResultToCandidate(row, imageUrl, context.brand.websiteUrl)
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
        if (rawCandidates.length >= MAX_TOTAL_CANDIDATES) {
          return rawCandidates
        }
      }
    } catch (error) {
      console.error(`Serper Lens failed for "${imageUrl}":`, error)
    }
  }

  return rawCandidates
}
