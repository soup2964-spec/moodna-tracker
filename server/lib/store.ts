import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { env, hasSupabase } from "./env.js"
import { dedupeScanResults } from "./dedupe.js"
import { sanitizeTrackerState, trackerStateChanged } from "./resultSanitizer.js"
import { createId, now } from "./ids.js"
import { getDomain } from "./urlUtils.js"
import type {
  Alert,
  BrandProfile,
  DmcaSubmission,
  IpAsset,
  ScanJob,
  ScanResult,
  ScanResultStatus,
  ScanRunSlot,
  ScanSchedule,
  SuppressedListing,
  TakedownRequest,
  TrackerState,
} from "./types.js"
import { upsertSuppressionForResult } from "./suppression.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, "..", "data")
const DATA_FILE = path.join(DATA_DIR, "tracker-state.json")
const DEFAULT_ORG_ID = "00000000-0000-4000-8000-000000000001"

function emptyState(): TrackerState {
  return {
    brandProfiles: [],
    ipAssets: [],
    scanSchedules: [],
    scanJobs: [],
    scanResults: [],
    alerts: [],
    takedownRequests: [],
    dmcaSubmissions: [],
    suppressedListings: [],
  }
}

function demoState(): TrackerState {
  const timestamp = now()
  const brand: BrandProfile = {
    id: "brand_demo",
    organizationId: DEFAULT_ORG_ID,
    websiteUrl: "https://examplebrand.com",
    brandName: "Example Brand",
    ownerName: "Moodna Demo",
    ownerEmail: "owner@examplebrand.com",
    authorizedAgent: "Moodna Enforcement Team",
    notes: "Demo brand profile used until the first production intake is submitted.",
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  return {
    brandProfiles: [brand],
    ipAssets: [
      {
        id: "asset_demo_website",
        brandProfileId: brand.id,
        type: "website",
        value: brand.websiteUrl,
        sourceUrl: brand.websiteUrl,
        createdAt: timestamp,
      },
    ],
    scanSchedules: [],
    scanJobs: [],
    scanResults: [],
    alerts: [],
    takedownRequests: [],
    dmcaSubmissions: [],
    suppressedListings: [],
  }
}

let supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin() {
  if (!hasSupabase()) return null
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return supabaseAdmin
}

async function ensureOrganizationId() {
  if (env.organizationId) return env.organizationId

  const supabase = getSupabaseAdmin()
  if (!supabase) return DEFAULT_ORG_ID

  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", "Moodna Default")
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data: created, error } = await supabase
    .from("organizations")
    .insert({ name: "Moodna Default" })
    .select("id")
    .single()

  if (error || !created) return DEFAULT_ORG_ID
  return created.id
}

async function readFileState(): Promise<TrackerState> {
  try {
    const raw = await readFile(DATA_FILE, "utf8")
    const parsed = JSON.parse(raw) as Partial<TrackerState>
    const merged: TrackerState = {
      ...emptyState(),
      ...parsed,
      scanSchedules: parsed.scanSchedules ?? [],
    }
    const sanitized = sanitizeTrackerState(merged)
    if (trackerStateChanged(merged, sanitized)) {
      await writeFileState(sanitized)
    }
    return sanitized
  } catch {
    return demoState()
  }
}

async function writeFileState(state: TrackerState) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(DATA_FILE, JSON.stringify(state, null, 2), "utf8")
}

let fileWriteChain: Promise<unknown> = Promise.resolve()

