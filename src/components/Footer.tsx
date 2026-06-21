import { Logo } from "./Logo"

const solutions = [
  "Brand Protection", "Content Protection", "Content Theft", "Top Brand Protection",
  "eCommerce Protection", "Amazon Protection", "Copyright Protection", "Trademark Monitoring",
  "Copyright Monitoring", "Alert System", "Image Theft", "Anti Counterfeit",
  "AI Protection Software", "Website Takedown", "DMCA Takedown", "Takedown Notice",
  "DMCA Checker", "Counter DMCA",
]

const company = ["Home", "Blog", "Privacy Policy", "Terms & Conditions", "About"]

const help = ["FAQ's", "Dispute a Report"]

export function Footer() {
  return (
    <footer className="border-t border-line py-16">
      <div className="section-container">
        <div className="grid gap-12 lg:grid-cols-4">
          <div>
            <Logo />
            <div className="mt-6 space-y-1 text-sm text-muted">
              <p>Contact Us:</p>
              <a href="mailto:support@moodna.com" className="text-accent-light hover:text-text">
                support@moodna.com
              </a>
              <p className="pt-2 text-faint">131 Continental Dr, Suite 305</p>
              <p className="text-faint">Newark, DE 19713</p>
              <a href="tel:6466329921" className="block pt-1 text-faint hover:text-muted">
                646-632-9921
              </a>
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Solutions</p>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
              {solutions.map((link) => (
                <li key={link}>
                  <a href="#" className="text-[12px] text-muted transition-colors hover:text-text">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Company</p>
            <ul className="mt-4 space-y-2.5">
              {company.map((link) => (
                <li key={link}>
                  <a href="#" className="text-[13px] text-muted transition-colors hover:text-text">
                    {link}
                  </a>
                </li>
              ))}
            </ul>

            <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Help</p>
            <ul className="mt-4 space-y-2.5">
              {help.map((link) => (
                <li key={link}>
                  <a href="#" className="text-[13px] text-muted transition-colors hover:text-text">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Reviews</p>
            <ul className="mt-4 space-y-2.5">
              {["Trustpilot Reviews", "Producthunt Reviews", "G2 Reviews"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-[13px] text-muted transition-colors hover:text-text">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="divider-glow mt-14 mb-8" />

        <p className="text-center font-mono text-[11px] text-faint">© Moodna 2026</p>
      </div>
    </footer>
  )
}
