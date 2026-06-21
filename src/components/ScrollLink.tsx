import type { MouseEvent, ReactNode } from "react"
import { useLocation, useNavigate } from "react-router-dom"

type ScrollLinkProps = {
  href: string
  children: ReactNode
  className?: string
}

export function ScrollLink({ href, className, children }: ScrollLinkProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const hashIndex = href.indexOf("#")
    if (hashIndex === -1) return

    event.preventDefault()

    const hash = href.slice(hashIndex)
    const id = hash.replace("#", "")

    if (pathname !== "/") {
      navigate(`/${hash}`)
      return
    }

    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    window.history.replaceState(null, "", hash)
  }

  const resolvedHref = href.startsWith("#") ? `/${href}` : href

  return (
    <a href={resolvedHref} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}
