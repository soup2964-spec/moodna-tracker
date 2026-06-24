import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"
import * as trackerApi from "./trackerApi"
import type {
  BrandIntakeInput,
  ClaimType,
  ScanResult,
  ScanSetupInput,
  TrackerState,
} from "./trackerTypes"

const emptyState: TrackerState = {
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

type StoreMeta = {
  loading: boolean
  busy: boolean
  error: string | null
  activeScanJobId: string | null
}

let state: TrackerState = emptyState
let meta: StoreMeta = {
  loading: true,
  busy: false,
  error: null,
  activeScanJobId: null,
}

const listeners = new Set<() => void>()

let snapshot = { state, meta }

function notify() {
  snapshot = { state, meta }
  listeners.forEach((listener) => listener())
}

function setMeta(partial: Partial<StoreMeta>) {
  meta = { ...meta, ...partial }
  notify()
}

function setState(nextState: TrackerState) {
  state = nextState
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return snapshot
}

async function refreshState() {
  try {
    const nextState = await trackerApi.fetchTrackerState()
    setState(nextState)

    if (meta.activeScanJobId) {
      const activeJob = nextState.scanJobs.find((job) => job.id === meta.activeScanJobId)
      if (!activeJob || activeJob.status === "completed" || activeJob.status === "failed") {
        setMeta({ activeScanJobId: null, busy: false })
        stopPolling()
      } else if (activeJob.status === "running" || activeJob.status === "queued") {
        startPolling(activeJob.id)
      }
    }

    setMeta({ error: null })
  } catch (refreshError) {
    setMeta({
      error: refreshError instanceof Error ? refreshError.message : "Failed to load tracker data",
      busy: false,
      activeScanJobId: null,
    })
    stopPolling()
  } finally {
    setMeta({ loading: false })
  }
}

let pollTimer: number | null = null

function stopPolling() {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling(scanJobId: string) {
  stopPolling()
  pollTimer = window.setInterval(async () => {
    try {
      const payload = await trackerApi.fetchScanJob(scanJobId)
      setState({
        ...state,
        scanJobs: [payload.scanJob, ...state.scanJobs.filter((job) => job.id !== payload.scanJob.id)],
        scanResults: [
          ...payload.results,
          ...state.scanResults.filter((result) => !payload.results.some((row) => row.id === result.id)),
        ],
        alerts: [
          ...payload.alerts,
          ...state.alerts.filter((alert) => !payload.alerts.some((row) => row.id === alert.id)),
        ],
      })

      if (payload.scanJob.status === "completed" || payload.scanJob.status === "failed") {
        setMeta({
          activeScanJobId: null,
          busy: false,
          error: payload.scanJob.errorMessage ?? null,
        })
        stopPolling()
        await refreshState()
      }
    } catch (pollError) {
      setMeta({
        activeScanJobId: null,
        busy: false,
        error: pollError instanceof Error ? pollError.message : "Failed to poll scan status",
      })
      stopPolling()
    }
  }, 1500)
}

let initialized = false

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return
  initialized = true
  void refreshState()
}

export function useTrackerStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    ensureInitialized()
  }, [])

  const submitBrandIntake = useCallback(async (input: BrandIntakeInput) => {
    setMeta({ busy: true, error: null })
    try {
      const payload = await trackerApi.submitBrandIntake(input)
      setState(payload.state)
      return payload.brandProfile
    } catch (submitError) {
      setMeta({
        error: submitError instanceof Error ? submitError.message : "Brand intake failed",
      })
      throw submitError
    } finally {
      setMeta({ busy: false })
    }
  }, [])

  const startScan = useCallback(async (input: ScanSetupInput) => {
    setMeta({ busy: true, error: null })
    try {
      const payload = await trackerApi.startScan(input)
      setState({
        ...state,
        scanJobs: [payload.scanJob, ...state.scanJobs.filter((job) => job.id !== payload.scanJob.id)],
      })
      setMeta({ activeScanJobId: payload.scanJob.id })
      startPolling(payload.scanJob.id)
      return payload.scanJob
    } catch (scanError) {
      setMeta({
        busy: false,
        error: scanError instanceof Error ? scanError.message : "Scan failed to start",
      })
      throw scanError
    }
  }, [])

  const updateResultStatus = useCallback(async (resultId: string, status: ScanResult["status"]) => {
    setMeta({ busy: true, error: null })
    try {
      const payload = await trackerApi.updateResultStatus(resultId, status)
      setState(payload.state)
    } catch (updateError) {
      setMeta({
        error: updateError instanceof Error ? updateError.message : "Failed to update result",
      })
      throw updateError
    } finally {
      setMeta({ busy: false })
    }
  }, [])

  const createTakedownRequest = useCallback(async (resultId: string) => {
    setMeta({ busy: true, error: null })
    try {
      const payload = await trackerApi.createTakedownRequest(resultId)
      setState(payload.state)
      return payload.request
    } catch (takedownError) {
      setMeta({
        error: takedownError instanceof Error ? takedownError.message : "Failed to create takedown",
      })
      throw takedownError
    } finally {
      setMeta({ busy: false })
    }
  }, [])

  const prepareTakedown = useCallback(async (requestId: string, claimType?: ClaimType) => {
    setMeta({ busy: true, error: null })
    try {
      const payload = await trackerApi.prepareTakedown(requestId, claimType)
      setState(payload.state)
      return payload
    } catch (prepareError) {
      setMeta({
        error: prepareError instanceof Error ? prepareError.message : "Failed to prepare DMCA notice",
      })
      throw prepareError
    } finally {
      setMeta({ busy: false })
    }
  }, [])

  const approveAndSubmitTakedown = useCallback(async (requestId: string) => {
    setMeta({ busy: true, error: null })
    try {
      const payload = await trackerApi.submitTakedown(requestId)
      setState(payload.state)
      return payload
    } catch (submitError) {
      setMeta({
        error: submitError instanceof Error ? submitError.message : "Failed to submit takedown",
      })
      throw submitError
    } finally {
      setMeta({ busy: false })
    }
  }, [])

  const liftSuppressedListing = useCallback(async (suppressionId: string) => {
    setMeta({ busy: true, error: null })
    try {
      const payload = await trackerApi.liftSuppressedListing(suppressionId)
      setState(payload.state)
    } catch (liftError) {
      setMeta({
        error: liftError instanceof Error ? liftError.message : "Failed to lift suppression",
      })
      throw liftError
    } finally {
      setMeta({ busy: false })
    }
  }, [])

  const toggleSchedule = useCallback(async (scheduleId: string, enabled: boolean) => {
    setMeta({ busy: true, error: null })
    try {
      const payload = await trackerApi.updateScanSchedule(scheduleId, { enabled })
      setState(payload.state)
    } catch (updateError) {
      setMeta({
        error: updateError instanceof Error ? updateError.message : "Failed to update schedule",
      })
      throw updateError
    } finally {
      setMeta({ busy: false })
    }
  }, [])

  return useMemo(
    () => ({
      ...snapshot.state,
      ...snapshot.meta,
      refresh: refreshState,
      submitBrandIntake,
      startScan,
      updateResultStatus,
      createTakedownRequest,
      prepareTakedown,
      approveAndSubmitTakedown,
      liftSuppressedListing,
      toggleSchedule,
    }),
    [
      snapshot,
      submitBrandIntake,
      startScan,
      updateResultStatus,
      createTakedownRequest,
      prepareTakedown,
      approveAndSubmitTakedown,
      liftSuppressedListing,
      toggleSchedule,
    ],
  )
}
