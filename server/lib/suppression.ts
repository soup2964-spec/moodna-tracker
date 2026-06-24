import { listingFingerprint, normalizeListingUrl } from "./dedupe.js"
import { createId, now } from "./ids.js"
import type {
  ScanResult,
  ScanResultStatus,
  SuppressedListing,
  SuppressionReason,
  TakedownRequest,
  TrackerState,
} from "./types.js"

const TERMINAL_SUPPRESS_STATUSES = new Set<ScanResultStatus>([
  "rejected",
  "takedown_requested",
  "removed",
])

export type ListingSuppressionCheck = {
  suppressed: boolean
  monitorForReturn: boolean
  reason?: SuppressionReason
  suppression?: SuppressedListing
}

function activeSuppression(entry: SuppressedListing) {
  return !entry.liftedAt
}

export function createSuppressedListing(input: {
  brandProfileId: string
  listingUrl: string
  listingTitle?: string
  sellerName?: string
  reason: SuppressionReason
  monitorForReturn: boolean
  sourceScanResultId?: string
  notes?: string
}): SuppressedListing {
  return {
    id: createId("suppress"),
    brandProfileId: input.brandProfileId,
    listingFingerprint: listingFingerprint(input.listingUrl),
    listingUrl: input.listingUrl,
    listingTitle: input.listingTitle,
    sellerName: input.sellerName,
    reason: input.reason,
    monitorForReturn: input.monitorForReturn,
    sourceScanResultId: input.sourceScanResultId,
    notes: input.notes,
    createdAt: now(),
  }
}

export function suppressionReasonForResult(
  result: ScanResult,
  takedownRequests: TakedownRequest[],
): { reason: SuppressionReason; monitorForReturn: boolean } | null {
  if (result.status === "rejected") {
    return { reason: "false_positive", monitorForReturn: false }
  }

  if (result.status === "removed") {
    return { reason: "resolved_removed", monitorForReturn: true }
  }

  if (result.status === "takedown_requested") {
    const request = takedownRequests.find((row) => row.scanResultId === result.id)
    if (request?.status === "submitted" || request?.status === "removed") {
      return { reason: "takedown_submitted", monitorForReturn: true }
    }
    return { reason: "takedown_pending", monitorForReturn: true }
  }

  return null
}

export function suppressionFromResult(
  result: ScanResult,
  takedownRequests: TakedownRequest[],
): SuppressedListing | null {
  const config = suppressionReasonForResult(result, takedownRequests)
  if (!config) return null

  return createSuppressedListing({
    brandProfileId: result.brandProfileId,
    listingUrl: result.listingUrl,
    listingTitle: result.listingTitle,
    sellerName: result.sellerName,
    reason: config.reason,
    monitorForReturn: config.monitorForReturn,
    sourceScanResultId: result.id,
  })
}

export function upsertSuppressionForResult(
  suppressions: SuppressedListing[],
  result: ScanResult,
  takedownRequests: TakedownRequest[],
) {
  const next = suppressionFromResult(result, takedownRequests)
  if (!next) return suppressions

  const fingerprint = next.listingFingerprint
  const withoutMatch = suppressions.filter(
    (entry) =>
      !(
        entry.brandProfileId === result.brandProfileId &&
        entry.listingFingerprint === fingerprint &&
        activeSuppression(entry)
      ),
  )

  return [next, ...withoutMatch]
}

export function backfillSuppressions(state: TrackerState): SuppressedListing[] {
  const suppressions = [...(state.suppressedListings ?? [])]
  const seen = new Set(
    suppressions
      .filter(activeSuppression)
      .map((entry) => `${entry.brandProfileId}:${entry.listingFingerprint}`),
  )

  for (const result of state.scanResults) {
    if (!TERMINAL_SUPPRESS_STATUSES.has(result.status)) continue

    const key = `${result.brandProfileId}:${listingFingerprint(result.listingUrl)}`
    if (seen.has(key)) continue

    const entry = suppressionFromResult(result, state.takedownRequests)
    if (!entry) continue

    suppressions.push(entry)
    seen.add(key)
  }

  return suppressions
}

export function checkListingSuppression(
  suppressions: SuppressedListing[],
  existingResults: ScanResult[],
  brandProfileId: string,
  listingUrl: string,
): ListingSuppressionCheck {
  const fingerprint = listingFingerprint(listingUrl)
  const normalized = normalizeListingUrl(listingUrl)

  const active = suppressions.filter(
    (entry) => entry.brandProfileId === brandProfileId && activeSuppression(entry),
  )

  const explicit = active.find((entry) => entry.listingFingerprint === fingerprint)
  if (explicit) {
    return {
      suppressed: true,
      monitorForReturn: explicit.monitorForReturn,
      reason: explicit.reason,
      suppression: explicit,
    }
  }

  const matchedResult = existingResults.find((result) => {
    if (result.brandProfileId !== brandProfileId) return false
    if (!TERMINAL_SUPPRESS_STATUSES.has(result.status)) return false
    return (
      listingFingerprint(result.listingUrl) === fingerprint ||
      normalizeListingUrl(result.listingUrl) === normalized
    )
  })

  if (!matchedResult) {
    return { suppressed: false, monitorForReturn: false }
  }

  const config = suppressionReasonForResult(matchedResult, [])
  return {
    suppressed: true,
    monitorForReturn: config?.monitorForReturn ?? false,
    reason: config?.reason,
  }
}

export function shouldSkipScanCandidate(
  suppressions: SuppressedListing[],
  existingResults: ScanResult[],
  brandProfileId: string,
  listingUrl: string,
) {
  const check = checkListingSuppression(suppressions, existingResults, brandProfileId, listingUrl)
  if (!check.suppressed) return { skip: false as const }
  if (check.monitorForReturn) return { skip: false as const, resurrect: true as const, check }
  return { skip: true as const, check }
}
