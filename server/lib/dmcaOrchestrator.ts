import type { ClaimType, DmcaSubmission, TakedownRequest, TrackerState } from "./types.js"
import { buildDmcaNoticePackage } from "./dmca/generateNotice.js"
import { submitDmcaNotice } from "./dmca/submitNotice.js"
import type { DmcaNoticePackage } from "./dmca/types.js"
import { now } from "./ids.js"
import {
  createSubmissionId,
  createTakedownId,
  loadTrackerState,
  persistTakedownRequest,
  persistTakedownSubmission,
} from "./store.js"

export type PrepareDmcaResult = {
  request: TakedownRequest
  notice: DmcaNoticePackage
}

export type SubmitDmcaResult = {
  request: TakedownRequest
  submission: DmcaSubmission
  notice: DmcaNoticePackage
  submitResult: Awaited<ReturnType<typeof submitDmcaNotice>>
}

function findTakedownContext(state: TrackerState, requestId: string) {
  const request = state.takedownRequests.find((row) => row.id === requestId)
  if (!request) return null

  const result = state.scanResults.find((row) => row.id === request.scanResultId)
  const brand = state.brandProfiles.find((row) => row.id === request.brandProfileId)
  const ipAssets = state.ipAssets.filter((asset) => asset.brandProfileId === request.brandProfileId)

  if (!result || !brand) return null
  return { request, result, brand, ipAssets }
}

export async function prepareDmcaRequest(
  requestId: string,
  claimType?: ClaimType,
): Promise<PrepareDmcaResult> {
  const state = await loadTrackerState()
  const context = findTakedownContext(state, requestId)
  if (!context) throw new Error("Takedown request not found")

  const resolvedClaimType = claimType ?? context.request.claimType
  const notice = buildDmcaNoticePackage({
    brand: context.brand,
    result: context.result,
    ipAssets: context.ipAssets,
    claimType: resolvedClaimType,
    marketplace: context.request.submittedTo ?? context.result.marketplace,
  })

  const updatedRequest: TakedownRequest = {
    ...context.request,
    claimType: resolvedClaimType,
    status: "approved",
    dmcaStatement: notice.body,
    submittedTo: notice.marketplace,
  }

  await persistTakedownRequest(updatedRequest, context.result.id)
  return { request: updatedRequest, notice }
}

export async function submitPreparedDmca(requestId: string): Promise<SubmitDmcaResult> {
  const state = await loadTrackerState()
  const context = findTakedownContext(state, requestId)
  if (!context) throw new Error("Takedown request not found")

  const notice = buildDmcaNoticePackage({
    brand: context.brand,
    result: context.result,
    ipAssets: context.ipAssets,
    claimType: context.request.claimType,
    marketplace: context.request.submittedTo ?? context.result.marketplace,
  })

  const submitResult = await submitDmcaNotice(notice)

  const submittedRequest: TakedownRequest = {
    ...context.request,
    status: submitResult.success ? "submitted" : "awaiting_owner_approval",
    ownerAttestation: true,
    dmcaStatement: notice.body,
    submittedTo: notice.marketplace,
    submittedAt: submitResult.success ? now() : context.request.submittedAt,
  }

  const submission: DmcaSubmission = {
    id: createSubmissionId(),
    takedownRequestId: context.request.id,
    marketplace: notice.marketplace,
    submissionPayload: {
      claimType: notice.claimType,
      channel: notice.channel,
      subject: notice.subject,
      body: notice.body,
      evidence: notice.evidence,
      method: submitResult.method,
      generatedAt: notice.generatedAt,
    },
    responsePayload: submitResult.responsePayload,
    externalCaseId: submitResult.externalCaseId,
    status: submitResult.success ? "submitted" : "awaiting_owner_approval",
    createdAt: now(),
  }

  await persistTakedownSubmission(submittedRequest, submission)

  if (!submitResult.success) {
    throw new Error(submitResult.message)
  }

  return { request: submittedRequest, submission, notice, submitResult }
}

export async function createAndPrepareDmca(
  resultId: string,
  claimType: ClaimType = "copyright",
): Promise<PrepareDmcaResult> {
  const state = await loadTrackerState()
  const result = state.scanResults.find((row) => row.id === resultId)
  if (!result) throw new Error("Scan result not found")

  const existing = state.takedownRequests.find((row) => row.scanResultId === resultId)
  if (existing) {
    return prepareDmcaRequest(existing.id, claimType)
  }

  const request: TakedownRequest = {
    id: createTakedownId(),
    scanResultId: result.id,
    brandProfileId: result.brandProfileId,
    claimType,
    status: "awaiting_owner_approval",
    ownerAttestation: false,
    dmcaStatement: "",
    submittedTo: result.marketplace,
    createdAt: now(),
  }

  await persistTakedownRequest(request, result.id)
  return prepareDmcaRequest(request.id, claimType)
}
