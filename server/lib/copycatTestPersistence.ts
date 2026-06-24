import { isDuplicateResult } from "./dedupe.js"
import { createId, now } from "./ids.js"
import { inferMarketplaceFromUrl, isLikelyOfficialListing } from "./marketplaceFromUrl.js"
import { alertTitleForResult } from "./scanTargets.js"
import type { Alert, BrandProfile, IpAsset, Marketplace, ScanCandidate, ScanJob, ScanResult } from "./types.js"
import { getDomain, inferBrandName, normalizeUrl } from "./urlUtils.js"
import { getOrganizationId, loadTrackerState, persistBrandIntake, persistScanJob, persistScanResults } from "./store.js"
import { reviewScanCandidatesWithKie } from "./kieCandidateReview.js"

export type CopycatTestHit = {
  title: string
  url: string
  snippet?: string
  source: "marketplace" | "design_clone"
  marketplace?: string
}

type IntakeSnapshot = {
  brandName?: string
  pageTitle?: string
  metaDescription?: string
  colorPalette?: string[]
  productCopy?: string
  pageContent?: string
  imageUrls?: string[]
  copyrightSignals?: string[]
  trademarkCandidates?: string[]
}

function brandAliasesFromIntake(intake: IntakeSnapshot) {
  const aliases = new Set<string>()
  if (intake.brandName) aliases.add(intake.brandName)
  if (intake.pageTitle) aliases.add(intake.pageTitle)
  for (const candidate of intake.trademarkCandidates ?? []) aliases.add(candidate)
  return [...aliases]
}

function cleanBrandTitle(title: string) {
  return title
    .split("|")[0]
    ?.split(":")[0]
    ?.replace(/[\u2013\u2014-].*$/, "")
    .replace(/\s+/g, " ")
    .trim()
}

function inferMarketplaceForHit(hit: CopycatTestHit): Marketplace {
  if (hit.marketplace) {
    const normalized = hit.marketplace.toLowerCase() as Marketplace
    if (
      ["amazon", "walmart", "ebay", "etsy", "aliexpress", "shopify"].includes(normalized)
    ) {
      return normalized
    }
  }

  return inferMarketplaceFromUrl(hit.url) ?? "shopify"
}

function sellerFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "unknown seller"
  }
}

function hitToCandidate(hit: CopycatTestHit, brandWebsiteUrl: string): ScanCandidate {
  const marketplace = inferMarketplaceForHit(hit)
  return {
    marketplace,
    sellerName: sellerFromUrl(hit.url),
    listingTitle: hit.title,
    listingUrl: hit.url,
    confidence: 0,
    matchReason:
      hit.source === "design_clone"
        ? `Design clone search hit: ${hit.snippet || hit.title}`
        : `Marketplace search hit: ${hit.snippet || hit.title}`,
    evidenceUrls: [brandWebsiteUrl, hit.url],
    snippet: hit.snippet,
  }
}

function buildBrandProfile(websiteUrl: string, organizationId: string, intake: IntakeSnapshot) {
  const normalizedUrl = normalizeUrl(websiteUrl)
  const domain = getDomain(normalizedUrl)
  const timestamp = now()
  const brandName =
    cleanBrandTitle(intake.brandName ?? intake.pageTitle ?? "") || inferBrandName(normalizedUrl)

  const brandProfile: BrandProfile = {
    id: createId("brand"),
    organizationId,
    websiteUrl: normalizedUrl,
    brandName,
    ownerName: `${brandName} owner`,
    ownerEmail: `owner@${domain}`,
    authorizedAgent: "Moodna Enforcement Team",
    notes: "Created from KIE copycat test intake.",
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const ipAssets: IpAsset[] = [
    {
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "website",
      value: normalizedUrl,
      sourceUrl: normalizedUrl,
      createdAt: timestamp,
    },
    {
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "trademark",
      value: brandName,
      sourceUrl: normalizedUrl,
      createdAt: timestamp,
    },
    {
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "copyright_text",
      value: intake.copyrightSignals?.[0] ?? intake.metaDescription ?? domain,
      sourceUrl: normalizedUrl,
      createdAt: timestamp,
    },
  ]

  if (intake.pageContent?.trim()) {
    ipAssets.push({
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "page_content",
      value: intake.pageContent.slice(0, 8000),
      sourceUrl: normalizedUrl,
      createdAt: timestamp,
    })
  }

  if (intake.productCopy?.trim() && intake.productCopy !== intake.pageContent) {
    ipAssets.push({
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "product_description",
      value: intake.productCopy.slice(0, 4000),
      sourceUrl: normalizedUrl,
      createdAt: timestamp,
    })
  }

  if (intake.colorPalette?.length) {
    ipAssets.push({
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "design_palette",
      value: intake.colorPalette.join(","),
      sourceUrl: normalizedUrl,
      createdAt: timestamp,
    })
  }

  for (const imageUrl of (intake.imageUrls ?? []).slice(0, 6)) {
    ipAssets.push({
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "product_image",
      value: imageUrl,
      sourceUrl: normalizedUrl,
      createdAt: timestamp,
    })
  }

  return { brandProfile, ipAssets }
}

function appendHitsFromRows(
  rows: unknown[],
  hits: CopycatTestHit[],
  source: CopycatTestHit["source"],
  marketplace: string,
  brandWebsiteUrl: string,
  brandNames: string[],
) {
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const record = row as { title?: string; url?: string; snippet?: string }
    if (!record.title || !record.url) continue

    if (
      brandWebsiteUrl &&
      isLikelyOfficialListing(
        { title: record.title, url: record.url, snippet: record.snippet },
        brandWebsiteUrl,
        brandNames,
      )
    ) {
      continue
    }

    hits.push({
      title: record.title,
      url: record.url,
      snippet: record.snippet,
      source,
      marketplace,
    })
  }
}