async function mutateFileState(mutator: (state: TrackerState) => TrackerState | Promise<TrackerState>) {
  const run = async () => {
    const state = await readFileState()
    const next = await mutator(state)
    await writeFileState(next)
    return next
  }

  const result = fileWriteChain.then(run, run)
  fileWriteChain = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

function mapBrandRow(row: Record<string, unknown>): BrandProfile {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    websiteUrl: row.website_url as string,
    brandName: row.brand_name as string,
    ownerName: row.owner_name as string,
    ownerEmail: row.owner_email as string,
    authorizedAgent: row.authorized_agent as string,
    notes: (row.notes as string) ?? "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapIpAssetRow(row: Record<string, unknown>): IpAsset {
  return {
    id: row.id as string,
    brandProfileId: row.brand_profile_id as string,
    type: row.type as IpAsset["type"],
    value: row.value as string,
    sourceUrl: (row.source_url as string) ?? undefined,
    createdAt: row.created_at as string,
  }
}

function mapScanScheduleRow(row: Record<string, unknown>): ScanSchedule {
  return {
    id: row.id as string,
    brandProfileId: row.brand_profile_id as string,
    enabled: row.enabled as boolean,
    frequency: row.frequency as ScanSchedule["frequency"],
    amMarketplaces: (row.am_marketplaces as ScanSchedule["amMarketplaces"]) ?? [],
    pmMarketplaces: (row.pm_marketplaces as ScanSchedule["pmMarketplaces"]) ?? [],
    keywords: (row.keywords as string[]) ?? [],
    timezone: row.timezone as string,
    amRunAt: String(row.am_run_at ?? "09:00:00").slice(0, 5),
    pmRunAt: String(row.pm_run_at ?? "21:00:00").slice(0, 5),
    staggerMinutes: row.stagger_minutes as number,
    lastAmRunAt: (row.last_am_run_at as string) ?? undefined,
    lastPmRunAt: (row.last_pm_run_at as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapScanJobRow(row: Record<string, unknown>): ScanJob {
  return {
    id: row.id as string,
    brandProfileId: row.brand_profile_id as string,
    scheduleId: (row.schedule_id as string) ?? undefined,
    runSlot: (row.run_slot as ScanJob["runSlot"]) ?? undefined,
    marketplaces: row.marketplaces as ScanJob["marketplaces"],
    keywords: row.keywords as string[],
    status: row.status as ScanJob["status"],
    frequency: row.frequency as ScanJob["frequency"],
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string) ?? undefined,
    errorMessage: (row.error_message as string) ?? undefined,
  }
}

function mapScanResultRow(row: Record<string, unknown>): ScanResult {
  return {
    id: row.id as string,
    scanJobId: row.scan_job_id as string,
    brandProfileId: row.brand_profile_id as string,
    marketplace: row.marketplace as ScanResult["marketplace"],
    sellerName: row.seller_name as string,
    listingTitle: row.listing_title as string,
    listingUrl: row.listing_url as string,
    confidence: row.confidence as number,
    matchReason: row.match_reason as string,
    status: row.status as ScanResult["status"],
    evidenceUrls: (row.evidence_urls as string[]) ?? [],
    createdAt: row.created_at as string,
  }
}

function mapAlertRow(row: Record<string, unknown>): Alert {
  return {
    id: row.id as string,
    scanResultId: row.scan_result_id as string,
    brandProfileId: row.brand_profile_id as string,
    title: row.title as string,
    message: row.message as string,
    status: row.status as Alert["status"],
    createdAt: row.created_at as string,
  }
}

function mapTakedownRow(row: Record<string, unknown>): TakedownRequest {
  return {
    id: row.id as string,
    scanResultId: row.scan_result_id as string,
    brandProfileId: row.brand_profile_id as string,
    claimType: row.claim_type as TakedownRequest["claimType"],
    status: row.status as TakedownRequest["status"],
    ownerAttestation: row.owner_attestation as boolean,
    dmcaStatement: row.dmca_statement as string,
    submittedTo: (row.submitted_to as TakedownRequest["submittedTo"]) ?? undefined,
    submittedAt: (row.submitted_at as string) ?? undefined,
    createdAt: row.created_at as string,
  }
}

function mapSubmissionRow(row: Record<string, unknown>): DmcaSubmission {
  return {
    id: row.id as string,
    takedownRequestId: row.takedown_request_id as string,
    marketplace: row.marketplace as DmcaSubmission["marketplace"],
    submissionPayload: (row.submission_payload as Record<string, unknown>) ?? {},
    responsePayload: (row.response_payload as Record<string, unknown>) ?? undefined,
    externalCaseId: (row.external_case_id as string) ?? undefined,
    status: row.status as DmcaSubmission["status"],
    createdAt: row.created_at as string,
  }
}

async function readSupabaseState(): Promise<TrackerState> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return readFileState()

  const orgId = await ensureOrganizationId()
  const { data: brands } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  if (!brands || brands.length === 0) return emptyState()

  const brandIds = brands.map((brand) => brand.id)
  const [assets, schedules, jobs, results, alerts, takedowns, submissions] = await Promise.all([
    supabase.from("ip_assets").select("*").in("brand_profile_id", brandIds),
    supabase.from("scan_schedules").select("*").in("brand_profile_id", brandIds),
    supabase.from("scan_jobs").select("*").in("brand_profile_id", brandIds).order("created_at", { ascending: false }),
    supabase.from("scan_results").select("*").in("brand_profile_id", brandIds).order("created_at", { ascending: false }),
    supabase.from("alerts").select("*").in("brand_profile_id", brandIds).order("created_at", { ascending: false }),
    supabase.from("takedown_requests").select("*").in("brand_profile_id", brandIds).order("created_at", { ascending: false }),
    supabase
      .from("dmca_submissions")
      .select("*")
      .in(
        "takedown_request_id",
        (
          await supabase.from("takedown_requests").select("id").in("brand_profile_id", brandIds)
        ).data?.map((row) => row.id) ?? [],
      ),
  ])

  return {
    brandProfiles: brands.map(mapBrandRow),
    ipAssets: (assets.data ?? []).map(mapIpAssetRow),
    scanSchedules: (schedules.data ?? []).map(mapScanScheduleRow),
    scanJobs: (jobs.data ?? []).map(mapScanJobRow),
    scanResults: (results.data ?? []).map(mapScanResultRow),
    alerts: (alerts.data ?? []).map(mapAlertRow),
    takedownRequests: (takedowns.data ?? []).map(mapTakedownRow),
    dmcaSubmissions: (submissions.data ?? []).map(mapSubmissionRow),
    suppressedListings: [],
  }
}

export async function loadTrackerState(): Promise<TrackerState> {
  if (hasSupabase()) return readSupabaseState()
  return readFileState()
}

export async function saveTrackerState(state: TrackerState) {
  if (hasSupabase()) return
  await writeFileState(state)
}

export async function getOrganizationId() {
  return ensureOrganizationId()
}

export async function persistBrandIntake(brandProfile: BrandProfile, ipAssets: IpAsset[]) {
  const supabase = getSupabaseAdmin()
  const intakeDomain = getDomain(brandProfile.websiteUrl)

  if (!supabase) {
    await mutateFileState((state) => {
      const replacedBrandIds = new Set(
        state.brandProfiles
          .filter(
            (row) => getDomain(row.websiteUrl) === intakeDomain && row.id !== brandProfile.id,
          )
          .map((row) => row.id),
      )

      const remapBrandId = (brandProfileId: string) =>
        replacedBrandIds.has(brandProfileId) ? brandProfile.id : brandProfileId

      return {
        ...state,
        brandProfiles: [
          brandProfile,
          ...state.brandProfiles.filter(
            (row) => row.id !== brandProfile.id && !replacedBrandIds.has(row.id),
          ),
        ],
        ipAssets: [
          ...ipAssets,
          ...state.ipAssets
            .filter((asset) => !replacedBrandIds.has(asset.brandProfileId))
            .filter((asset) => asset.brandProfileId !== brandProfile.id),
        ],
        scanSchedules: state.scanSchedules.map((schedule) => ({
          ...schedule,
          brandProfileId: remapBrandId(schedule.brandProfileId),
        })),
        scanJobs: state.scanJobs.map((job) => ({
          ...job,
          brandProfileId: remapBrandId(job.brandProfileId),
        })),
        scanResults: dedupeScanResults(
          state.scanResults.map((result) => ({
            ...result,
            brandProfileId: remapBrandId(result.brandProfileId),
          })),
        ),
        alerts: state.alerts.map((alert) => ({
          ...alert,
          brandProfileId: remapBrandId(alert.brandProfileId),
        })),
      }
    })
    return
  }

  const orgId = await ensureOrganizationId()
  const payload = {
    id: brandProfile.id,
    organization_id: orgId,
    website_url: brandProfile.websiteUrl,
    brand_name: brandProfile.brandName,
    owner_name: brandProfile.ownerName,
    owner_email: brandProfile.ownerEmail,
    authorized_agent: brandProfile.authorizedAgent,
    notes: brandProfile.notes,
    created_at: brandProfile.createdAt,
    updated_at: brandProfile.updatedAt,
  }

  await supabase.from("brand_profiles").upsert(payload)
  if (ipAssets.length > 0) {
    await supabase.from("ip_assets").upsert(
      ipAssets.map((asset) => ({
        id: asset.id,
        brand_profile_id: asset.brandProfileId,
        type: asset.type,
        value: asset.value,
        source_url: asset.sourceUrl ?? null,
        created_at: asset.createdAt,
      })),
    )
  }
}

export async function persistScanJob(scanJob: ScanJob) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    await mutateFileState((state) => ({
      ...state,
      scanJobs: [scanJob, ...state.scanJobs.filter((row) => row.id !== scanJob.id)],
    }))
    return
  }

  await supabase.from("scan_jobs").upsert({
    id: scanJob.id,
    brand_profile_id: scanJob.brandProfileId,
    schedule_id: scanJob.scheduleId ?? null,
    run_slot: scanJob.runSlot ?? null,
    marketplaces: scanJob.marketplaces,
    keywords: scanJob.keywords,
    status: scanJob.status,
    frequency: scanJob.frequency,
    risk_threshold: 0,
    created_at: scanJob.createdAt,
    completed_at: scanJob.completedAt ?? null,
    error_message: scanJob.errorMessage ?? null,
  })
}

