import { useMemo, useState, type FormEvent } from "react"
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom"
import { LeadFinderContent } from "../components/LeadFinderContent"
import { buildDmcaPackage } from "../lib/dmcaTemplates"
import {
  creatorPiracyMarketplaces,
  ecommerceMarketplaces,
  getScanTargetLabel,
  isCreatorProfileUrl,
  scanTargets,
} from "../lib/scanTargets"
import { useTrackerStore } from "../lib/trackerStore"
import type { Marketplace, ScanResult } from "../lib/trackerTypes"

const ecommerceScanTargets = scanTargets.filter((target) => target.category === "ecommerce")
const creatorPiracyScanTargets = scanTargets.filter((target) => target.category === "creator_piracy")

const navItems = [
  { label: "Overview", to: "/dashboard", end: true },
  { label: "Brand intake", to: "/dashboard/brand-intake" },
  { label: "Find copycats", to: "/dashboard/find-copycats" },
  { label: "Review queue", to: "/dashboard/review" },
  { label: "Owner alerts", to: "/dashboard/alerts" },
  { label: "Takedowns", to: "/dashboard/takedowns" },
  { label: "Reports", to: "/dashboard/reports" },
  { label: "Lead finder", to: "/dashboard/lead-finder" },
]

const pageTitles: Record<string, string> = {
  "/dashboard": "Brand protection overview",
  "/dashboard/brand-intake": "Brand intake",
  "/dashboard/find-copycats": "Find copycats",
  "/dashboard/review": "Review queue",
  "/dashboard/alerts": "Owner alerts",
  "/dashboard/takedowns": "Takedowns",
  "/dashboard/reports": "Reports",
  "/dashboard/lead-finder": "Lead finder",
}

function labelForMarketplace(marketplace: Marketplace) {
  return getScanTargetLabel(marketplace)
}

