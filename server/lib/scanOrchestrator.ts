import { isDuplicateResult } from "./dedupe.js"
import { shouldSkipScanCandidate } from "./suppression.js"
import type { Alert, ScanJob, ScanResult } from "./types.js"
import { alertTitleForResult, scanCopycatStores } from "./connectors.js"
import { createId, now } from "./ids.js"
import { hasCopycatSearch, hasKieAi } from "./env.js"
import { reviewScanCandidatesWithKie } from "./kieCandidateReview.js"
import {
  loadTrackerState,
  persistScanJob,
  persistScanResults,
  updateScanJob,
} from "./store.js"

const runningJobs = new Set<string>()

export async function runScanJob(scanJobId: string) {
  if (runningJobs.has(scanJobId)) return
  runningJobs.add(scanJobId)

  try {
    const state = await loadTrackerState()
    const scanJob = state.scanJobs.find((job) => job.id === scanJobId)
    const brand = state.brandProfiles.find((profile) => profile.id === scanJob?.brandProfileId)

    if (!scanJob || !brand) {
      runningJobs.delete(scanJobId)
      return
    }

    const runningJob: ScanJob = { ...scanJob, status: "running" }
    await updateScanJob(runningJob)

    const results: ScanResult[] = []
    const alerts: Alert[] = []
    const timestamp = now()

    const brandAssets = state.ipAssets.filter((asset) => asset.brandProfileId === brand.id)
    const knownResults = [...state.scanResults]
    const suppressions = state.suppressedListings ?? []

    let scanError: string | undefined

    try {
      if (!hasKieAi()) {
        throw new Error("KIE_AI_API_KEY is required to review scan results before they enter the review queue.")
      }

      const rawCandidates = await scanCopycatStores(
        {
          brand,
          keywords: scanJob.keywords,
          ipAssets: brandAssets,
        },
        scanJob.marketplaces,
      )

      const approvedCandidates = await reviewScanCandidatesWithKie(brand, brandAssets, rawCandidates)

      for (const candidate of approvedCandidates) {
        const skipCheck = shouldSkipScanCandidate(
          suppressions,
          knownResults,
          brand.id,
          candidate.listingUrl,
        )
        if (skipCheck.skip) continue
        if (
          !skipCheck.resurrect &&
          isDuplicateResult(knownResults, brand.id, candidate.listingUrl, suppressions)
        ) {
          continue
        }

        const resurrected = skipCheck.resurrect === true
        const result: ScanResult = {
          id: createId("result"),
          scanJobId: scanJob.id,
          brandProfileId: brand.id,
          marketplace: candidate.marketplace,
          sellerName: candidate.sellerName,
          listingTitle: candidate.listingTitle,
          listingUrl: candidate.listingUrl,
          confidence: candidate.confidence,
          matchReason: resurrected
            ? `Reappeared after prior takedown/action: ${candidate.matchReason}`
            : candidate.matchReason,
          status: resurrected ? "reappeared" : "reviewing",
          evidenceUrls: candidate.evidenceUrls,
          createdAt: timestamp,
        }

        results.push(result)
        knownResults.push(result)
        alerts.push({
          id: createId("alert"),
          scanResultId: result.id,
          brandProfileId: brand.id,
          title: resurrected
            ? `Reappeared listing — ${alertTitleForResult(result.marketplace, brand.brandName)}`
            : alertTitleForResult(result.marketplace, brand.brandName),
          message: resurrected
            ? `${result.sellerName} listing came back after a prior takedown or removal (${result.confidence}% confidence).`
            : `KIE flagged ${result.sellerName} (${result.confidence}% confidence) as a potential ${brand.brandName} copycat.`,
          status: "unread",
          createdAt: timestamp,
        })
      }

      if (results.length === 0 && rawCandidates.length > 0) {
        scanError = `Searched ${rawCandidates.length} hit(s) with brand signals; KIE found no confirmed infringers.`
      } else if (results.length === 0) {
        scanError = "No relevant search hits found. Re-run brand intake from your homepage so product names and images are captured."
      }
    } catch (error) {
      console.error("Copycat scan failed:", error)
      scanError = error instanceof Error ? error.message : "Scan failed"
    }

    await persistScanResults(results, alerts)

    const completedJob: ScanJob = {
      ...runningJob,
      status:
        scanError &&
        (scanError.includes("required") ||
          scanError === "Scan failed" ||
          scanError.includes("JSON") ||
          scanError.includes("KIE"))
          ? "failed"
          : "completed",
      completedAt: now(),
      errorMessage:
        scanError ??
        (results.length === 0 && !hasCopycatSearch()
          ? "No results returned. Add PUBLICWWW_API_KEY and/or SERPER_API_KEY to search for copycats."
          : undefined),
    }
    await updateScanJob(completedJob)
  } catch (error) {
    const state = await loadTrackerState()
    const scanJob = state.scanJobs.find((job) => job.id === scanJobId)
    if (scanJob) {
      await updateScanJob({
        ...scanJob,
        status: "failed",
        completedAt: now(),
        errorMessage: error instanceof Error ? error.message : "Scan failed",
      })
    }
  } finally {
    runningJobs.delete(scanJobId)
  }
}

export async function queueScanJob(scanJob: ScanJob) {
  await persistScanJob(scanJob)
  void runScanJob(scanJob.id)
  return scanJob
}

export async function getScanJobStatus(scanJobId: string) {
  const state = await loadTrackerState()
  return state.scanJobs.find((job) => job.id === scanJobId) ?? null
}
