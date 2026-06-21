import { useCallback, useMemo, useSyncExternalStore } from "react"
import {
  alertTitleForResult,
  buildSyntheticScanResult,
  getScanTargetLabel,
  inferCreatorHandle,
  isCreatorProfileUrl,
} from "./scanTargets"
import type {
  Alert,
  BrandIntakeInput,
  BrandProfile,
  DmcaSubmission,
  IpAsset,
  Marketplace,
  ScanJob,
  ScanResult,
  ScanSetupInput,
  TakedownRequest,
  TrackerState,
} from "./trackerTypes"

const STORAGE_KEY = "moodna-tracker-state-v1"
const organizationId = "demo-org"

function now() {
  return new Date().toISOString()
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

function marketplaceLabel(marketplace: Marketplace) {
  return getScanTargetLabel(marketplace)
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function getDomain(value: string) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./, "")
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
  }
}

function inferBrandName(value: string) {
  const domain = getDomain(value)
  const root = domain.split(".")[0] || "Brand"
  return root
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

const demoBrand: BrandProfile = {
  id: "brand_demo",
  organizationId,
  websiteUrl: "https://examplebrand.com",
  brandName: "Example Brand",
  ownerName: "Moodna Demo",
  ownerEmail: "owner@examplebrand.com",
  authorizedAgent: "Moodna Enforcement Team",
  notes: "Demo brand profile used until the first production intake is submitted.",
  createdAt: now(),
  updatedAt: now(),
}

const demoState: TrackerState = {
  brandProfiles: [demoBrand],
  ipAssets: [
    {
      id: "asset_demo_website",
      brandProfileId: demoBrand.id,
      type: "website",
      value: demoBrand.websiteUrl,
      sourceUrl: demoBrand.websiteUrl,
      createdAt: now(),
    },
    {
      id: "asset_demo_trademark",
      brandProfileId: demoBrand.id,
      type: "trademark",
      value: demoBrand.brandName,
      createdAt: now(),
    },
  ],
  scanJobs: [
    {
      id: "scan_demo",
      brandProfileId: demoBrand.id,
      marketplaces: ["amazon", "walmart", "ebay"],
      keywords: ["Example Brand", "Example Brand official"],
      status: "completed",
      frequency: "weekly",
      riskThreshold: 75,
      createdAt: now(),
      completedAt: now(),
    },
  ],
  scanResults: [
    {
      id: "result_demo_amazon",
      scanJobId: "scan_demo",
      brandProfileId: demoBrand.id,
      marketplace: "amazon",
      sellerName: "PrimeTrendz",
      listingTitle: "Example Brand premium bundle - unauthorized seller",
      listingUrl: "https://amazon.com/dp/demo",
      confidence: 92,
      matchReason: "Title, product image, and brand keyword match official assets.",
      status: "new",
      evidenceUrls: ["https://amazon.com/dp/demo"],
      createdAt: now(),
    },
    {
      id: "result_demo_ebay",
      scanJobId: "scan_demo",
      brandProfileId: demoBrand.id,
      marketplace: "ebay",
      sellerName: "knockoff-deals",
      listingTitle: "Example Brand alternative - same images",
      listingUrl: "https://ebay.com/itm/demo",
      confidence: 86,
      matchReason: "Listing reuses protected product images and confusing brand copy.",
      status: "reviewing",
      evidenceUrls: ["https://ebay.com/itm/demo"],
      createdAt: now(),
    },
  ],
  alerts: [
    {
      id: "alert_demo",
      scanResultId: "result_demo_amazon",
      brandProfileId: demoBrand.id,
      title: "High-confidence Amazon copycat",
      message: "PrimeTrendz is using official assets and matching product copy.",
      status: "unread",
      createdAt: now(),
    },
  ],
  takedownRequests: [],
  dmcaSubmissions: [],
}

let state = loadState()
const listeners = new Set<() => void>()

function loadState(): TrackerState {
  if (typeof window === "undefined") return demoState

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return demoState

  try {
    return { ...demoState, ...(JSON.parse(stored) as TrackerState) }
  } catch {
    return demoState
  }
}

function persist(nextState: TrackerState) {
  state = nextState
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

function createSyntheticResults(scanJob: ScanJob, brand: BrandProfile): ScanResult[] {
  return scanJob.marketplaces.map((marketplace, index) => ({
    id: createId("result"),
    scanJobId: scanJob.id,
    brandProfileId: brand.id,
    createdAt: now(),
    ...buildSyntheticScanResult(marketplace, brand, scanJob, index),
  }))
}

export function useTrackerStore() {
  const trackerState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const submitBrandIntake = useCallback((input: BrandIntakeInput) => {
    const timestamp = now()
    const websiteUrl = normalizeUrl(input.websiteUrl)
    const domain = getDomain(websiteUrl)
    const creatorProfile = isCreatorProfileUrl(websiteUrl)
    const creatorHandle = creatorProfile ? inferCreatorHandle(websiteUrl) : ""
    const brandName = creatorHandle || inferBrandName(websiteUrl)
    const brandProfile: BrandProfile = {
      id: createId("brand"),
      organizationId,
      websiteUrl,
      brandName,
      ownerName: `${brandName} owner`,
      ownerEmail: `owner@${domain}`,
      authorizedAgent: "Moodna Enforcement Team",
      notes: creatorProfile
        ? "Creator profile detected. Recommended scan targets include Telegram, Reddit, Kemono, Bunkr, and other piracy sources."
        : "IP assets were auto-discovered from the submitted website link.",
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const ipAssets: IpAsset[] = [
      {
        id: createId("asset"),
        brandProfileId: brandProfile.id,
        type: "website",
        value: websiteUrl,
        sourceUrl: websiteUrl,
        createdAt: timestamp,
      },
      {
        id: createId("asset"),
        brandProfileId: brandProfile.id,
        type: "logo",
        value: `${websiteUrl.replace(/\/$/, "")}/favicon.ico`,
        sourceUrl: websiteUrl,
        createdAt: timestamp,
      },
      {
        id: createId("asset"),
        brandProfileId: brandProfile.id,
        type: "product_url",
        value: `${websiteUrl.replace(/\/$/, "")}/products`,
        sourceUrl: websiteUrl,
        createdAt: timestamp,
      },
      ...["product-1", "product-2", "product-3"].map<IpAsset>((imageName) => ({
        id: createId("asset"),
        brandProfileId: brandProfile.id,
        type: "product_image",
        value: `${websiteUrl.replace(/\/$/, "")}/images/${imageName}.jpg`,
        sourceUrl: websiteUrl,
        createdAt: timestamp,
      })),
      {
        id: createId("asset"),
        brandProfileId: brandProfile.id,
        type: "trademark",
        value: brandName,
        sourceUrl: websiteUrl,
        createdAt: timestamp,
      },
      {
        id: createId("asset"),
        brandProfileId: brandProfile.id,
        type: "copyright_text",
        value: domain,
        sourceUrl: websiteUrl,
        createdAt: timestamp,
      },
    ]

    persist({
      ...state,
      brandProfiles: [brandProfile, ...state.brandProfiles],
      ipAssets: [...ipAssets, ...state.ipAssets],
    })

    return brandProfile
  }, [])

  const startScan = useCallback((input: ScanSetupInput) => {
    const brand = state.brandProfiles.find((profile) => profile.id === input.brandProfileId)
    if (!brand) return null

    const timestamp = now()
    const scanJob: ScanJob = {
      id: createId("scan"),
      brandProfileId: input.brandProfileId,
      marketplaces: input.marketplaces,
      keywords: input.keywords
        .split(/\n|,/)
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      status: "completed",
      frequency: input.frequency,
      riskThreshold: input.riskThreshold,
      createdAt: timestamp,
      completedAt: timestamp,
    }

    const results = createSyntheticResults(scanJob, brand)
    const alerts: Alert[] = results
      .filter((result) => result.confidence >= input.riskThreshold)
      .map((result) => ({
        id: createId("alert"),
        scanResultId: result.id,
        brandProfileId: brand.id,
        title: alertTitleForResult(result.marketplace, brand.brandName),
        message: `${result.sellerName} matched ${result.confidence}% against ${brand.brandName} on ${marketplaceLabel(result.marketplace)}.`,
        status: "unread",
        createdAt: timestamp,
      }))

    persist({
      ...state,
      scanJobs: [scanJob, ...state.scanJobs],
      scanResults: [...results, ...state.scanResults],
      alerts: [...alerts, ...state.alerts],
    })

    return scanJob
  }, [])

  const updateResultStatus = useCallback((resultId: string, status: ScanResult["status"]) => {
    persist({
      ...state,
      scanResults: state.scanResults.map((result) =>
        result.id === resultId ? { ...result, status } : result,
      ),
    })
  }, [])

  const createTakedownRequest = useCallback((resultId: string) => {
    const result = state.scanResults.find((item) => item.id === resultId)
    if (!result) return null

    const request: TakedownRequest = {
      id: createId("td"),
      scanResultId: result.id,
      brandProfileId: result.brandProfileId,
      claimType: "copyright",
      status: "awaiting_owner_approval",
      ownerAttestation: false,
      dmcaStatement:
        "I certify under penalty of perjury that I am the owner or authorized agent and that this use is unauthorized.",
      submittedTo: result.marketplace,
      createdAt: now(),
    }

    persist({
      ...state,
      scanResults: state.scanResults.map((item) =>
        item.id === resultId ? { ...item, status: "takedown_requested" } : item,
      ),
      takedownRequests: [request, ...state.takedownRequests],
    })

    return request
  }, [])

  const approveAndSubmitTakedown = useCallback((requestId: string) => {
    const request = state.takedownRequests.find((item) => item.id === requestId)
    if (!request) return

    const submission: DmcaSubmission = {
      id: createId("submission"),
      takedownRequestId: request.id,
      marketplace: request.submittedTo ?? "amazon",
      submissionPayload: {
        claimType: request.claimType,
        dmcaStatement: request.dmcaStatement,
        ownerAttestation: true,
      },
      externalCaseId: `MDN-${Date.now().toString(36).toUpperCase()}`,
      status: "submitted",
      createdAt: now(),
    }

    persist({
      ...state,
      takedownRequests: state.takedownRequests.map((request) =>
        request.id === requestId
          ? {
              ...request,
              status: "submitted",
              ownerAttestation: true,
              submittedAt: now(),
            }
          : request,
      ),
      dmcaSubmissions: [submission, ...state.dmcaSubmissions],
    })
  }, [])

  return useMemo(
    () => ({
      ...trackerState,
      submitBrandIntake,
      startScan,
      updateResultStatus,
      createTakedownRequest,
      approveAndSubmitTakedown,
    }),
    [
      trackerState,
      submitBrandIntake,
      startScan,
      updateResultStatus,
      createTakedownRequest,
      approveAndSubmitTakedown,
    ],
  )
}
