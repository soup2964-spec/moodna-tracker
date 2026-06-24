import type { ClaimType, Marketplace } from "../types.js"

export type DmcaSubmissionMethod = "email" | "portal" | "manual"

export type DmcaChannel = {
  id: string
  label: string
  method: DmcaSubmissionMethod
  recipientEmail?: string
  portalUrl?: string
  notes?: string
}

export type DmcaNoticePackage = {
  subject: string
  body: string
  evidence: string[]
  channel: DmcaChannel
  marketplace: Marketplace
  listingUrl: string
  listingTitle: string
  sellerName: string
  claimType: ClaimType
  generatedAt: string
}

export type DmcaSubmitResult = {
  success: boolean
  method: DmcaSubmissionMethod
  externalCaseId?: string
  message: string
  responsePayload?: Record<string, unknown>
}
