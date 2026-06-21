import { BookCallButton } from "./booking/BookCallButton"
import { ScrollLink } from "./ScrollLink"

const heroPoints = [
  "See exactly who's stealing your sales right now",
  "Find out how much revenue you're losing every month",
  "Only pay per successful takedown",
]

function HeroCheckIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-accent-light"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8 12.5 10.5 15 16 9.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-14 pb-20 md:pt-20 md:pb-28">
      <div className="section-container relative">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="heading-xl">
            <span className="gradient-text">Find and Takedown</span>
            <br />
            <span className="gradient-text-accent">Copycats &amp; Infringers</span>
          </h1>

          <ul className="mx-auto mt-8 inline-flex flex-col gap-3 text-left">
            {heroPoints.map((item) => (
              <li key={item} className="flex items-center gap-3 text-[15px] text-muted">
                <HeroCheckIcon />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <BookCallButton className="btn-primary-lg">
              Book a call
            </BookCallButton>
          </div>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            { title: "Get a Step-by-step Removal Plan", href: "#path" },
            { title: "Free 15-Min 360° Threat Report", href: "#cta" },
            { title: "See the Real Cost of Copycats", href: "#costs" },
          ].map((link) => (
            <ScrollLink
              key={link.title}
              href={link.href}
              className="premium-card premium-card-glow group p-6 text-center transition-transform duration-300 hover:-translate-y-1"
            >
              <p className="text-sm font-semibold text-text group-hover:text-accent-light md:text-[15px]">
                {link.title}
              </p>
            </ScrollLink>
          ))}
        </div>
      </div>
    </section>
  )
}
