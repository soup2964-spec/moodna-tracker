import { useState } from "react"
import { SectionHeader } from "./Logo"

const ICON_CDN = "https://cdn.jsdelivr.net/npm/simple-icons@14.12.3/icons"

type Platform = {
  name: string
  slug: string
  local?: string
  wide?: boolean
  large?: boolean
  boost?: boolean
}

const platforms: Platform[] = [
  { name: "Amazon", slug: "amazon" },
  { name: "Walmart", slug: "walmart", large: true, boost: true },
  { name: "Meta", slug: "meta" },
  { name: "TikTok Shop", slug: "tiktok" },
  { name: "eBay", slug: "ebay", large: true },
  { name: "Google", slug: "google" },
  { name: "AliExpress", slug: "aliexpress", large: true, boost: true },
  { name: "Etsy", slug: "etsy" },
  { name: "Instagram", slug: "instagram" },
  { name: "Pinterest", slug: "pinterest" },
  { name: "Wordpress", slug: "wordpress" },
  { name: "Temu", slug: "temu", local: "/platform-icons/temu.svg" },
  { name: "SHEIN", slug: "shein", local: "/platform-icons/shein.svg", wide: true },
  { name: "Shopify", slug: "shopify" },
  { name: "Alibaba", slug: "alibabadotcom" },
]

function platformIconSrc(platform: Platform) {
  return platform.local ?? `${ICON_CDN}/${platform.slug}.svg`
}

function platformLogoClass(platform: Platform) {
  const classes = ["platform-logo"]
  if (platform.wide) classes.push("platform-logo-wide")
  if (platform.large) classes.push("platform-logo-lg")
  if (platform.boost) classes.push("platform-logo-boost")
  return classes.join(" ")
}

const benefits = [
  {
    title: "Boutique Approach",
    desc: "Direct access to founder, CTO, COO, and lead agent in Slack, no faceless software.",
  },
  {
    title: "No Lock-In Contracts",
    desc: "Stay because we deliver, not because you're trapped in a contract. If we don't crush it, walk anytime.",
  },
  {
    title: "24/7 Monitoring",
    desc: "Copycats don't sleep. Neither do we. Our scanners nuke infringers across every major platform, 24/7.",
  },
  {
    title: "Week/Month Reports",
    desc: "Crystal-clear reports weekly and monthly on takedowns, wins, stats and financial impact in Slack.",
  },
  {
    title: "Slack Support",
    desc: "No tickets. No \"3-5 business days.\" We're in Slack with you, responding within 30 minutes.",
  },
]

function PlatformCard({ platform }: { platform: Platform }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="premium-card flex h-full flex-col items-center px-3 py-5 text-center transition-all duration-300 hover:border-accent/20">
      <div className="flex h-10 w-full shrink-0 items-center justify-center overflow-visible">
        {!failed ? (
          <img
            src={platformIconSrc(platform)}
            alt={`${platform.name} logo`}
            className={platformLogoClass(platform)}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-bold text-muted">
            {platform.name.charAt(0)}
          </span>
        )}
      </div>
      <span className="mt-2 flex min-h-[2.5rem] items-start justify-center text-[11px] font-medium leading-tight text-muted">
        {platform.name}
      </span>
    </div>
  )
}

export function PlatformsSection() {
  return (
    <>
      <section id="platforms" className="py-28 md:py-36">
        <div className="section-container">
          <SectionHeader title="Supporting All Major Platforms" />

          <div className="mt-14 grid grid-cols-3 items-stretch gap-3 sm:grid-cols-5 md:grid-cols-5">
            {platforms.map((platform) => (
              <PlatformCard key={platform.name} platform={platform} />
            ))}
          </div>
          <p className="mt-6 text-center text-sm font-medium text-accent-light">
            + full coverage on 147 more!
          </p>
        </div>
      </section>

      <section id="results" className="border-y border-line py-28 md:py-36">
        <div className="section-container">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {benefits.map((b, i) => (
              <article
                key={b.title}
                className={[
                  "premium-card premium-card-glow p-7",
                  i < 3 ? "lg:col-span-2" : "",
                  i === 3 ? "lg:col-start-2 lg:col-span-2" : "",
                  i === 4 ? "lg:col-start-4 lg:col-span-2" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <h3 className="heading-md text-lg">{b.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.65] text-muted">{b.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