function statusBadgeClass(status: string) {
  if (["removed", "approved", "submitted"].includes(status)) return "bg-emerald-50 text-emerald-700"
  if (["new", "awaiting_owner_approval", "takedown_requested"].includes(status)) {
    return "bg-amber-50 text-amber-800"
  }
  if (["rejected", "failed"].includes(status)) return "bg-red-50 text-red-700"
  return "bg-neutral-100 text-neutral-600"
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClass(status)}`}>
      {status.replaceAll("_", " ")}
    </span>
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

          <main className="flex-1 space-y-6 p-5 lg:p-8">{children}</main>
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
                  <p className="text-sm font-medium text-neutral-900">{item.listingTitle}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {labelForMarketplace(item.marketplace)} - {item.confidence}% confidence
                  </p>
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    tracker.submitBrandIntake({ websiteUrl })
    setWebsiteUrl("")
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Paste a brand link</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Add the official website for an ecom brand or creator profile (OnlyFans, Fansly, Patreon).
          Moodna uses that link as the source of truth to discover starter IP assets like the brand name,
          domain, logo source, product pages, and copyright signals.
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
            className="rounded-xl bg-[#e2c523] px-6 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-[#c9a818] sm:shrink-0"
          >
            Get IP assets
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {["Brand/domain", "Logo source", "Product pages", "Product images", "Copyright signals"].map((item) => (
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

            return (
            <div key={profile.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-semibold text-neutral-900">{profile.brandName}</p>
              <p className="mt-1 text-xs text-neutral-500">{profile.websiteUrl}</p>
              <p className="mt-2 text-xs text-neutral-400">
                {assets.length} IP assets · {productImages.length} product images
              </p>
              {productImages.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {productImages.slice(0, 3).map((asset) => (
                    <div
                      key={asset.id}
                      className="flex aspect-square items-center justify-center rounded-lg border border-neutral-200 bg-white p-2 text-center text-[10px] text-neutral-400"
                    >
                      Product image
                    </div>
                  ))}
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
  const [brandProfileId, setBrandProfileId] = useState(tracker.brandProfiles[0]?.id ?? "")
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<Marketplace[]>(["amazon", "walmart", "ebay"])
  const [keywords, setKeywords] = useState("brand name, product name, official product")
  const [riskThreshold, setRiskThreshold] = useState(75)

  const selectedBrand = tracker.brandProfiles.find((profile) => profile.id === brandProfileId)
  const creatorProfileSelected = selectedBrand ? isCreatorProfileUrl(selectedBrand.websiteUrl) : false

  function toggleMarketplace(marketplace: Marketplace) {
    setSelectedMarketplaces((current) =>
      current.includes(marketplace)
        ? current.filter((item) => item !== marketplace)
        : [...current, marketplace],
    )
  }

  function selectCreatorPiracySources() {
    setSelectedMarketplaces((current) => [...new Set([...current, ...creatorPiracyMarketplaces])])
  }

  function selectEcommerceSources() {
    setSelectedMarketplaces((current) => [...new Set([...current, ...ecommerceMarketplaces])])
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!brandProfileId || selectedMarketplaces.length === 0) return
    tracker.startScan({
      brandProfileId,
      marketplaces: selectedMarketplaces,
      keywords,
      frequency: "weekly",
      riskThreshold,
    })
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Find copycats</h2>
      <p className="mt-2 max-w-2xl text-sm text-neutral-500">
        Run scans across ecommerce marketplaces and common creator piracy sources — Reddit, Telegram,
        Discord, Kemono/Coomer, Bunkr, SimpCity, Thothub, and more.
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

        {creatorProfileSelected && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Creator profile detected. Add piracy-source scanning to catch leaked OnlyFans content across
            forums, channels, and file dumps.
            <button
              type="button"
              onClick={selectCreatorPiracySources}
              className="ml-2 font-semibold underline underline-offset-2"
            >
              Select all piracy sources
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-neutral-900">Ecommerce marketplaces</h3>
              <button
                type="button"
                onClick={selectEcommerceSources}
                className="text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
              >
                Select all
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {ecommerceScanTargets.map((marketplace) => (
                <label
                  key={marketplace.id}
                  className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedMarketplaces.includes(marketplace.id)}
                    onChange={() => toggleMarketplace(marketplace.id)}
                  />
                  {marketplace.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-neutral-900">Creator piracy sources</h3>
              <button
                type="button"
                onClick={selectCreatorPiracySources}
                className="text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
              >
                Select all
              </button>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Common places where stolen OnlyFans and creator content gets reposted.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {creatorPiracyScanTargets.map((marketplace) => (
                <label
                  key={marketplace.id}
                  className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedMarketplaces.includes(marketplace.id)}
                    onChange={() => toggleMarketplace(marketplace.id)}
                  />
                  {marketplace.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <textarea
          value={keywords}
          onChange={(event) => setKeywords(event.target.value)}
          rows={3}
          placeholder={
            creatorProfileSelected
              ? "@handle, handle leaks, handle onlyfans, handle mega"
              : "Keywords, product names, brand variants"
          }
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />

        <label className="block text-sm text-neutral-600">
          Risk threshold: <span className="font-semibold text-neutral-900">{riskThreshold}%</span>
          <input
            type="range"
            min="50"
            max="95"
            value={riskThreshold}
            onChange={(event) => setRiskThreshold(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>

        <button
          type="submit"
          className="rounded-full bg-[#e2c523] px-6 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-[#c9a818]"
        >
          Start scan
        </button>
      </form>
    </section>
  )
}

function ReviewQueueContent() {
  const tracker = useTrackerStore()
  const results = tracker.scanResults.filter((result) => result.status !== "removed")

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Human review queue</h2>
        <p className="mt-1 text-xs text-neutral-500">Approve only legitimate infringement candidates before alerts or takedowns.</p>
      </div>
      <div className="divide-y divide-neutral-200">
        {results.map((result) => (
          <div key={result.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-neutral-900">{result.listingTitle}</p>
                <StatusBadge status={result.status} />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {labelForMarketplace(result.marketplace)} - {result.sellerName} - {result.confidence}% confidence
              </p>
              <p className="mt-2 text-sm text-neutral-600">{result.matchReason}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => tracker.updateResultStatus(result.id, "approved")}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700"
              >
                Legit
              </button>
              <button
                type="button"
                onClick={() => tracker.updateResultStatus(result.id, "rejected")}
                className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-600"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => tracker.createTakedownRequest(result.id)}
                className="rounded-full bg-[#e2c523] px-4 py-2 text-xs font-semibold text-neutral-900"
              >
                Takedown
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function AlertsContent() {
  const tracker = useTrackerStore()

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">Owner alerts</h2>
      <div className="mt-4 space-y-3">
        {tracker.alerts.map((alert) => (
          <div key={alert.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-neutral-900">{alert.title}</p>
              <StatusBadge status={alert.status} />
            </div>
            <p className="mt-2 text-sm text-neutral-600">{alert.message}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function TakedownsContent() {
  const tracker = useTrackerStore()
  const resultById = useMemo(() => {
    return new Map(tracker.scanResults.map((result) => [result.id, result]))
  }, [tracker.scanResults])
  const brandById = useMemo(() => {
    return new Map(tracker.brandProfiles.map((brand) => [brand.id, brand]))
  }, [tracker.brandProfiles])

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Takedown requests</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Owner-approved claims are packaged for marketplace submission and tracked here.
        </p>
      </div>
      <div className="divide-y divide-neutral-200">
        {tracker.takedownRequests.length === 0 && (
          <p className="px-5 py-8 text-sm text-neutral-500">No takedown requests yet.</p>
        )}
        {tracker.takedownRequests.map((request) => {
          const result = resultById.get(request.scanResultId) as ScanResult | undefined
          const brand = brandById.get(request.brandProfileId)
          const dmcaPackage = result && brand ? buildDmcaPackage(brand, result, request) : null
          return (
            <div key={request.id} className="grid gap-4 px-5 py-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-900">
                      {result?.listingTitle ?? "Unknown listing"}
                    </p>
                    <StatusBadge status={request.status} />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {request.claimType} claim - {request.submittedTo ? labelForMarketplace(request.submittedTo) : "not submitted"}
                  </p>
                  <p className="mt-2 text-sm text-neutral-600">{request.dmcaStatement}</p>
                </div>
                <button
                  type="button"
                  onClick={() => tracker.approveAndSubmitTakedown(request.id)}
                  className="rounded-full bg-[#e2c523] px-4 py-2 text-xs font-semibold text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={request.status === "submitted"}
                >
                  Approve and submit
                </button>
              </div>
              {dmcaPackage && (
                <details className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <summary className="cursor-pointer text-xs font-semibold text-neutral-700">
                    DMCA package preview
                  </summary>
                  <p className="mt-3 text-xs font-semibold text-neutral-900">{dmcaPackage.subject}</p>
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-relaxed text-neutral-600">
                    {dmcaPackage.body}
                  </pre>
                </details>
              )}
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
        <Route path="find-copycats" element={<FindCopycatsContent />} />
        <Route path="review" element={<ReviewQueueContent />} />
        <Route path="alerts" element={<AlertsContent />} />
        <Route path="takedowns" element={<TakedownsContent />} />
        <Route path="reports" element={<ReportsContent />} />
        <Route path="lead-finder" element={<LeadFinderContent />} />
      </Routes>
    </DashboardShell>
  )
}
