import { AuthNavLinks } from "./auth/AuthNavLinks"
import { BookCallButton } from "./booking/BookCallButton"
import { Logo } from "./Logo"

const navItems = [
  "Brand Protection",
  "Monitoring",
  "Anti-Theft Tools",
  "DMCA Services",
  "Blog",
]

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-line bg-base/90 backdrop-blur-xl">
      <nav className="section-container flex h-[4.75rem] items-center justify-between">
        <Logo showWordmark />

        <div className="hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <a
              key={item}
              href="#"
              className="text-[13px] font-medium text-muted transition-colors hover:text-accent-light"
            >
              {item}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <BookCallButton className="btn-primary hidden h-9 px-5 text-[13px] sm:inline-flex">
            Get a threat scan
          </BookCallButton>
          <AuthNavLinks />
        </div>
      </nav>
    </header>
  )
}
