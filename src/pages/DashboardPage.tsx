import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom"

const navItems = [
  { label: "Overview", to: "/dashboard", end: true },
  { label: "Find copycats", to: "/dashboard/find-copycats" },
  { label: "Infringers", to: "/dashboard/infringers" },
  { label: "Takedowns", to: "/dashboard/takedowns" },
  { label: "Reports", to: "/dashboard/reports" },
]

const pageTitles: Record<string, string> = {
  "/dashboard": "Brand protection overview",
  "/dashboard/find-copycats": "Find copycats",
  "/dashboard/infringers": "Infringers",
  "/dashboard/takedowns": "Takedowns",
  "/dashboard/reports": "Reports",
}

const stats = [
  { label: "Active threats", value: "47", change: "+12 this week" },
  { label: "Takedowns", value: "128", change: "94% success rate" },
  { label: "Revenue protected", value: "$24.8k", change: "Last 30 days" },
  { label: "Platforms monitored", value: "163", change: "24/7 scanning" },
]

const recentCases = [
  { name: "PrimeTrendz listing", platform: "Amazon", status: "Takedown sent", severity: "High" },
  { name: "fake-shop-clone.com", platform: "Web", status: "Removed", severity: "Critical" },
  { name: "StyleDupes Store", platform: "TikTok Shop", status: "Under review", severity: "Medium" },
  { name: "knockoff-deals", platform: "eBay", status: "Flagged", severity: "High" },
]

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Removed"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Takedown sent"
        ? "bg-amber-50 text-amber-800"
        : status === "Under review"
          ? "bg-neutral-100 text-neutral-600"
          : "bg-red-50 text-red-700"

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tone}`}>
      {status}
    </span>
  )
}

function OverviewContent() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-medium text-neutral-500">{stat.label}</p>
            <p className="mt-2 font-display text-3xl text-neutral-900">{stat.value}</p>
            <p className="mt-2 text-xs text-neutral-400">{stat.change}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Recent cases</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Latest infringers detected across your monitored platforms
            </p>
          </div>
          <div className="divide-y divide-neutral-200">
            {recentCases.map((item) => (
              <div
                key={item.name}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">{item.name}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {item.platform} · {item.severity} priority
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">This week</h2>
          <p className="mt-1 text-xs text-neutral-500">Enforcement activity summary</p>

          <div className="mt-6 space-y-3">
            {[
              { label: "New infringers found", value: "12" },
              { label: "Takedowns completed", value: "9" },
              { label: "Pending approval", value: "3" },
              { label: "Estimated savings", value: "$6,420" },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3"
              >
                <span className="text-sm text-neutral-600">{row.label}</span>
                <span className="text-sm font-semibold text-neutral-900">{row.value}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="mt-6 w-full rounded-full bg-[#e2c523] px-6 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-[#c9a818]"
          >
            Review pending cases
          </button>
        </section>
      </div>
    </>
  )
}

function FindCopycatsContent() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Find copycats</h2>
      <p className="mt-2 max-w-2xl text-sm text-neutral-500">
        Paste a product URL, listing, or brand name and Moodna will scan marketplaces and the web for
        potential infringers.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Product URL, ASIN, or brand keyword…"
          className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
        <button
          type="button"
          className="rounded-xl bg-[#e2c523] px-6 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-[#c9a818] sm:shrink-0"
        >
          Start scan
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Platforms scanned", value: "163" },
          { label: "Matches found", value: "24" },
          { label: "High-risk listings", value: "7" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
          >
            <p className="text-xs text-neutral-500">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function PlaceholderContent({ title }: { title: string }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="mt-2 text-sm text-neutral-500">This section is coming soon.</p>
    </section>
  )
}

export function DashboardPage() {
  const { pathname } = useLocation()
  const pageTitle = pageTitles[pathname] ?? "Dashboard"

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
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
              ← Back to site
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-white lg:bg-neutral-50">
          <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-4 lg:px-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">Dashboard</p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-neutral-900">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-400 sm:block">
                Search infringers…
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-900">
                M
              </div>
            </div>
          </header>

          <main className="flex-1 space-y-6 p-5 lg:p-8">
            <Routes>
              <Route index element={<OverviewContent />} />
              <Route path="find-copycats" element={<FindCopycatsContent />} />
              <Route path="infringers" element={<PlaceholderContent title="Infringers" />} />
              <Route path="takedowns" element={<PlaceholderContent title="Takedowns" />} />
              <Route path="reports" element={<PlaceholderContent title="Reports" />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}
