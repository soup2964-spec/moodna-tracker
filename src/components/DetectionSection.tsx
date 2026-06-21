import { SectionHeader } from "./Logo"

function DashboardMockup() {
  return (
    <div className="premium-card premium-card-glow overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <p className="font-mono text-[10px] uppercase text-faint">Moodna Dashboard</p>
      </div>
      <div className="p-5">
        <div className="flex gap-8 border-b border-line pb-4">
          <div>
            <p className="font-display text-3xl">200</p>
            <p className="text-xs text-faint">Potential infringers</p>
          </div>
          <div>
            <p className="font-display text-3xl text-accent-light">234,420</p>
            <p className="text-xs text-faint">Combined traffic</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {[
            { name: "PrimeTrendz listing", match: "100% similarity", platform: "Meta Ads" },
            { name: "fake-shop-clone", match: "98% similarity", platform: "Instagram" },
          ].map((row) => (
            <div key={row.name} className="flex items-center justify-between rounded-lg border border-line bg-white/[0.02] px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{row.name}</p>
                <p className="text-xs text-faint">{row.platform} · {row.match}</p>
              </div>
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                Flagged
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ApproveDecline() {
  return (
    <div className="premium-card p-5">
      <div className="mb-3 flex gap-2">
        {["Decline", "Decline", "Decline"].map((label, i) => (
          <button key={`d-${i}`} type="button" className="flex-1 rounded-xl border border-line py-2.5 text-xs font-medium text-muted">
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {["Approve", "Approve", "Approve"].map((label, i) => (
          <button key={`a-${i}`} type="button" className="flex-1 rounded-xl bg-success/15 py-2.5 text-xs font-medium text-success ring-1 ring-success/20">
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function TakedownBrowser() {
  return (
    <div className="premium-card premium-card-glow overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-danger/50" />
          <span className="h-2 w-2 rounded-full bg-white/10" />
          <span className="h-2 w-2 rounded-full bg-white/10" />
        </div>
        <span className="font-mono text-[11px] text-faint">copycat.com</span>
      </div>
      <div className="p-10 text-center">
        <p className="text-sm font-medium text-muted">ERR_INTERNET_DISCONNECTED</p>
        <p className="font-display mt-4 text-2xl text-success">This site has been taken down</p>
        <p className="mt-2 font-mono text-[11px] text-faint">copycat.com</p>
      </div>
    </div>
  )
}

function EnforcementPipeline() {
  const actions = [
    { type: "DMCA Takedown", target: "PrimeTrendz · Amazon", status: "Completed", tone: "success" as const },
    { type: "Domain Seizure", target: "copycat-store.com", status: "Completed", tone: "success" as const },
    { type: "Host Shutdown", target: "infringer-host.net", status: "In progress", tone: "accent" as const },
    { type: "Payment Lockout", target: "Stripe merchant", status: "Queued", tone: "muted" as const },
  ]

  const badgeClass = {
    success: "bg-success/10 text-success",
    accent: "bg-accent/10 text-accent-light",
    muted: "bg-white/[0.06] text-muted",
  }

  return (
    <div className="premium-card premium-card-glow overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <p className="font-mono text-[10px] uppercase text-faint">Enforcement Pipeline</p>
      </div>
      <div className="space-y-2 p-5">
        {actions.map((action) => (
          <div
            key={action.type}
            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/[0.02] px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{action.type}</p>
              <p className="truncate text-xs text-faint">{action.target}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass[action.tone]}`}
            >
              {action.status}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-4 py-3">
        <p className="font-mono text-[10px] text-success">Target status · infringer offline</p>
      </div>
    </div>
  )
}

const features = [
  {
    title: "AI-Powered Detection",
    body: "We scan billions of sites, marketplaces, and platforms daily. Image recognition, keyword sweeps, reverse searches, copycats can't hide.",
    visual: "dashboard" as const,
  },
  {
    title: "Human Verification",
    body: "AI flags listings, humans confirm. Our expert enforcement team cuts the noise and false alarms so only real infringers get through.",
    visual: "approve" as const,
  },
  {
    title: "You Stay in Control",
    body: "Nothing moves without your approval. Review flagged cases in seconds, approve, and we strike. No mistakes, no friendly fire.",
    visual: "browser" as const,
  },
  {
    title: "Specialists Finish the Job",
    body: "DMCA takedowns, domain seizures, host shutdowns, payment processor lockouts. We don't stop until the infringer is deleted.",
    visual: "enforcement" as const,
  },
]

export function DetectionSection() {
  return (
    <section id="features" className="py-28 md:py-36">
      <div className="section-container">
        <SectionHeader
          title="AI Detection. Human Enforcement."
        />

        <div className="mt-20 space-y-24">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
                i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                <h3 className="heading-md">{feature.title}</h3>
                <p className="mt-4 text-[15px] leading-[1.65] text-muted">{feature.body}</p>
              </div>
              {feature.visual === "dashboard" && <DashboardMockup />}
              {feature.visual === "approve" && <ApproveDecline />}
              {feature.visual === "browser" && <TakedownBrowser />}
              {feature.visual === "enforcement" && <EnforcementPipeline />}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
