import { env, hasFirecrawl } from "./env.js"
import { extractImagesFromMarkdown, extractProductImagesFromHtml } from "./productImageIntake.js"
import { getDomain, normalizeUrl, resolveUrl } from "./urlUtils.js"

export type FirecrawlPage = {
  url: string
  title: string
  description: string
  markdown: string
  html: string
  text: string
  links: string[]
}

export type FirecrawlSiteIntake = {
  pages: FirecrawlPage[]
  productUrls: string[]
  imageUrls: string[]
  logoUrl?: string
  siteTitle: string
  siteDescription: string
  copyrightText?: string
}

type ScrapePayload = {
  success?: boolean
  data?: {
    markdown?: string
    html?: string
    links?: string[]
    metadata?: {
      title?: string
      description?: string
      ogImage?: string
      keywords?: string
      language?: string
    }
  }
}

type MapPayload = {
  success?: boolean
  links?: string[]
}

const SKIP_PATH =
  /\/(cart|checkout|account|login|register|wishlist|search|cdn-cgi|\.xml|\.json|\.js|\.css)(\/|$|\?)/i

const PRIORITY_PATH =
  /(\/products?\/|\/collections?\/|\/pages\/|\/about|\/our-story|\/shop|\/store|\/brand|\/faq|\/contact)/i

