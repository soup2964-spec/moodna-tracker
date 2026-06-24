import { useEffect, useState } from "react"
import { fetchHealth } from "../lib/trackerApi"

export function TrackerStatusBanner() {
  const [health, setHealth] = useState<{
    firecrawl: boolean
    supabase: boolean
    schedulerEnabled: boolean
    scanAmTime: string
    scanPmTime: string
    publicWww: boolean
    serper: boolean
    kieAi: boolean
  } | null>(null)

  useEffect(() => {
    void fetchHealth()
      .then((payload) => setHealth(payload))
      .catch(() => setHealth(null))
  }, [])

  if (!health) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        API server offline. Run <code className="font-mono">npm run dev</code> to start the web app and scan backend.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
      <span className="font-medium text-neutral-900">Live integrations:</span>{" "}
      PublicWWW {health.publicWww ? "connected" : "missing (source-code search)"} · Serper{" "}
      {health.serper ? "connected" : "missing (marketplace listings)"} · Firecrawl{" "}
      {health.firecrawl ? "connected" : "using direct fetch"} · Supabase{" "}
      {health.supabase ? "connected" : "local file store"} · Scheduler{" "}
      {health.schedulerEnabled
        ? `2×/day (${health.scanAmTime} + ${health.scanPmTime} UTC)`
        : "off"}{" "}
      · KIE {health.kieAi ? "connected (scan review)" : "missing (required for review queue)"}
    </div>
  )
}
