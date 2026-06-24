import type {
  BrandIntakeInput,
  BrandProfile,
  ClaimType,
  DmcaNoticePackage,
  IpAsset,
  ScanJob,
  ScanResultStatus,
  ScanSetupInput,
  TakedownRequest,
  TrackerState,
} from "./trackerTypes"

const API_BASE = "/api/tracker"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? `Request failed (${response.status})`)
  }

  return response.json() as Promise<T>
}

export async function fetchTrackerState() {
  return request<TrackerState>("/state")
}

export async function submitBrandIntake(input: BrandIntakeInput) {
  return request<{ brandProfile: BrandProfile; ipAssets: IpAsset[]; state: TrackerState }>(
    "/brand-intake",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )
}

export async function startScan(input: ScanSetupInput) {
  return request<{ scanJob: ScanJob }>("/scans", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function fetchScanJob(scanJobId: string) {
  return request<{
    scanJob: ScanJob
    results: TrackerState["scanResults"]
    alerts: TrackerState["alerts"]
  }>(`/scans/${scanJobId}`)
}

export async function updateResultStatus(resultId: string, status: ScanResultStatus) {
  return request<{ state: TrackerState }>(`/results/${resultId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

export async function createTakedownRequest(resultId: string, claimType: ClaimType = "copyright") {
  return request<{ request: TakedownRequest; notice?: DmcaNoticePackage; state: TrackerState }>(
    `/results/${resultId}/takedown`,
    {
      method: "POST",
      body: JSON.stringify({ claimType, autoPrepare: true }),
    },
  )
}

export async function prepareTakedown(requestId: string, claimType?: ClaimType) {
  return request<{ request: TakedownRequest; notice: DmcaNoticePackage; state: TrackerState }>(
    `/takedowns/${requestId}/prepare`,
    {
      method: "POST",
      body: JSON.stringify({ claimType }),
    },
  )
}

export async function submitTakedown(requestId: string) {
  return request<{
    request: TakedownRequest
    submission: TrackerState["dmcaSubmissions"][number]
    notice: DmcaNoticePackage
    submitResult: { success: boolean; method: string; message: string; externalCaseId?: string }
    state: TrackerState
  }>(`/takedowns/${requestId}/submit`, {
    method: "POST",
  })
}

export async function liftSuppressedListing(suppressionId: string) {
  return request<{ state: TrackerState }>(`/suppressions/${suppressionId}`, {
    method: "DELETE",
  })
}

export async function runCopycatTestStream(websiteUrl: string, onEvent: (event: CopycatTestEvent) => void) {
  const response = await fetch(`${API_BASE}/copycat-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ websiteUrl }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? `Copycat test failed (${response.status})`)
  }

  if (!response.body) {
    throw new Error("Copycat test returned an empty response")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      onEvent(JSON.parse(trimmed) as CopycatTestEvent)
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer.trim()) as CopycatTestEvent)
  }
}

export type CopycatTestEvent =
  | { type: "status"; message: string }
  | { type: "thought"; text: string }
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown }
  | {
      type: "review_queue"
      resultCount: number
      scanJobId: string
      brandProfileId: string
      brandName: string
    }
  | { type: "done" }
  | { type: "error"; message: string }

export async function fetchHealth() {
  const response = await fetch("/api/health")
  if (!response.ok) throw new Error("API unavailable")
  return response.json() as Promise<{
    ok: boolean
    firecrawl: boolean
    supabase: boolean
    schedulerEnabled: boolean
    scanAmTime: string
    scanPmTime: string
    kieAi: boolean
    publicWww: boolean
    serper: boolean
    resend: boolean
    dmcaAutoSubmit: boolean
  }>
}

export async function updateScanSchedule(
  scheduleId: string,
  patch: { enabled?: boolean; keywords?: string[] },
) {
  return request<{ schedule: import("./trackerTypes").ScanSchedule; state: TrackerState }>(
    `/schedules/${scheduleId}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  )
}

export async function triggerSchedulerTick() {
  const response = await fetch("/api/scheduler/tick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
  if (!response.ok) throw new Error("Scheduler tick failed")
  return response.json() as Promise<{ jobsEnqueued: number }>
}