function firecrawlHeaders() {
  return {
    Authorization: `Bearer ${env.firecrawlApiKey}`,
    "Content-Type": "application/json",
  }
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function markdownToPlainText(markdown: string) {
  return normalizeWhitespace(
    markdown
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_~>`|-]/g, " "),
  )
}

function extractImageUrlsFromHtml(html: string, baseUrl: string) {
  return extractProductImagesFromHtml(html, baseUrl)
}

function extractProductUrls(links: string[], baseUrl: string) {
  const baseHost = getDomain(baseUrl)
  const productUrls = new Set<string>()

  for (const link of links) {
    try {
      const resolved = resolveUrl(baseUrl, link)
      const parsed = new URL(resolved)
      if (parsed.hostname.replace(/^www\./, "") !== baseHost.replace(/^www\./, "")) continue
      const path = parsed.pathname.toLowerCase()
      if (path.includes("/product") || path.includes("/products/") || path.includes("/collections/")) {
        productUrls.add(resolved)
      }
      if (path.includes("/collections/") && path.includes("/products/")) {
        productUrls.add(resolved)
      }
    } catch {
      // ignore invalid urls
    }
  }

  return [...productUrls]
}

function scoreBrandUrl(url: string, entryUrl: string) {
  try {
    const parsed = new URL(url)
    const entry = new URL(entryUrl)
    const sameHost = parsed.hostname.replace(/^www\./, "") === entry.hostname.replace(/^www\./, "")
    if (!sameHost) return -1
    if (SKIP_PATH.test(parsed.pathname)) return -1

    let score = 0
    const path = parsed.pathname.toLowerCase()
    if (path === "/" || path === entry.pathname) score += 12
    if (PRIORITY_PATH.test(path)) score += 10
    if (path.includes("/products/")) score += 8
    if (path.includes("/pages/")) score += 6
    if (path.includes("/policies/")) score += 2
    return score
  } catch {
    return -1
  }
}

function prioritizeBrandUrls(entryUrl: string, links: string[], maxPages: number) {
  const normalizedEntry = normalizeUrl(entryUrl)
  const unique = new Set<string>([normalizedEntry])

  for (const link of links) {
    try {
      unique.add(normalizeUrl(resolveUrl(entryUrl, link)))
    } catch {
      // ignore
    }
  }

  return [...unique]
    .map((url) => ({ url, score: scoreBrandUrl(url, entryUrl) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages)
    .map((row) => row.url)
}

async function firecrawlRequest<T>(path: string, body: Record<string, unknown>) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)

  try {
    const response = await fetch(`https://api.firecrawl.dev/v1/${path}`, {
      method: "POST",
      headers: firecrawlHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Firecrawl ${path} failed (${response.status})`)
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

export async function firecrawlScrapePage(url: string): Promise<FirecrawlPage | null> {
  if (!hasFirecrawl()) return null

  try {
    const payload = await firecrawlRequest<ScrapePayload>("scrape", {
      url,
      formats: ["markdown", "html", "links"],
      onlyMainContent: false,
      waitFor: 1500,
    })

    const data = payload.data
    if (!data) return null

    const markdown = data.markdown ?? ""
    const html = data.html ?? ""
    const metadata = data.metadata ?? {}
    const links = [...(data.links ?? []), ...extractProductUrlsFromHtml(html, url)]

    return {
      url,
      title: metadata.title ?? "",
      description: metadata.description ?? "",
      markdown,
      html,
      text: markdownToPlainText(markdown || html.replace(/<[^>]+>/g, " ")),
      links,
    }
  } catch (error) {
    console.error(`Firecrawl scrape failed for ${url}:`, error)
    return null
  }
}

function extractProductUrlsFromHtml(html: string, baseUrl: string) {
  const links = new Set<string>()
  const hrefPattern = /href=["']([^"']+)["']/gi
  for (const match of html.matchAll(hrefPattern)) {
    links.add(match[1])
  }
  return extractProductUrls([...links], baseUrl)
}

export async function firecrawlMapSite(url: string, limit = 50) {
  if (!hasFirecrawl()) return []

  try {
    const payload = await firecrawlRequest<MapPayload>("map", {
      url,
      limit,
      includeSubdomains: false,
    })
    return payload.links ?? []
  } catch (error) {
    console.error(`Firecrawl map failed for ${url}:`, error)
    return []
  }
}

export async function firecrawlDeepBrandIntake(
  entryUrl: string,
  maxPages = env.firecrawlIntakeMaxPages,
): Promise<FirecrawlSiteIntake | null> {
  if (!hasFirecrawl()) return null

  const normalizedEntry = normalizeUrl(entryUrl)
  const mappedLinks = await firecrawlMapSite(normalizedEntry, 60)
  const targetUrls = prioritizeBrandUrls(normalizedEntry, mappedLinks, maxPages)

  const pages: FirecrawlPage[] = []
  const allLinks = new Set<string>()
  const allImages = new Set<string>()
  let logoUrl: string | undefined

  for (const pageUrl of targetUrls) {
    const scraped = await firecrawlScrapePage(pageUrl)
    if (!scraped || scraped.text.length < 20) continue

    pages.push(scraped)
    scraped.links.forEach((link) => allLinks.add(link))
    extractImageUrlsFromHtml(scraped.html, pageUrl).forEach((image) => allImages.add(image))
    extractImagesFromMarkdown(scraped.markdown, pageUrl).forEach((image) => allImages.add(image))

    if (!logoUrl) {
      const ogMatch = scraped.html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      logoUrl = ogMatch?.[1]
    }
  }

  if (pages.length === 0) return null

  const homePage = pages.find((page) => {
    try {
      return new URL(page.url).pathname === "/" || page.url === normalizedEntry
    } catch {
      return false
    }
  }) ?? pages[0]

  const productUrls = extractProductUrls([...allLinks, ...pages.flatMap((page) => page.links)], normalizedEntry)
  const combinedText = pages.map((page) => page.text).join(" ")
  const copyrightText = combinedText.match(/©[^\n.]{0,180}\d{4}[^.]*/i)?.[0]

  return {
    pages,
    productUrls: [...new Set(productUrls)].slice(0, 20),
    imageUrls: [...allImages].slice(0, 24),
    logoUrl: logoUrl ? resolveUrl(normalizedEntry, logoUrl) : undefined,
    siteTitle: homePage.title,
    siteDescription: homePage.description,
    copyrightText: copyrightText ? normalizeWhitespace(copyrightText).slice(0, 400) : undefined,
  }
}

export function chunkPageText(text: string, chunkSize = 12000) {
  if (text.length <= chunkSize) return [text]

  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize))
    start += chunkSize
  }
  return chunks
}
