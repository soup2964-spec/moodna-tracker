import { Link } from "react-router-dom"

export function AuthNavLinks() {
  return (
    <Link
      to="/dashboard"
      className="text-[13px] font-medium text-muted transition-colors hover:text-text"
    >
      Login
    </Link>
  )
}