export async function persistScanResults(results: ScanResult[], alerts: Alert[]) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    await mutateFileState((state) => {
      const mergedResults = dedupeScanResults([...results, ...state.scanResults])
      const keptIds = new Set(results.map((result) => result.id))
      const mergedAlerts = [
        ...alerts,
        ...state.alerts.filter((alert) => !keptIds.has(alert.scanResultId)),
      ]

      return {
        ...state,
        scanResults: mergedResults,
        alerts: mergedAlerts,
      }
    })
    return
  }

  if (results.length > 0) {
    await supabase.from("scan_results").upsert(
      results.map((result) => ({
        id: result.id,
        scan_job_id: result.scanJobId,
        brand_profile_id: result.brandProfileId,
        marketplace: result.marketplace,
        seller_name: result.sellerName,
        listing_title: result.listingTitle,
        listing_url: result.listingUrl,
        confidence: result.confidence,
        match_reason: result.matchReason,
        status: result.status,
        evidence_urls: result.evidenceUrls,
        created_at: result.createdAt,
      })),
    )
  }

  if (alerts.length > 0) {
    await supabase.from("alerts").upsert(
      alerts.map((alert) => ({
        id: alert.id,
        scan_result_id: alert.scanResultId,
        brand_profile_id: alert.brandProfileId,
        title: alert.title,
        message: alert.message,
        status: alert.status,
        created_at: alert.createdAt,
      })),
    )
  }
}