export function collectHitsFromToolResult(
  toolName: string,
  result: Record<string, unknown>,
  hits: CopycatTestHit[],
  brandWebsiteUrl = "",
  brandNames: string[] = [],
) {
  if (
    toolName !== "search_marketplace_listings" &&
    toolName !== "search_design_clone_stores" &&
    toolName !== "search_publicwww_source"
  ) {
    return
  }

  const source = toolName === "search_design_clone_stores" ? "design_clone" : "marketplace"
  const marketplace =
    toolName === "search_marketplace_listings"
      ? String(result.marketplace ?? "")
      : toolName === "search_publicwww_source"
        ? ""
        : "shopify"

  if (Array.isArray(result.results)) {
    appendHitsFromRows(result.results, hits, source, marketplace, brandWebsiteUrl, brandNames)
  }

  for (const nestedKey of ["serper", "publicWww"] as const) {
    const nested = result[nestedKey]
    if (!nested || typeof nested !== "object") continue
    const nestedResults = (nested as { results?: unknown[] }).results
    if (Array.isArray(nestedResults)) {
      appendHitsFromRows(nestedResults, hits, source, marketplace || "shopify", brandWebsiteUrl, brandNames)
    }
  }
}

export async function persistCopycatTestToReviewQueue(input: {
  websiteUrl: string
  intake: IntakeSnapshot
  hits: CopycatTestHit[]
}) {
  const organizationId = await getOrganizationId()
  const { brandProfile, ipAssets } = buildBrandProfile(input.websiteUrl, organizationId, input.intake)
  await persistBrandIntake(brandProfile, ipAssets)

  const brandAliases = brandAliasesFromIntake(input.intake)
  const filteredHits = input.hits.filter(
    (hit) =>
      !isLikelyOfficialListing(
        { title: hit.title, url: hit.url, snippet: hit.snippet },
        input.websiteUrl,
        brandAliases.length > 0 ? brandAliases : [brandProfile.brandName],
      ),
  )

  const rawCandidates = filteredHits.map((hit) => hitToCandidate(hit, brandProfile.websiteUrl))
  const approvedCandidates = await reviewScanCandidatesWithKie(brandProfile, ipAssets, rawCandidates)

  const timestamp = now()
  const scanJobId = createId("scan")
  const marketplaces = [
    ...new Set(approvedCandidates.map((candidate) => candidate.marketplace)),
  ] as Marketplace[]

  const scanJob: ScanJob = {
    id: scanJobId,
    brandProfileId: brandProfile.id,
    runSlot: "manual",
    marketplaces: marketplaces.length > 0 ? marketplaces : ["shopify"],
    keywords: [brandProfile.brandName],
    status: "completed",
    frequency: "once",
    createdAt: timestamp,
    completedAt: timestamp,
  }

  await persistScanJob(scanJob)

  const state = await loadTrackerState()
  const results: ScanResult[] = []
  const alerts: Alert[] = []

  for (const candidate of approvedCandidates) {
    if (isDuplicateResult(state.scanResults, brandProfile.id, candidate.listingUrl)) continue

    const result: ScanResult = {
      id: createId("result"),
      scanJobId,
      brandProfileId: brandProfile.id,
      marketplace: candidate.marketplace,
      sellerName: candidate.sellerName,
      listingTitle: candidate.listingTitle,
      listingUrl: candidate.listingUrl,
      confidence: candidate.confidence,
      matchReason: candidate.matchReason,
      status: "reviewing",
      evidenceUrls: candidate.evidenceUrls,
      createdAt: timestamp,
    }

    results.push(result)
    alerts.push({
      id: createId("alert"),
      scanResultId: result.id,
      brandProfileId: brandProfile.id,
      title: alertTitleForResult(result.marketplace, brandProfile.brandName),
      message: `KIE flagged ${result.sellerName} (${result.confidence}% confidence) for ${brandProfile.brandName}.`,
      status: "unread",
      createdAt: timestamp,
    })
  }

  await persistScanResults(results, alerts)

  return {
    brandProfile,
    scanJob,
    results,
    resultCount: results.length,
  }
}
