import { SectionHeader } from "./Logo"

export function CostSection() {
  return (
    <section id="costs" className="border-y border-line py-28 md:py-36">
      <div className="section-container">
        <SectionHeader
          title="The Real Costs of Copycats"
          description="Copycats aren't just annoying, they're bleeding your brand dry."
        />

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          <article className="premium-card p-7">
            <h3 className="heading-md">Destroyed Reputation</h3>
            <p className="mt-4 text-[15px] leading-[1.65] text-muted">
              Customers don&apos;t blame scammers. They blame you. Bad reviews pile up,
              support tickets flood in, and trust vanishes overnight.
            </p>
            <div className="mt-5 rounded-xl border border-line bg-white/[0.02] p-4">
              <div className="flex items-center gap-0.5" aria-label="1 out of 5 stars">
                <span className="text-sm text-danger">★</span>
                <span className="text-sm text-faint">★★★★</span>
              </div>
              <p className="mt-2 text-sm text-muted">&ldquo;Terrible product quality&rdquo;</p>
              <p className="mt-2 text-sm font-medium">Ted</p>
            </div>
          </article>

          <article className="premium-card overflow-hidden">
            <div className="p-7">
              <h3 className="heading-md">Stolen Revenue</h3>
              <p className="mt-4 text-[15px] leading-[1.65] text-muted">
                Every fake sale is money gone. Brands lose{" "}
                <strong className="text-text">8–15% of revenue</strong> to copycats,
                cutting into growth and long-term profit.
              </p>
            </div>
            <div className="border-t border-line bg-white/[0.02] px-7 py-5">
              <p className="text-xs text-faint">Expected earnings</p>
              <p className="font-display mt-1 text-2xl text-text">$100,000</p>
              <p className="mt-1 text-lg font-medium text-danger">-$50,000</p>
            </div>
          </article>

          <article className="premium-card p-7">
            <h3 className="heading-md">Bleeding Ad Spend &amp; SEO</h3>
            <p className="mt-4 text-[15px] leading-[1.65] text-muted">
              Copycats bid on your keywords, driving up CPM&apos;s and CPC&apos;s. They
              flood Google with clones and bury your rankings. You spend more, get less.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Nike", "N1ke", "Nikes Athlete", "Nikezz", "NikeSportss"].map((fake) => (
                <span
                  key={fake}
                  className="rounded-full border border-danger/20 bg-danger/5 px-3 py-1 text-xs text-danger line-through"
                >
                  {fake}
                </span>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
