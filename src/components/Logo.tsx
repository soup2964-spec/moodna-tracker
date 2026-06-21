import { Link } from "react-router-dom"

export function Logo({
  className = "",
  showWordmark = true,
}: {
  className?: string
  showWordmark?: boolean
}) {
  return (
    <Link to="/" className={`group flex items-center gap-1.5 ${className}`}>
      <img
        src="/logo.png"
        alt="Moodna"
        className="h-[4.5rem] w-auto shrink-0 object-contain transition-transform duration-300 group-hover:scale-105"
      />
      {showWordmark && (
        <span className="logo-wordmark">
          Moodna
        </span>
      )}
    </Link>
  )
}

export function SectionHeader({
  label,
  title,
  description,
  align = "center",
}: {
  label?: string
  title: string
  description?: string
  align?: "center" | "left"
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-lg"}>
      {label && <p className="section-label">{label}</p>}
      <h2 className={`${label ? "mt-5" : ""} heading-lg text-text`}>{title}</h2>
      {description && (
        <p className="mt-5 text-[17px] leading-[1.65] text-muted">{description}</p>
      )}
    </div>
  )
}
