import { SectionHeader } from "./Logo"

const steps = [
  {
    title: "Call with Brand Protection Expert",
    desc: "Quick call to map threats, gameplan and show exactly how we'll defend your brand. Optional if you're ready to dive in.",
  },
  {
    title: "Onboard and Sign Contract",
    desc: "Complete a simple Power of Attorney and short intake. Takes <30 minutes, then we're ready to strike.",
  },
  {
    title: "Dedicated Slack Channel",
    desc: "Dedicated channel with our team: real-time alerts, rapid responses, weekly summaries and direct access to leadership.",
  },
  {
    title: "Access to Dedicated Dashboard",
    desc: "Full visibility. Track takedowns, success rates, and real financial impact, all inside our platform.",
  },
]

export function PathSection() {
  return (
    <section id="path" className="border-y border-line py-28 md:py-36">
      <div className="section-container">
        <SectionHeader title="The Path to Your First Takedown" />

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <article key={step.title} className="premium-card p-7">
              <span className="font-mono text-[11px] text-accent-light">Step {i + 1}</span>
              <h3 className="mt-3 text-base font-medium text-text">{step.title}</h3>
              <p className="mt-2 text-[14px] leading-[1.65] text-muted">{step.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
