import { useEffect, useState, type ComponentType } from "react"
import { Link } from "react-router-dom"
import { isClerkConfigured } from "../../config/clerk"

export function AuthNavLinks() {
  const [ClerkNav, setClerkNav] = useState<ComponentType | null>(null)

  useEffect(() => {
    if (!isClerkConfigured()) return

    import("./ClerkAuthNav").then((module) => {
      setClerkNav(() => module.ClerkAuthNav)
    })
  }, [])

  if (!isClerkConfigured()) {
    return (
      <Link
        to="/login"
        className="text-[13px] font-medium text-muted transition-colors hover:text-text"
      >
        Login
      </Link>
    )
  }

  if (!ClerkNav) {
    return (
      <Link
        to="/login"
        className="text-[13px] font-medium text-muted transition-colors hover:text-text"
      >
        Login
      </Link>
    )
  }

  return <ClerkNav />
}
