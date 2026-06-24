import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom"
import { TrackerStatusBanner } from "../components/TrackerStatusBanner"
import { buildDmcaPackage } from "../lib/dmcaTemplates"
import {
  getScanTargetLabel,
  scanMarketplacesForBrand,
} from "../lib/scanTargets"
import { useTrackerStore } from "../lib/trackerStore"
import { runCopycatTestStream } from "../lib/trackerApi"
import type { Marketplace, ScanResult } from "../lib/trackerTypes"

const navItems = [
  { label: "Overview", to: "/dashboard", end: true },
  { label: "Brand intake", to: "/dashboard/brand-intake" },
  { label: "Scan schedule", to: "/dashboard/scan-schedule" },
  { label: "Find copycats", to: "/dashboard/find-copycats" },
  { label: "Find copycats test", to: "/dashboard/find-copycats-test" },
  { label: "Review queue", to: "/dashboard/review" },
  { label: "Owner alerts", to: "/dashboard/alerts" },
  { label: "Takedowns", to: "/dashboard/takedowns" },
  { label: "Reports", to: "/dashboard/reports" },
]

const pageTitles: Record<string, string> = {
  "/dashboard": "Brand protection overview",
  "/dashboard/brand-intake": "Brand intake",
  "/dashboard/scan-schedule": "Scan schedule",
  "/dashboard/find-copycats": "Find copycats",
  "/dashboard/find-copycats-test": "Find copycats test",
  "/dashboard/review": "Review queue",
  "/dashboard/alerts": "Owner alerts",
  "/dashboard/takedowns": "Takedowns",
  "/dashboard/reports": "Reports",
}

function labelForMarketplace(marketplace: Marketplace) {
  return getScanTargetLabel(marketplace)
}

function statusBadgeClass(status: string) {
  if (["removed", "approved", "submitted"].includes(status)) return "bg-emerald-50 text-emerald-700"
  if (status === "reappeared") return "bg-red-50 text-red-700"
  if (["new", "awaiting_owner_approval", "takedown_requested"].includes(status)) {
    return "bg-amber-50 text-amber-800"
  }
  if (["rejected", "failed"].includes(status)) return "bg-red-50 text-red-700"
  return "bg-neutral-100 text-neutral-600"
}

