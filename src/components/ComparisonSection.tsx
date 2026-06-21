import { SectionHeader } from "./Logo"

const comparisons = [
  { title: "Virtual Assistant", cons: "VAs don't know IP law or platform loopholes." },
  { title: "In-house team", cons: "Already stretched thin. No bandwidth or expertise." },
  { title: "Lawyers", cons: "$500/hr to fill out forms. Costly, slow, and still lose to scammers." },
]

const axes = ["Price", "Experience", "Speed", "Scalability"]

export function ComparisonSection() {
  return (
    <section className="border-y border-line py-28 md:py-36">
      <div className="section-container">
        <SectionHeader title="Moodna vs a VA" />

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {comparisons.map((item) => (
            <article key={item.title} className="premium-card p-7">
              <div className="mb-6 flex flex-wrap gap-2">
                {axes.map((axis) => (
                  <span
                    key={axis}
                    className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[10px] text-faint"
                  >
                    {axis}
                  </span>
                ))}
              </div>
              <h3 className="heading-md text-lg">{item.title}</h3>
              <p className="mt-3 text-[15px] leading-[1.65] text-muted">{item.cons}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
