import "dotenv/config"
import cron from "node-cron"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { serve } from "@hono/node-server"
import { discoverBrandAssets } from "./lib/brandIntake.js"
import { buildDefaultScanSchedule } from "./lib/defaultSchedule.js"
import { runCopycatTestStream } from "./lib/copycatTestKie.js"
import { env, hasSupabase, hasFirecrawl, hasKieAi, hasPublicWww, hasResend, hasSerper } from "./lib/env.js"
import { createId, now } from "./lib/ids.js"
import { queueScanJob } from "./lib/scanOrchestrator.js"
import { runSchedulerTick } from "./lib/scheduler.js"
import {
  createTakedownId,
  getOrganizationId,
  loadTrackerState,
  persistBrandIntake,
  persistScanSchedule,
  persistTakedownRequest,
  updateScanResultStatus,
  updateScanSchedule,
  liftSuppressedListing,
} from "./lib/store.js"
import {
  createAndPrepareDmca,
  prepareDmcaRequest,
  submitPreparedDmca,
} from "./lib/dmcaOrchestrator.js"
import type { ClaimType, Marketplace, ScanJob, ScanResultStatus, TakedownRequest } from "./lib/types.js"

const app = new Hono()

app.use(
  "*",
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    ],
  }),
)

function isSchedulerAuthorized(header: string | undefined) {
  if (!env.schedulerSecret) return true
  return header === env.schedulerSecret
}

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    firecrawl: hasFirecrawl(),
    supabase: hasSupabase(),
    schedulerEnabled: env.schedulerEnabled,
    scanAmTime: env.scanAmTime,
    scanPmTime: env.scanPmTime,
    kieAi: hasKieAi(),
    publicWww: hasPublicWww(),
    serper: hasSerper(),
    resend: hasResend(),
    dmcaAutoSubmit: env.dmcaAutoSubmit,
  }),
)

app.post("/api/scheduler/tick", async (c) => {
  if (!isSchedulerAuthorized(c.req.header("x-scheduler-secret"))) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const result = await runSchedulerTick()
  return c.json(result)
})

app.get("/api/tracker/state", async (c) => {
  const state = await loadTrackerState()
  return c.json(state)
})

app.get("/api/tracker/schedules", async (c) => {
  const state = await loadTrackerState()
  return c.json({ schedules: state.scanSchedules })
})

app.patch("/api/tracker/schedules/:scheduleId", async (c) => {
  const body = (await c.req.json()) as {
    enabled?: boolean
    keywords?: string[]
  }

  const updated = await updateScanSchedule(c.req.param("scheduleId"), body)
  if (!updated) return c.json({ error: "Schedule not found" }, 404)

  const state = await loadTrackerState()
  return c.json({ schedule: updated, state })
})

app.post("/api/tracker/copycat-test", async (c) => {
  const body = (await c.req.json()) as { websiteUrl?: string }
  const websiteUrl = body.websiteUrl?.trim()

  if (!websiteUrl) {
    return c.json({ error: "websiteUrl is required" }, 400)
  }

  if (!hasKieAi()) {
    return c.json({ error: "KIE_AI_API_KEY is not configured" }, 503)
  }

  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
        }

        try {
          for await (const event of runCopycatTestStream(websiteUrl)) {
            send(event as Record<string, unknown>)
          }
        } catch (error) {
          send({
            type: "error",
            message: error instanceof Error ? error.message : "Copycat test failed",
          })
        } finally {
          controller.close()
        }
      },
    }),
    {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    },
  )
})

app.post("/api/tracker/brand-intake", async (c) => {
  const body = (await c.req.json()) as { websiteUrl?: string }
  if (!body.websiteUrl?.trim()) {
    return c.json({ error: "websiteUrl is required" }, 400)
  }

  const organizationId = await getOrganizationId()
  const { brandProfile, ipAssets } = await discoverBrandAssets({
    websiteUrl: body.websiteUrl,
    organizationId,
  })

  await persistBrandIntake(brandProfile, ipAssets)
  const schedule = buildDefaultScanSchedule(brandProfile)
  await persistScanSchedule(schedule)

  const state = await loadTrackerState()
  return c.json({ brandProfile, ipAssets, schedule, state })
})

