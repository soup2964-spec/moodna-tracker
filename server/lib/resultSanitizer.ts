import type { TrackerState } from "./types.js"
import { dedupeScanResults } from "./dedupe.js"
import { backfillSuppressions } from "./suppression.js"
import { getDomain } from "./urlUtils.js"
import { isLikelyOfficialBrandProduct, brandAliasesFromProfile } from "./candidateQuality.js"

export function isPlaceholderResultUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return (
      hostname.endsWith(".example.com") ||
      hostname === "example.com" ||
      /\/demo(\/|$)/i.test(url) ||
      url.includes("example.com/suspected-")
    )
  } catch {
    return url.includes("example.com")
  }
}

const DEMO_BRAND_ID = "brand_demo"

function isLowQualityScanResult(
  state: TrackerState,
  result: TrackerState["scanResults"][number],
) {
  const brand = state.brandProfiles.find((profile) => profile.id === result.brandProfileId)
  if (!brand) return true

  const brandDomain = getDomain(brand.websiteUrl)
  if (getDomain(result.listingUrl) === brandDomain) return true

  const ipAssets = state.ipAssets.filter((asset) => asset.brandProfileId === brand.id)
  const aliases = brandAliasesFromProfile(brand, ipAssets)

  return isLikelyOfficialBrandProduct(
    {
      listingTitle: result.listingTitle,
      listingUrl: result.listingUrl,
      snippet: result.matchReason,
    },
    aliases,
  )
}

function mergeBrandsByWebsite(state: TrackerState): TrackerState {
  const sortedBrands = [...state.brandProfiles].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  const keptBrandByDomain = new Map<string, string>()
  const brandIdRemap = new Map<string, string>()

  for (const brand of sortedBrands) {
    const domain = getDomain(brand.websiteUrl)
    if (!keptBrandByDomain.has(domain)) {
      keptBrandByDomain.set(domain, brand.id)
    }
    brandIdRemap.set(brand.id, keptBrandByDomain.get(domain)!)
  }

  const keptBrandIds = new Set(keptBrandByDomain.values())
  const remapBrandId = (brandProfileId: string) => brandIdRemap.get(brandProfileId) ?? brandProfileId

  const brandProfiles = sortedBrands.filter((brand) => keptBrandIds.has(brand.id))
  const ipAssets = state.ipAssets
    .filter((asset) => keptBrandIds.has(remapBrandId(asset.brandProfileId)))
    .map((asset) => ({ ...asset, brandProfileId: remapBrandId(asset.brandProfileId) }))
  const scanSchedules = state.scanSchedules
    .filter((schedule) => keptBrandIds.has(remapBrandId(schedule.brandProfileId)))
    .map((schedule) => ({ ...schedule, brandProfileId: remapBrandId(schedule.brandProfileId) }))
  const scanJobs = state.scanJobs
    .filter((job) => keptBrandIds.has(remapBrandId(job.brandProfileId)))
    .map((job) => ({ ...job, brandProfileId: remapBrandId(job.brandProfileId) }))
  const scanResults = dedupeScanResults(
    state.scanResults
      .filter((result) => keptBrandIds.has(remapBrandId(result.brandProfileId)))
      .map((result) => ({ ...result, brandProfileId: remapBrandId(result.brandProfileId) }))
      .filter((result) => !isLowQualityScanResult(state, result)),
  )
  const keptResultIds = new Set(scanResults.map((result) => result.id))
  const alerts = state.alerts
    .filter(
      (alert) =>
        keptBrandIds.has(remapBrandId(alert.brandProfileId)) && keptResultIds.has(alert.scanResultId),
    )
    .map((alert) => ({ ...alert, brandProfileId: remapBrandId(alert.brandProfileId) }))
  const suppressedListings = (state.suppressedListings ?? [])
    .filter((entry) => keptBrandIds.has(remapBrandId(entry.brandProfileId)))
    .map((entry) => ({ ...entry, brandProfileId: remapBrandId(entry.brandProfileId) }))

  return {
    brandProfiles,
    ipAssets,
    scanSchedules,
    scanJobs,
    scanResults,
    alerts,
    takedownRequests: state.takedownRequests.filter((request) => keptResultIds.has(request.scanResultId)),
    dmcaSubmissions: state.dmcaSubmissions,
    suppressedListings,
  }
}

export function sanitizeTrackerState(state: TrackerState): TrackerState {
  const realBrands = state.brandProfiles.filter((brand) => brand.id !== DEMO_BRAND_ID)
  const hasRealBrands = realBrands.length > 0
  const allowedBrandIds = new Set(
    (hasRealBrands ? realBrands : state.brandProfiles).map((brand) => brand.id),
  )

  const filtered: TrackerState = {
    brandProfiles: hasRealBrands ? realBrands : state.brandProfiles,
    ipAssets: state.ipAssets.filter((asset) => allowedBrandIds.has(asset.brandProfileId)),
    scanSchedules: state.scanSchedules.filter((schedule) => allowedBrandIds.has(schedule.brandProfileId)),
    scanJobs: state.scanJobs.filter((job) => allowedBrandIds.has(job.brandProfileId)),
    scanResults: state.scanResults.filter(
      (result) =>
        allowedBrandIds.has(result.brandProfileId) &&
        !isPlaceholderResultUrl(result.listingUrl) &&
        !isLowQualityScanResult(state, result),
    ),
    alerts: state.alerts.filter((alert) => allowedBrandIds.has(alert.brandProfileId)),
    takedownRequests: state.takedownRequests,
    dmcaSubmissions: state.dmcaSubmissions,
    suppressedListings: state.suppressedListings ?? [],
  }

  const merged = mergeBrandsByWebsite(filtered)
  const keptResultIds = new Set(merged.scanResults.map((result) => result.id))

  return {
    ...merged,
    alerts: merged.alerts.filter((alert) => keptResultIds.has(alert.scanResultId)),
    takedownRequests: merged.takedownRequests.filter((request) => keptResultIds.has(request.scanResultId)),
    suppressedListings: backfillSuppressions({
      ...merged,
      suppressedListings: merged.suppressedListings ?? [],
    }),
  }
}

export function trackerStateChanged(before: TrackerState, after: TrackerState) {
  return JSON.stringify(before) !== JSON.stringify(after)
}
