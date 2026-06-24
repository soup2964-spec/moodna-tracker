const CREATOR_DOMAINS = ["onlyfans.com", "fansly.com", "patreon.com", "loyalfans.com"]

export function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function cleanIntakeUrl(value: string) {
  try {
    const parsed = new URL(normalizeUrl(value))
    parsed.search = ""
    parsed.hash = ""
    return parsed.href.replace(/\/$/, "") || parsed.origin
  } catch {
    return normalizeUrl(value)
  }
}

export function getDomain(value: string) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./, "")
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
  }
}

export function inferBrandName(value: string) {
  const domain = getDomain(value)
  const root = domain.split(".")[0] || "Brand"
  return root
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function isCreatorProfileUrl(websiteUrl: string) {
  try {
    const hostname = new URL(normalizeUrl(websiteUrl)).hostname.replace(/^www\./, "")
    return CREATOR_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  } catch {
    return CREATOR_DOMAINS.some((domain) => websiteUrl.includes(domain))
  }
}

export function inferCreatorHandle(websiteUrl: string) {
  try {
    const handle = new URL(normalizeUrl(websiteUrl)).pathname.replace(/^\//, "").split("/")[0]
    return handle || ""
  } catch {
    return ""
  }
}

export function resolveUrl(base: string, href: string) {
  try {
    return new URL(href, normalizeUrl(base)).href
  } catch {
    return href
  }
}
