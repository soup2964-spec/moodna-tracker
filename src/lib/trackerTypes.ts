export type Marketplace =
  | "amazon"
  | "walmart"
  | "ebay"
  | "etsy"
  | "aliexpress"
  | "shopify"
  | "reddit"
  | "telegram"
  | "twitter"
  | "discord"
  | "kemono"
  | "bunkr"
  | "simpcity"
  | "thothub"

export type ClaimType = "copyright" | "trademark" | "counterfeit"
export type ScanJobStatus = "queued" | "running" | "completed" | "failed"
export type ScanResultStatus = "new" | "reviewing" | "approved" | "rejected" | "takedown_requested" | "removed"
export type AlertStatus = "unread" | "read" | "actioned"
export type TakedownStatus = "draft" | "awaiting_owner_approval" | "approved" | "submitted" | "removed" | "rejected"

export type BrandProfile = {
  id: string
  organizationId: string
  websiteUrl: string
  brandName: string
  ownerName: string
  ownerEmail: string
  authorizedAgent: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type IpAsset = {
  id: string
  brandProfileId: string
  type: "website" | "logo" | "product_url" | "product_image" | "copyright_text" | "trademark"
  value: string
  sourceUrl?: string
  createdAt: string
}

export type ScanJob = {
  id: string
  brandProfileId: string
  marketplaces: Marketplace[]
  keywords: string[]
  status: ScanJobStatus
  frequency: "once" | "daily" | "weekly"
  riskThreshold: number
  createdAt: string
  completedAt?: string
}

export type ScanResult = {
  id: string
  scanJobId: string
  brandProfileId: string
  marketplace: Marketplace
  sellerName: string
  listingTitle: string
  listingUrl: string
  confidence: number
  matchReason: string
  status: ScanResultStatus
  evidenceUrls: string[]
  createdAt: string
}

export type Alert = {
  id: string
  scanResultId: string
  brandProfileId: string
  title: string
  message: string
  status: AlertStatus
  createdAt: string
}

export type TakedownRequest = {
  id: string
  scanResultId: string
  brandProfileId: string
  claimType: ClaimType
  status: TakedownStatus
  ownerAttestation: boolean
  dmcaStatement: string
  submittedTo?: Marketplace
  submittedAt?: string
  createdAt: string
}

export type DmcaSubmission = {
  id: string
  takedownRequestId: string
  marketplace: Marketplace
  submissionPayload: Record<string, unknown>
  responsePayload?: Record<string, unknown>
  externalCaseId?: string
  status: TakedownStatus
  createdAt: string
}

export type TrackerState = {
  brandProfiles: BrandProfile[]
  ipAssets: IpAsset[]
  scanJobs: ScanJob[]
  scanResults: ScanResult[]
  alerts: Alert[]
  takedownRequests: TakedownRequest[]
  dmcaSubmissions: DmcaSubmission[]
}

export type BrandIntakeInput = {
  websiteUrl: string
}

export type ScanSetupInput = {
  brandProfileId: string
  marketplaces: Marketplace[]
  keywords: string
  frequency: ScanJob["frequency"]
  riskThreshold: number
}
