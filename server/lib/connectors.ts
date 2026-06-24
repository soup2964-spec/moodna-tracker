import type { BrandProfile, IpAsset, Marketplace, ScanCandidate } from "./types.js"
import { listingFingerprint } from "./dedupe.js"
import {
  isJunkListingUrl,
} from "./candidateQuality.js"
import { scanPublicWww } from "./publicWwwScan.js"
import { scanDropshippers } from "./dropshipperScan.js"
import { scanReverseImage } from "./reverseImageScan.js"
import { filterUnauthorizedCandidates } from "./authorizedRetailers.js"
import { scanSerper } from "./serperScan.js"
import { isCreatorPiracyTarget, isEcommerceTarget, isCreatorProfileUrl } from "./scanTargets.js"

export type ConnectorContext = {
  brand: BrandProfile
  keywords: string[]
  ipAssets?: IpAsset[]
}

function dedupeCandidates(candidates: ScanCandidate[]) {
  const seen = new Set<string>()
  const deduped: ScanCandidate[] = []

  for (const candidate of candidates) {
    const fingerprint = listingFingerprint(candidate.listingUrl)
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    deduped.push(candidate)
  }

  deduped.sort((a, b) => a.listingTitle.localeCompare(b.listingTitle))
  return deduped
}

function filterObviousJunk(candidates: ScanCandidate[]) {
  return candidates.filter((candidate) => !isJunkListingUrl(candidate.listingUrl))
}

export async function scanMarketplace(
  marketplace: Marketplace,
  context: ConnectorContext,
): Promise<ScanCandidate[]> {
  if (isCreatorPiracyTarget(marketplace) && !isCreatorProfileUrl(context.brand.websiteUrl)) {
    return []
  }

  const candidates: ScanCandidate[] = []

  if (isEcommerceTarget(marketplace) && !isCreatorPiracyTarget(marketplace)) {
    candidates.push(
      ...(await scanSerper({
        ...context,
        marketplaces: [marketplace],
      })),
    )
  }

  candidates.push(
    ...(await scanPublicWww({
      ...context,
      marketplaces: [marketplace],
    })),
  )

  return filterObviousJunk(dedupeCandidates(candidates))
}

export async function scanCopycatStores(
  context: ConnectorContext,
  marketplaces: Marketplace[],
): Promise<ScanCandidate[]> {
  const [marketplaceResults, reverseImageResults, dropshipperResults] = await Promise.all([
    Promise.all(marketplaces.map((marketplace) => scanMarketplace(marketplace, context))),
    scanReverseImage({
      brand: context.brand,
      ipAssets: context.ipAssets,
    }),
    scanDropshippers({
      brand: context.brand,
      ipAssets: context.ipAssets,
      marketplaces,
    }),
  ])

  const candidates = [
    ...marketplaceResults.flat(),
    ...reverseImageResults,
    ...dropshipperResults,
  ]

  const filtered = filterUnauthorizedCandidates(
    filterObviousJunk(dedupeCandidates(candidates)),
    context.brand,
    context.ipAssets,
  )

  return filtered.slice(0, 90)
}

export { alertTitleForResult } from "./scanTargets.js"
