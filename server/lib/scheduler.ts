import { createId, now } from "./ids.js"
import { queueScanJob } from "./scanOrchestrator.js"
import {
  loadEnabledScanSchedules,
  loadTrackerState,
  persistScanJob,
  persistScanSchedule,
  updateScheduleLastRun,
} from "./store.js"
import { buildDefaultScanSchedule } from "./defaultSchedule.js"
import type { ScanJob, ScanRunSlot, ScanSchedule } from "./types.js"

function parseRunTime(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part))
  return { hours: hours || 0, minutes: minutes || 0 }
}

function sameUtcDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

function scheduledUtcDate(current: Date, runAt: string, staggerMinutes: number) {
  const { hours, minutes } = parseRunTime(runAt)
  const totalMinutes = hours * 60 + minutes + staggerMinutes
  const scheduled = new Date(current)
  scheduled.setUTCHours(Math.floor(totalMinutes / 60) % 24, totalMinutes % 60, 0, 0)
  return scheduled
}

function isSlotDue(schedule: ScanSchedule, slot: ScanRunSlot, current: Date) {
  if (!schedule.enabled || schedule.frequency !== "twice_daily") return false

  const runAt = slot === "am" ? schedule.amRunAt : schedule.pmRunAt
  const lastRunAt = slot === "am" ? schedule.lastAmRunAt : schedule.lastPmRunAt
  const scheduled = scheduledUtcDate(current, runAt, schedule.staggerMinutes)

  if (current.getTime() < scheduled.getTime()) return false
  if (lastRunAt && sameUtcDay(new Date(lastRunAt), current)) return false

  return true
}

async function hasActiveJobToday(scheduleId: string, slot: ScanRunSlot) {
  const state = await loadTrackerState()
  const today = new Date()

  return state.scanJobs.some((job) => {
    if (job.scheduleId !== scheduleId || job.runSlot !== slot) return false
    if (!["queued", "running"].includes(job.status)) {
      const created = new Date(job.createdAt)
      return sameUtcDay(created, today)
    }
    return true
  })
}

async function enqueueScheduledScan(schedule: ScanSchedule, slot: ScanRunSlot) {
  if (await hasActiveJobToday(schedule.id, slot)) return null

  const marketplaces = slot === "am" ? schedule.amMarketplaces : schedule.pmMarketplaces
  if (marketplaces.length === 0) return null

  const timestamp = now()
  const scanJob: ScanJob = {
    id: createId("scan"),
    brandProfileId: schedule.brandProfileId,
    scheduleId: schedule.id,
    runSlot: slot,
    marketplaces,
    keywords: schedule.keywords,
    status: "queued",
    frequency: "twice_daily",
    createdAt: timestamp,
  }

  await persistScanJob(scanJob)
  await updateScheduleLastRun(schedule.id, slot, timestamp)
  await queueScanJob(scanJob)
  return scanJob
}

export async function ensureSchedulesForBrands() {
  const state = await loadTrackerState()
  const schedules = await loadEnabledScanSchedules()
  const scheduledBrandIds = new Set(schedules.map((schedule) => schedule.brandProfileId))

  for (const brand of state.brandProfiles) {
    if (scheduledBrandIds.has(brand.id)) continue
    const schedule = buildDefaultScanSchedule(brand)
    await persistScanSchedule(schedule)
  }
}

export async function runSchedulerTick() {
  await ensureSchedulesForBrands()

  const schedules = await loadEnabledScanSchedules()
  const current = new Date()
  const enqueued: ScanJob[] = []

  for (const schedule of schedules) {
    if (isSlotDue(schedule, "am", current)) {
      const job = await enqueueScheduledScan(schedule, "am")
      if (job) enqueued.push(job)
    }
    if (isSlotDue(schedule, "pm", current)) {
      const job = await enqueueScheduledScan(schedule, "pm")
      if (job) enqueued.push(job)
    }
  }

  return {
    checkedAt: current.toISOString(),
    schedulesChecked: schedules.length,
    jobsEnqueued: enqueued.length,
    jobs: enqueued,
  }
}

export function nextRunAt(schedule: ScanSchedule, slot: ScanRunSlot, from = new Date()) {
  const runAt = slot === "am" ? schedule.amRunAt : schedule.pmRunAt
  const lastRunAt = slot === "am" ? schedule.lastAmRunAt : schedule.lastPmRunAt
  const scheduled = scheduledUtcDate(from, runAt, schedule.staggerMinutes)

  if (from.getTime() < scheduled.getTime() && !(lastRunAt && sameUtcDay(new Date(lastRunAt), from))) {
    return scheduled.toISOString()
  }

  const tomorrow = new Date(from)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return scheduledUtcDate(tomorrow, runAt, schedule.staggerMinutes).toISOString()
}