export async function updateScanJob(scanJob: ScanJob) {
  await persistScanJob(scanJob)
}

export async function updateScanResultStatus(resultId: string, status: ScanResultStatus) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    await mutateFileState((state) => {
      const result = state.scanResults.find((row) => row.id === resultId)
      if (!result) return state

      const scanResults = state.scanResults.map((row) =>
        row.id === resultId ? { ...row, status } : row,
      )
      const updatedResult = scanResults.find((row) => row.id === resultId)!
      const suppressedListings = upsertSuppressionForResult(
        state.suppressedListings ?? [],
        updatedResult,
        state.takedownRequests,
      )

      return { ...state, scanResults, suppressedListings }
    })
    return
  }

  await supabase.from("scan_results").update({ status }).eq("id", resultId)
}

export async function persistTakedownRequest(request: TakedownRequest, resultId: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    await mutateFileState((state) => {
      const scanResults = state.scanResults.map((result) =>
        result.id === resultId ? { ...result, status: "takedown_requested" as const } : result,
      )
      const updatedResult = scanResults.find((result) => result.id === resultId)!
      const takedownRequests = [request, ...state.takedownRequests]
      const suppressedListings = upsertSuppressionForResult(
        state.suppressedListings ?? [],
        updatedResult,
        takedownRequests,
      )

      return {
        ...state,
        scanResults,
        takedownRequests,
        suppressedListings,
      }
    })
    return
  }

  await supabase.from("scan_results").update({ status: "takedown_requested" }).eq("id", resultId)
  await supabase.from("takedown_requests").upsert({
    id: request.id,
    scan_result_id: request.scanResultId,
    brand_profile_id: request.brandProfileId,
    claim_type: request.claimType,
    status: request.status,
    owner_attestation: request.ownerAttestation,
    dmca_statement: request.dmcaStatement,
    submitted_to: request.submittedTo ?? null,
    submitted_at: request.submittedAt ?? null,
    created_at: request.createdAt,
  })
}

