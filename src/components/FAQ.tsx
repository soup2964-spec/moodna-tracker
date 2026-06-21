import { useState } from "react"
import { SectionHeader } from "./Logo"

const faqs = [
  {
    q: "How does Moodna work?",
    a: "Moodna is your digital watchdog. It constantly scans websites, marketplaces, ads, and social platforms to sniff out copycats and impersonators. Offenders appear in your dashboard, where our team verifies each case and handles DMCA takedowns, follow-ups, and post-removal monitoring so they don't quietly come back.",
  },
  {
    q: "Can't my VA handle this manually?",
    a: "VAs lack IP law expertise and platform loopholes knowledge. They can't scale to billions of pages or handle escalations like domain seizures and payment processor lockouts.",
  },
  {
    q: "How effective is Moodna?",
    a: "95% takedown success rate across 100K+ enforcements. We track real dollars saved and real ROI, not vanity metrics.",
  },
  {
    q: "How long does a DMCA takedown take?",
    a: "Most complete within 24–72 hours depending on the platform. Urgent cases in Slack are often handled within minutes.",
  },
  {
    q: "What is a DMCA counter notification?",
    a: "A counter notification is a legal response from an infringer disputing your takedown. Our team handles these on your behalf with proper legal documentation.",
  },
  {
    q: "What happens if I get a DMCA counter notification?",
    a: "We review the counter notification, verify your rights, and respond appropriately. Most counter notifications are frivolous and resolved quickly.",
  },
  {
    q: "Won't the infringer just create a new store?",
    a: "We track repeat offenders and escalate through domain seizures, host shutdowns, and payment processor lockouts. Persistent infringers don't get a free pass.",
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="border-y border-line py-28 md:py-36">
      <div className="section-container">
        <SectionHeader title="Frequently Asked Questions" />

        <div className="mx-auto mt-14 max-w-2xl">
          {faqs.map((faq, i) => (
            <div key={faq.q} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between py-5 text-left transition-colors hover:text-text"
              >
                <span className="pr-4 text-[15px] font-medium">{faq.q}</span>
                <span className="shrink-0 font-mono text-sm text-accent-light">
                  {open === i ? "−" : "+"}
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  open === i ? "max-h-56 pb-5 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <p className="text-[14px] leading-[1.65] text-muted">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