const REVIEW_QUEUE_STATUSES = new Set(["new", "reviewing", "approved", "reappeared"])
const ACTIONED_STATUSES = new Set(["takedown_requested", "rejected", "removed"])

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClass(status)}`}>
      {status.replaceAll("_", " ")}
    </span>
  )
}

function ListingLink({
  title,
  url,
  className = "text-sm font-semibold text-neutral-900",
}: {
  title: string
  url: string
  className?: string
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`underline decoration-amber-300 underline-offset-2 transition-colors hover:text-amber-900 hover:decoration-amber-500 ${className}`}
    >
      {title}
    </a>
  )
}

function ViewListingLink({ url }: { url: string }) {
  let hostname = url
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "")
  } catch {
    // keep raw url
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900"
    >
      View on {hostname}
      <span aria-hidden="true">↗</span>
    </a>
  )
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const pageTitle = pageTitles[pathname] ?? "Dashboard"

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
          <div className="border-b border-neutral-200 px-5 py-5">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Moodna" className="h-9 w-auto object-contain brightness-0" />
              <span className="text-sm font-semibold tracking-tight text-neutral-900">Moodna</span>
            </Link>
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-3">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-amber-50 text-amber-900"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-neutral-200 p-4">
            <Link
              to="/"
              className="block rounded-lg px-3 py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              Back to site
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-white lg:bg-neutral-50">
          <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-4 lg:px-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">Moodna Tracker</p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-neutral-900">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-400 sm:block">
                Search cases
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-900">
                M
              </div>
            </div>
          </header>

          <main className="flex-1 space-y-6 p-5 lg:p-8">
            <TrackerStatusBanner />
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

function OverviewContent() {
  const tracker = useTrackerStore()
  const activeThreats = tracker.scanResults.filter((result) => result.status !== "removed").length
  const submitted = tracker.takedownRequests.filter((request) => request.status === "submitted").length
  const highRisk = tracker.scanResults.filter((result) => result.confidence >= 90).length

  const stats = [
    { label: "Brand profiles", value: tracker.brandProfiles.length.toString(), change: "IP assets captured" },
    { label: "Active schedules", value: tracker.scanSchedules.filter((row) => row.enabled).length.toString(), change: "2 scans/day per brand" },
    { label: "Active threats", value: activeThreats.toString(), change: `${highRisk} high-risk matches` },
    { label: "Takedowns", value: tracker.takedownRequests.length.toString(), change: `${submitted} submitted` },
    { label: "Owner alerts", value: tracker.alerts.length.toString(), change: "Ready for action" },
  ]

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">{stat.label}</p>
            <p className="mt-2 font-display text-3xl text-neutral-900">{stat.value}</p>
            <p className="mt-2 text-xs text-neutral-400">{stat.change}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Latest scan results</h2>
            <p className="mt-1 text-xs text-neutral-500">Candidate infringements waiting for review or action.</p>
          </div>
          <div className="divide-y divide-neutral-200">
            {tracker.scanResults.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <ListingLink title={item.listingTitle} url={item.listingUrl} className="text-sm font-medium" />
                  <p className="mt-1 text-xs text-neutral-400">
                    {labelForMarketplace(item.marketplace)} - {item.confidence}% confidence
                  </p>
                  <div className="mt-2">
                    <ViewListingLink url={item.listingUrl} />
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Production readiness</h2>
          <p className="mt-1 text-xs text-neutral-500">Workflow coverage from intake to claim tracking.</p>
          <div className="mt-6 space-y-3">
            {["Brand/IP intake", "Marketplace & piracy scans", "Human review", "Owner alerts", "DMCA takedowns"].map(
              (row) => (
                <div
                  key={row}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3"
                >
                  <span className="text-sm text-neutral-600">{row}</span>
                  <span className="text-sm font-semibold text-emerald-700">wired</span>
                </div>
              ),
            )}
          </div>
        </section>
      </div>
    </>
  )
}

function BrandIntakeContent() {
  const tracker = useTrackerStore()
  const [websiteUrl, setWebsiteUrl] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await tracker.submitBrandIntake({ websiteUrl })
    setWebsiteUrl("")
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      {tracker.error && (
        <div className="xl:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {tracker.error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Paste a brand link</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Add the official website for an ecom brand or creator profile (OnlyFans, Fansly, Patreon).
          Firecrawl maps the site and pulls full page text, product copy, images, and brand signals across
          up to 12 key pages, then enables automatic monitoring twice daily.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            required
            type="text"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="https://yourbrand.com or https://onlyfans.com/handle"
            className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <button
            type="submit"
            disabled={tracker.busy}
            className="rounded-xl bg-[#e2c523] px-6 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-[#c9a818] disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0"
          >
            {tracker.busy ? "Crawling site..." : "Get IP assets"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {["Brand/domain", "Full page text", "Logo source", "Product pages", "Product images", "Copyright signals"].map((item) => (
            <div key={item} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="text-xs font-medium text-neutral-600">{item}</p>
              <p className="mt-1 text-[11px] text-neutral-400">Auto-discovered</p>
            </div>
          ))}
        </div>
      </form>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-neutral-900">Discovered IP sources</h3>
        <div className="mt-4 space-y-3">
          {tracker.brandProfiles.map((profile) => {
            const assets = tracker.ipAssets.filter((asset) => asset.brandProfileId === profile.id)
            const productImages = assets.filter((asset) => asset.type === "product_image")
            const productDescriptions = assets.filter((asset) => asset.type === "product_description")
            const pageContents = assets.filter((asset) => asset.type === "page_content")
            const designPalette = assets.find((asset) => asset.type === "design_palette")
            const crawledPages = [...new Set(pageContents.map((asset) => asset.sourceUrl).filter(Boolean))]

            return (
            <div key={profile.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-semibold text-neutral-900">{profile.brandName}</p>
              <p className="mt-1 text-xs text-neutral-500">{profile.websiteUrl}</p>
              <p className="mt-2 text-xs text-neutral-400">
                {assets.length} IP assets · {crawledPages.length} pages crawled · {pageContents.length} text
                blocks · {productImages.length} product images · {productDescriptions.length} product descriptions
              </p>
              {crawledPages.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Pages captured</p>
                  {crawledPages.slice(0, 6).map((pageUrl) => (
                    <a
                      key={pageUrl}
                      href={pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-amber-900 underline decoration-amber-200 underline-offset-2 hover:bg-amber-50"
                    >
                      {pageUrl}
                    </a>
                  ))}
                </div>
              )}
              {designPalette && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Brand colors</p>
                  {designPalette.value.split(",").slice(0, 8).map((color) => (
                    <span
                      key={color}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-600"
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-neutral-200"
                        style={{ backgroundColor: color }}
                      />
                      {color}
                    </span>
                  ))}
                </div>
              )}
              {pageContents.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Brand text sample</p>
                  <p className="rounded-lg border border-neutral-200 bg-white p-3 text-xs leading-relaxed text-neutral-600">
                    {pageContents[0].value.slice(0, 420)}
                    {pageContents[0].value.length > 420 ? "…" : ""}
                  </p>
                </div>
              )}
              {productDescriptions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {productDescriptions.slice(0, 2).map((asset) => (
                    <p key={asset.id} className="rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
                      {asset.value.slice(0, 180)}
                      {asset.value.length > 180 ? "…" : ""}
                    </p>
                  ))}
                </div>
              )}
              {productImages.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Product images ({productImages.length})
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {productImages.slice(0, 8).map((asset) => (
                    <img
                      key={asset.id}
                      src={asset.value}
                      alt="Discovered product"
                      className="aspect-square rounded-lg border border-neutral-200 bg-white object-cover"
                      onError={(event) => {
                        event.currentTarget.replaceWith(
                          Object.assign(document.createElement("div"), {
                            className:
                              "flex aspect-square items-center justify-center rounded-lg border border-neutral-200 bg-white p-2 text-center text-[10px] text-neutral-400",
                            textContent: "Image unavailable",
                          }),
                        )
                      }}
                    />
                  ))}
                  </div>
                </div>
              )}
            </div>
          )})}
        </div>
      </section>
    </div>
  )
}

function FindCopycatsContent() {
  const tracker = useTrackerStore()
  const [brandProfileId, setBrandProfileId] = useState("")

  useEffect(() => {
    if (tracker.brandProfiles.length === 0) return

    const currentExists = tracker.brandProfiles.some((profile) => profile.id === brandProfileId)
    if (!brandProfileId || !currentExists) {
      setBrandProfileId(tracker.brandProfiles[0].id)
    }
  }, [brandProfileId, tracker.brandProfiles])

  const selectedBrand = tracker.brandProfiles.find((profile) => profile.id === brandProfileId)
  const scanMarketplaces = selectedBrand ? scanMarketplacesForBrand(selectedBrand.websiteUrl) : []
  const lastScanJob = selectedBrand
    ? tracker.scanJobs.find((job) => job.brandProfileId === selectedBrand.id)
    : undefined
  const brandAssetCount = selectedBrand
    ? tracker.ipAssets.filter((asset) => asset.brandProfileId === selectedBrand.id).length
    : 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!brandProfileId || !selectedBrand) return
    await tracker.startScan({
      brandProfileId,
      marketplaces: [...scanMarketplaces],
      keywords: selectedBrand.brandName.split(/[|:]/)[0]?.trim() ?? selectedBrand.brandName,
      frequency: "weekly",
    })
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:p-8">
      {tracker.error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {tracker.error}
        </div>
      )}
      {lastScanJob?.errorMessage && !tracker.activeScanJobId && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Last scan: {lastScanJob.errorMessage}
        </div>
      )}
      {tracker.activeScanJobId && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Scanning {scanMarketplaces.length} platform{scanMarketplaces.length === 1 ? "" : "s"} — text search,
          reverse image, dropshipper hunt, then KIE review...
        </div>
      )}
      <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Find copycats</h2>
      <p className="mt-2 max-w-2xl text-sm text-neutral-500">
        One click searches ecommerce marketplaces with text queries and reverse image search across the
        web for sites using similar product photos, then sends every hit to KIE Gemini for review. Only
        KIE-approved likely infringers land in the review queue.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <select
          value={brandProfileId}
          onChange={(event) => setBrandProfileId(event.target.value)}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        >
          {tracker.brandProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.brandName}
            </option>
          ))}
        </select>

        {selectedBrand && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            Full scan uses {brandAssetCount} IP asset{brandAssetCount === 1 ? "" : "s"} from brand intake
            (including product images for reverse image search across all similar sites) and searches{" "}
            {scanMarketplaces.length} marketplace{scanMarketplaces.length === 1 ? "" : "s"}:{" "}
            {scanMarketplaces.map((id) => getScanTargetLabel(id)).join(", ")}.
          </div>
        )}

        <button
          type="submit"
          disabled={tracker.busy || tracker.loading || !brandProfileId}
          className="rounded-full bg-[#e2c523] px-6 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-[#c9a818] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {tracker.busy ? "Scanning..." : tracker.loading ? "Loading brands..." : "Start full scan"}
        </button>
        {!tracker.loading && tracker.brandProfiles.length === 0 && (
          <p className="text-sm text-amber-800">
            No brand profile yet. Complete{" "}
            <Link to="/dashboard/brand-intake" className="font-semibold underline underline-offset-2">
              Brand intake
            </Link>{" "}
            first, then come back here to scan.
          </p>
        )}
        {tracker.error && tracker.brandProfiles.length === 0 && (
          <p className="text-sm text-red-700">
            Could not load brands from the API. Make sure you are on{" "}
            <a href="http://localhost:5174/dashboard/find-copycats" className="font-semibold underline underline-offset-2">
              http://localhost:5174
            </a>{" "}
            with <code className="font-mono text-xs">npm run dev</code> running.
          </p>
        )}
      </form>
    </section>
  )
}

function FindCopycatsTestContent() {
  const tracker = useTrackerStore()
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [thoughts, setThoughts] = useState<string[]>([])
  const [responseText, setResponseText] = useState("")
  const [toolEvents, setToolEvents] = useState<
    Array<{ kind: "call" | "result"; name: string; payload: unknown }>
  >([])
  const [done, setDone] = useState(false)
  const [reviewQueueCount, setReviewQueueCount] = useState<number | null>(null)
  const [testScanJobId, setTestScanJobId] = useState<string | null>(null)

  const queuedResults = testScanJobId
    ? tracker.scanResults.filter((result) => result.scanJobId === testScanJobId)
    : []

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const url = websiteUrl.trim()
    if (!url) return

    setRunning(true)
    setError(null)
    setStatus(null)
    setThoughts([])
    setResponseText("")
    setToolEvents([])
    setDone(false)
    setReviewQueueCount(null)
    setTestScanJobId(null)

    try {
      await runCopycatTestStream(url, (event) => {
        if (event.type === "status") setStatus(event.message)
        if (event.type === "thought") setThoughts((current) => [...current, event.text])
        if (event.type === "text") setResponseText((current) => current + event.text)
        if (event.type === "tool_call") {
          setToolEvents((current) => [...current, { kind: "call", name: event.name, payload: event.args }])
        }
        if (event.type === "tool_result") {
          setToolEvents((current) => [...current, { kind: "result", name: event.name, payload: event.result }])
        }
        if (event.type === "review_queue") {
          setReviewQueueCount(event.resultCount)
          setTestScanJobId(event.scanJobId)
          void tracker.refresh()
        }
        if (event.type === "error") setError(event.message)
        if (event.type === "done") setDone(true)
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Copycat test failed")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Find copycats test</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Paste a brand website URL. KIE Gemini intakes brand assets, then searches PublicWWW and Serper for
          fraudulent copycats across marketplaces (official brand listings are excluded). Results are saved to
          the review queue.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              required
              type="text"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://yourbrand.com"
              className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
            <button
              type="submit"
              disabled={running || !websiteUrl.trim()}
              className="rounded-xl bg-[#e2c523] px-6 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-[#c9a818] disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0"
            >
              {running ? "Analyzing..." : "Run KIE test"}
            </button>
          </div>
        </form>

        {status && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {status}
          </div>
        )}
      </section>

      {thoughts.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-700">Model reasoning</h3>
          <div className="mt-3 space-y-2">
            {thoughts.map((thought, index) => (
              <p key={`${index}-${thought.slice(0, 24)}`} className="text-sm text-neutral-600">
                {thought}
              </p>
            ))}
          </div>
        </section>
      )}

      {toolEvents.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Tool calls</h3>
          <div className="mt-3 space-y-3">
            {toolEvents.map((event, index) => (
              <div key={`${event.kind}-${event.name}-${index}`} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {event.kind === "call" ? "Called" : "Result"} · {event.name}
                </p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-neutral-700">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </section>
      )}

      {(responseText || done) && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900">Analysis report</h3>
          {responseText ? (
            <div className="prose prose-sm mt-4 max-w-none whitespace-pre-wrap text-sm text-neutral-800">
              {responseText}
            </div>
          ) : (
            <p className="mt-4 text-sm text-neutral-500">Analysis finished with no text output.</p>
          )}
          {done && (
            <p className="mt-4 text-xs text-neutral-400">KIE Gemini analysis complete.</p>
          )}
        </section>
      )}

      {reviewQueueCount !== null && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-emerald-900">Review queue</h3>
          <p className="mt-2 text-sm text-emerald-800">
            {reviewQueueCount === 0
              ? "No fraudulent copycats were found to queue. The brand intake was still saved."
              : `${reviewQueueCount} suspected copycat${reviewQueueCount === 1 ? "" : "s"} added to the review queue.`}
          </p>
          <Link
            to="/dashboard/review"
            className="mt-4 inline-flex rounded-full bg-[#e2c523] px-5 py-2 text-sm font-semibold text-neutral-900"
          >
            Open review queue
          </Link>
          {queuedResults.length > 0 && (
            <div className="mt-4 divide-y divide-emerald-200 rounded-xl border border-emerald-200 bg-white">
              {queuedResults.map((result) => (
                <div key={result.id} className="px-4 py-3">
                  <ListingLink title={result.listingTitle} url={result.listingUrl} />
                  <p className="mt-1 text-xs text-neutral-500">
                    {labelForMarketplace(result.marketplace)} · {result.confidence}% confidence
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function ReviewQueueContent() {
  const tracker = useTrackerStore()
  const reviewResults = tracker.scanResults.filter((result) => REVIEW_QUEUE_STATUSES.has(result.status))
  const actionedResults = tracker.scanResults.filter((result) => ACTIONED_STATUSES.has(result.status))
  const activeSuppressions = (tracker.suppressedListings ?? []).filter((entry) => !entry.liftedAt)

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Human review queue</h2>
          <p className="mt-1 text-xs text-neutral-500">
            New hits only. Listings you rejected or sent takedowns for are suppressed from future scans.
          </p>
        </div>
        <div className="divide-y divide-neutral-200">
          {reviewResults.length === 0 && (
            <p className="px-5 py-8 text-sm text-neutral-500">No listings waiting for review.</p>
          )}
          {reviewResults.map((result) => (
            <div key={result.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <ListingLink title={result.listingTitle} url={result.listingUrl} />
                  <StatusBadge status={result.status} />
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {labelForMarketplace(result.marketplace)} - {result.sellerName} - {result.confidence}% confidence
                </p>
                <p className="mt-2 text-sm text-neutral-600">{result.matchReason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ViewListingLink url={result.listingUrl} />
                  {result.evidenceUrls
                    .filter((evidenceUrl) => evidenceUrl !== result.listingUrl)
                    .slice(0, 2)
                    .map((evidenceUrl) => {
                      let label = "Evidence"
                      try {
                        label = new URL(evidenceUrl).hostname.replace(/^www\./, "")
                      } catch {
                        // keep default
                      }
                      return (
                        <a
                          key={evidenceUrl}
                          href={evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
                        >
                          {label} ↗
                        </a>
                      )
                    })}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void tracker.updateResultStatus(result.id, "approved")}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700"
                >
                  Legit
                </button>
                <button
                  type="button"
                  onClick={() => void tracker.updateResultStatus(result.id, "rejected")}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-600"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => void tracker.createTakedownRequest(result.id)}
                  className="rounded-full bg-[#e2c523] px-4 py-2 text-xs font-semibold text-neutral-900"
                >
                  Prepare takedown
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {(actionedResults.length > 0 || activeSuppressions.length > 0) && (
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Actioned & suppressed</h2>
            <p className="mt-1 text-xs text-neutral-500">
              These listings won&apos;t re-enter the review queue unless they reappear after a takedown.
            </p>
          </div>
          <div className="divide-y divide-neutral-200">
            {actionedResults.map((result) => (
              <div key={result.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ListingLink title={result.listingTitle} url={result.listingUrl} className="text-sm font-medium text-neutral-700" />
                  <StatusBadge status={result.status} />
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {labelForMarketplace(result.marketplace)} · {result.sellerName}
                </p>
              </div>
            ))}
            {activeSuppressions
              .filter(
                (entry) =>
                  !actionedResults.some(
                    (result) =>
                      result.listingUrl === entry.listingUrl && result.brandProfileId === entry.brandProfileId,
                  ),
              )
              .map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-700">
                      {entry.listingTitle ?? entry.listingUrl}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Suppressed · {entry.reason.replaceAll("_", " ")}
                      {entry.monitorForReturn ? " · monitoring for return" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void tracker.liftSuppressedListing(entry.id)}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600"
                  >
                    Allow again
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  )
}

function AlertsContent() {
  const tracker = useTrackerStore()
  const resultById = useMemo(
    () => new Map(tracker.scanResults.map((result) => [result.id, result])),
    [tracker.scanResults],
  )

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">Owner alerts</h2>
      <div className="mt-4 space-y-3">
        {tracker.alerts.map((alert) => {
          const result = resultById.get(alert.scanResultId)
          return (
          <div key={alert.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-neutral-900">{alert.title}</p>
              <StatusBadge status={alert.status} />
            </div>
            <p className="mt-2 text-sm text-neutral-600">{alert.message}</p>
            {result && (
              <div className="mt-3 space-y-2">
                <ListingLink title={result.listingTitle} url={result.listingUrl} className="text-sm font-medium" />
                <ViewListingLink url={result.listingUrl} />
              </div>
            )}
          </div>
        )})}
      </div>
    </section>
  )
}

function TakedownsContent() {
  const tracker = useTrackerStore()
  const [lastSubmitMessage, setLastSubmitMessage] = useState<string | null>(null)
  const resultById = useMemo(() => {
    return new Map(tracker.scanResults.map((result) => [result.id, result]))
  }, [tracker.scanResults])
  const brandById = useMemo(() => {
    return new Map(tracker.brandProfiles.map((brand) => [brand.id, brand]))
  }, [tracker.brandProfiles])
  const submissionsByRequest = useMemo(() => {
    const map = new Map<string, typeof tracker.dmcaSubmissions>()
    for (const submission of tracker.dmcaSubmissions) {
      const rows = map.get(submission.takedownRequestId) ?? []
      rows.push(submission)
      map.set(submission.takedownRequestId, rows)
    }
    return map
  }, [tracker.dmcaSubmissions])

  async function handleApproveAndSubmit(requestId: string) {
    setLastSubmitMessage(null)
    try {
      const payload = await tracker.approveAndSubmitTakedown(requestId)
      setLastSubmitMessage(payload.submitResult.message)
    } catch (error) {
      setLastSubmitMessage(error instanceof Error ? error.message : "Submit failed")
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">DMCA automation</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          From the review queue, click Takedown to auto-generate a 512(c)(3) notice with your brand
          intake assets. Approve and submit routes the claim through the right channel — email for
          Shopify and independent sites, portal links for Amazon/eBay/Etsy, or manual export when
          needed.
        </p>
        <p className="mt-2 text-xs text-neutral-400">
          Live email delivery uses Resend (<code className="font-mono">RESEND_API_KEY</code> +{" "}
          <code className="font-mono">DMCA_FROM_EMAIL</code>). Without it, submissions run in dry-run
          mode and log the notice.
        </p>
      </section>

      {lastSubmitMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {lastSubmitMessage}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Takedown requests</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Prepared notices are stored on each request. Submit after you review the package.
          </p>
        </div>
        <div className="divide-y divide-neutral-200">
          {tracker.takedownRequests.length === 0 && (
            <p className="px-5 py-8 text-sm text-neutral-500">
              No takedown requests yet. Flag a listing from the review queue.
            </p>
          )}
          {tracker.takedownRequests.map((request) => {
            const result = resultById.get(request.scanResultId) as ScanResult | undefined
            const brand = brandById.get(request.brandProfileId)
            const dmcaPackage = result && brand ? buildDmcaPackage(brand, result, request) : null
            const submissions = submissionsByRequest.get(request.id) ?? []
            const latestSubmission = submissions[0]
            const channel = latestSubmission?.submissionPayload?.channel as
              | { label?: string; method?: string; portalUrl?: string; recipientEmail?: string }
              | undefined

            return (
              <div key={request.id} className="grid gap-4 px-5 py-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {result ? (
                        <ListingLink title={result.listingTitle} url={result.listingUrl} />
                      ) : (
                        <p className="text-sm font-semibold text-neutral-900">Unknown listing</p>
                      )}
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {request.claimType} claim ·{" "}
                      {request.submittedTo ? labelForMarketplace(request.submittedTo) : "pending channel"}
                      {channel?.method ? ` · ${channel.method}` : ""}
                    </p>
                    {channel?.recipientEmail && (
                      <p className="mt-1 text-xs text-neutral-500">Email: {channel.recipientEmail}</p>
                    )}
                    {latestSubmission?.externalCaseId && (
                      <p className="mt-1 text-xs font-mono text-neutral-500">
                        Case ID: {latestSubmission.externalCaseId}
                      </p>
                    )}
                    {result && (
                      <div className="mt-3">
                        <ViewListingLink url={result.listingUrl} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void tracker.prepareTakedown(request.id)}
                      className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50"
                      disabled={tracker.busy || request.status === "submitted"}
                    >
                      Regenerate notice
                    </button>
                    {channel?.portalUrl && (
                      <a
                        href={channel.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700"
                      >
                        Open portal ↗
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleApproveAndSubmit(request.id)}
                      className="rounded-full bg-[#e2c523] px-4 py-2 text-xs font-semibold text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={tracker.busy || request.status === "submitted"}
                    >
                      Approve and submit
                    </button>
                  </div>
                </div>
                {dmcaPackage && (
                  <details className="rounded-xl border border-neutral-200 bg-neutral-50 p-4" open>
                    <summary className="cursor-pointer text-xs font-semibold text-neutral-700">
                      DMCA notice (512(c)(3))
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(dmcaPackage.body)}
                        className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600"
                      >
                        Copy notice
                      </button>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-neutral-900">{dmcaPackage.subject}</p>
                    <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-relaxed text-neutral-600">
                      {request.dmcaStatement || dmcaPackage.body}
                    </pre>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function ScanScheduleContent() {
  const tracker = useTrackerStore()
  const brandById = useMemo(
    () => new Map(tracker.brandProfiles.map((brand) => [brand.id, brand])),
    [tracker.brandProfiles],
  )

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Automatic scan schedule</h2>
      <p className="mt-2 max-w-2xl text-sm text-neutral-500">
        Each onboarded brand is scanned twice per day. AM runs cover ecommerce marketplaces via PublicWWW and
        Serper; PM runs cover piracy sources (creators) or a second ecommerce pass. Searches use schedule
        keywords plus IP assets from brand intake.
      </p>

      <div className="mt-6 space-y-3">
        {tracker.scanSchedules.length === 0 && (
          <p className="text-sm text-neutral-500">No schedules yet. Add a brand to start monitoring.</p>
        )}
        {tracker.scanSchedules.map((schedule) => {
          const brand = brandById.get(schedule.brandProfileId)
          return (
            <div key={schedule.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{brand?.brandName ?? "Brand"}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    AM {schedule.amRunAt} UTC · {schedule.amMarketplaces.length} platforms · PM{" "}
                    {schedule.pmRunAt} UTC · {schedule.pmMarketplaces.length} platforms
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Keywords: {schedule.keywords.slice(0, 3).join(", ")}
                    {schedule.lastAmRunAt ? ` · Last AM: ${new Date(schedule.lastAmRunAt).toLocaleString()}` : ""}
                    {schedule.lastPmRunAt ? ` · Last PM: ${new Date(schedule.lastPmRunAt).toLocaleString()}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={tracker.busy}
                  onClick={() => void tracker.toggleSchedule(schedule.id, !schedule.enabled)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    schedule.enabled
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-neutral-200 text-neutral-600"
                  }`}
                >
                  {schedule.enabled ? "Monitoring on" : "Monitoring off"}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ReportsContent() {
  const tracker = useTrackerStore()

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">Reports</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs text-neutral-500">Scan jobs</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{tracker.scanJobs.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs text-neutral-500">Results</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{tracker.scanResults.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs text-neutral-500">Claims</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{tracker.takedownRequests.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs text-neutral-500">Schedules</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{tracker.scanSchedules.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs text-neutral-500">Submissions</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{tracker.dmcaSubmissions.length}</p>
        </div>
      </div>
    </section>
  )
}

export function TrackerDashboardPage() {
  return (
    <DashboardShell>
      <Routes>
        <Route index element={<OverviewContent />} />
        <Route path="brand-intake" element={<BrandIntakeContent />} />
        <Route path="scan-schedule" element={<ScanScheduleContent />} />
        <Route path="find-copycats" element={<FindCopycatsContent />} />
        <Route path="find-copycats-test" element={<FindCopycatsTestContent />} />
        <Route path="review" element={<ReviewQueueContent />} />
        <Route path="alerts" element={<AlertsContent />} />
        <Route path="takedowns" element={<TakedownsContent />} />
        <Route path="reports" element={<ReportsContent />} />
      </Routes>
    </DashboardShell>
  )
}