export async function persistTakedownSubmission(request: TakedownRequest, submission: DmcaSubmission) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    await mutateFileState((state) => {
      const takedownRequests = state.takedownRequests.map((row) => (row.id === request.id ? request : row))
      const result = state.scanResults.find((row) => row.id === request.scanResultId)
      const suppressedListings = result
        ? upsertSuppressionForResult(state.suppressedListings ?? [], result, takedownRequests)
        : state.suppressedListings ?? []

      return {
        ...state,
        takedownRequests,
        dmcaSubmissions: [submission, ...state.dmcaSubmissions],
        suppressedListings,
      }
    })
    return
  }

  await supabase.from("takedown_requests").update({
    status: request.status,
    owner_attestation: request.ownerAttestation,
    submitted_at: request.submittedAt ?? null,
  }).eq("id", request.id)

  await supabase.from("dmca_submissions").upsert({
    id: submission.id,
    takedown_request_id: submission.takedownRequestId,
    marketplace: submission.marketplace,
    submission_payload: submission.submissionPayload,
    response_payload: submission.responsePayload ?? null,
    external_case_id: submission.externalCaseId ?? null,
    status: submission.status,
    created_at: submission.createdAt,
  })
}

export async function liftSuppressedListing(suppressionId: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    await mutateFileState((state) => ({
      ...state,
      suppressedListings: (state.suppressedListings ?? []).map((entry) =>
        entry.id === suppressionId ? { ...entry, liftedAt: now() } : entry,
      ),
    }))
    return
  }

  // Supabase schema not wired yet — file persistence only for suppressions.
}

export function createSubmissionId() {
  return createId("submission")
}

export function createTakedownId() {
  return createId("td")
}

function scheduleToRow(schedule: ScanSchedule) {
  return {
    id: schedule.id,
    brand_profile_id: schedule.brandProfileId,
    enabled: schedule.enabled,
    frequency: schedule.frequency,
    am_marketplaces: schedule.amMarketplaces,
    pm_marketplaces: schedule.pmMarketplaces,
    keywords: schedule.keywords,
    risk_threshold: 0,
    timezone: schedule.timezone,
    am_run_at: schedule.amRunAt,
    pm_run_at: schedule.pmRunAt,
    stagger_minutes: schedule.staggerMinutes,
    last_am_run_at: schedule.lastAmRunAt ?? null,
    last_pm_run_at: schedule.lastPmRunAt ?? null,
    created_at: schedule.createdAt,
    updated_at: schedule.updatedAt,
  }
}

export async function persistScanSchedule(schedule: ScanSchedule) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    await mutateFileState((state) => ({
      ...state,
      scanSchedules: [
        schedule,
        ...state.scanSchedules.filter((row) => row.brandProfileId !== schedule.brandProfileId),
      ],
    }))
    return
  }

  await supabase.from("scan_schedules").upsert(scheduleToRow(schedule))
}

export async function loadEnabledScanSchedules() {
  const state = await loadTrackerState()
  return state.scanSchedules.filter((schedule) => schedule.enabled && schedule.frequency === "twice_daily")
}

export async function updateScheduleLastRun(scheduleId: string, slot: ScanRunSlot, timestamp: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    await mutateFileState((state) => ({
      ...state,
      scanSchedules: state.scanSchedules.map((schedule) => {
        if (schedule.id !== scheduleId) return schedule
        return {
          ...schedule,
          lastAmRunAt: slot === "am" ? timestamp : schedule.lastAmRunAt,
          lastPmRunAt: slot === "pm" ? timestamp : schedule.lastPmRunAt,
          updatedAt: timestamp,
        }
      }),
    }))
    return
  }

  const patch =
    slot === "am"
      ? { last_am_run_at: timestamp, updated_at: timestamp }
      : { last_pm_run_at: timestamp, updated_at: timestamp }

  await supabase.from("scan_schedules").update(patch).eq("id", scheduleId)
}

export async function updateScanSchedule(scheduleId: string, patch: Partial<ScanSchedule>) {
  const state = await loadTrackerState()
  const existing = state.scanSchedules.find((schedule) => schedule.id === scheduleId)
  if (!existing) return null

  const updated: ScanSchedule = {
    ...existing,
    ...patch,
    updatedAt: now(),
  }

  await persistScanSchedule(updated)
  return updated
}

export { emptyState, demoState }