app.post("/api/tracker/scans", async (c) => {
  const body = (await c.req.json()) as {
    brandProfileId?: string
    marketplaces?: Marketplace[]
    keywords?: string | string[]
    frequency?: ScanJob["frequency"]
  }

  if (!body.brandProfileId || !body.marketplaces?.length) {
    return c.json({ error: "brandProfileId and marketplaces are required" }, 400)
  }

  const state = await loadTrackerState()
  const brand = state.brandProfiles.find((profile) => profile.id === body.brandProfileId)
  if (!brand) {
    return c.json({ error: "Brand profile not found" }, 404)
  }

  const rawKeywords = body.keywords ?? brand.brandName
  const keywordList = Array.isArray(rawKeywords)
    ? rawKeywords
    : String(rawKeywords)
        .split(/\n|,/)
        .map((keyword) => keyword.trim())
        .filter(Boolean)

  const timestamp = now()
  const scanJob: ScanJob = {
    id: createId("scan"),
    brandProfileId: body.brandProfileId,
    runSlot: "manual",
    marketplaces: body.marketplaces,
    keywords: keywordList,
    status: "queued",
    frequency: body.frequency ?? "once",
    createdAt: timestamp,
  }

  await queueScanJob(scanJob)
  return c.json({ scanJob })
})

app.get("/api/tracker/scans/:scanJobId", async (c) => {
  const state = await loadTrackerState()
  const scanJob = state.scanJobs.find((job) => job.id === c.req.param("scanJobId"))
  if (!scanJob) return c.json({ error: "Scan job not found" }, 404)

  const results = state.scanResults.filter((result) => result.scanJobId === scanJob.id)
  const alerts = state.alerts.filter((alert) => results.some((result) => result.id === alert.scanResultId))
  return c.json({ scanJob, results, alerts })
})

app.patch("/api/tracker/results/:resultId", async (c) => {
  const body = (await c.req.json()) as { status?: ScanResultStatus }
  if (!body.status) return c.json({ error: "status is required" }, 400)

  await updateScanResultStatus(c.req.param("resultId"), body.status)
  const state = await loadTrackerState()
  return c.json({ state })
})

app.delete("/api/tracker/suppressions/:suppressionId", async (c) => {
  await liftSuppressedListing(c.req.param("suppressionId"))
  const state = await loadTrackerState()
  return c.json({ state })
})

app.post("/api/tracker/results/:resultId/takedown", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    claimType?: ClaimType
    autoPrepare?: boolean
  }

  try {
    if (body.autoPrepare !== false) {
      const prepared = await createAndPrepareDmca(c.req.param("resultId"), body.claimType ?? "copyright")
      const state = await loadTrackerState()
      return c.json({ request: prepared.request, notice: prepared.notice, state })
    }

    const state = await loadTrackerState()
    const result = state.scanResults.find((row) => row.id === c.req.param("resultId"))
    if (!result) return c.json({ error: "Scan result not found" }, 404)

    const request: TakedownRequest = {
      id: createTakedownId(),
      scanResultId: result.id,
      brandProfileId: result.brandProfileId,
      claimType: body.claimType ?? "copyright",
      status: "awaiting_owner_approval",
      ownerAttestation: false,
      dmcaStatement:
        "I certify under penalty of perjury that I am the owner or authorized agent and that this use is unauthorized.",
      submittedTo: result.marketplace,
      createdAt: now(),
    }

    await persistTakedownRequest(request, result.id)
    const nextState = await loadTrackerState()
    return c.json({ request, state: nextState })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to create takedown" },
      500,
    )
  }
})

app.post("/api/tracker/takedowns/:requestId/prepare", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { claimType?: ClaimType }
  try {
    const prepared = await prepareDmcaRequest(c.req.param("requestId"), body.claimType)
    const state = await loadTrackerState()
    return c.json({ ...prepared, state })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to prepare DMCA notice" },
      500,
    )
  }
})

app.post("/api/tracker/takedowns/:requestId/submit", async (c) => {
  try {
    const submitted = await submitPreparedDmca(c.req.param("requestId"))
    const state = await loadTrackerState()
    return c.json({ ...submitted, state })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to submit DMCA notice" },
      500,
    )
  }
})

serve({
  fetch: app.fetch,
  port: env.port,
})

if (env.schedulerEnabled) {
  cron.schedule("*/5 * * * *", () => {
    void runSchedulerTick().then((result) => {
      if (result.jobsEnqueued > 0) {
        console.log(`Scheduler enqueued ${result.jobsEnqueued} scan job(s)`)
      }
    })
  })
  void runSchedulerTick()
}

console.log(`Moodna API running on http://localhost:${env.port}`)
console.log(
  `Integrations: PublicWWW=${hasPublicWww() ? "on" : "off"}, Serper=${hasSerper() ? "on" : "off"}, Firecrawl=${hasFirecrawl() ? "on" : "off"}, KIE=${hasKieAi() ? "on" : "off"}, Supabase=${hasSupabase() ? "on" : "off"}, Scheduler=${env.schedulerEnabled ? "on" : "off"}`,
)
console.log(`Scan windows: AM ${env.scanAmTime} UTC · PM ${env.scanPmTime} UTC`)
