import * as cheerio from "cheerio"
import { hasFirecrawl } from "./env.js"
import { firecrawlScrapePage } from "./firecrawlIntake.js"
import { getDomain, normalizeUrl, resolveUrl } from "./urlUtils.js"

export const MAX_PRODUCT_IMAGES = 16
export const MAX_PRODUCT_PAGES_TO_SCRAPE = 8

const JUNK_IMAGE_PATTERNS = [
  /no-image/i,
  /placeholder/i,
  /spinner|loading|loader|loderr/i,
  /favicon|apple-touch-icon/i,
  /american-flag|navbar-usa|icons8-/i,
  /minicart_close|close_btn|nav-bar/i,
  /transparent\.png/i,
  /1x1\.|pixel\.|spacer\./i,
  /badge|payment|trust|secure|ssl/i,
  /flag\.(?:png|webp|gif)/i,
  /\/assets\/.*\.gif/i,
  /shopifycloud\/storefront\/assets/i,
]

const IMAGE_FILE_PATTERN = /\.(?:jpg|jpeg|png|webp|avif|gif)(\?|$)/i
const IMAGE_CDN_PATTERN =
  /(?:cdn\.shopify\.com\/.*\/(?:files|products)\/|\/cdn\/shop\/(?:files|products)\/|\/s\/files\/)/i

function normalizeImageUrl(url: string) {
  try {
    const parsed = new URL(url)
    parsed.hash = ""
    return parsed.href
  } catch {
    return url.trim()
  }
}

function fingerprintImageUrl(url: string) {
  return normalizeImageUrl(url)
    .replace(/[?&](?:width|height|w|h|crop|format|v)=[^&]*/gi, "")
    .replace(/\?+$/, "")
    .toLowerCase()
}

export function isProductImageUrl(url: string) {
  if (!/^https?:\/\//i.test(url)) return false
  if (url.startsWith("data:")) return false
  if (JUNK_IMAGE_PATTERNS.some((pattern) => pattern.test(url.toLowerCase()))) return false
  if (/\.svg(\?|$)/i.test(url)) return false
  if (/\.pdf(\?|$)/i.test(url)) return false

  const lower = url.toLowerCase()
  if (IMAGE_FILE_PATTERN.test(lower) || IMAGE_CDN_PATTERN.test(lower)) return true

  // Reject product page URLs mistaken as images.
  if (/\/products\/[^/?#]+(?:\?|$)/i.test(url) && !IMAGE_FILE_PATTERN.test(lower)) return false

  return false
}

export function isJunkProductImageUrl(url: string) {
  return !isProductImageUrl(url)
}

function scoreProductImageUrl(url: string, brandDomain: string) {
  let score = 0
  const lower = url.toLowerCase()

  if (IMAGE_CDN_PATTERN.test(lower)) score += 24
  if (IMAGE_FILE_PATTERN.test(lower)) score += 20
  if (lower.includes(brandDomain)) score += 8
  if (/cdn\.shopify\.com/i.test(lower)) score += 12
  if (/\.webp(\?|$)/i.test(lower)) score += 4
  if (/width=(?:1[0-9]{3}|[2-9][0-9]{2})/i.test(url)) score += 8
  if (/_(?:small|thumb|icon|xs|sm)\./i.test(lower)) score -= 10
  if (!isProductImageUrl(url)) score -= 100

  return score
}

export function dedupeAndRankProductImages(urls: string[], brandDomain: string) {
  const seen = new Set<string>()
  const ranked: Array<{ url: string; score: number }> = []

  for (const rawUrl of urls) {
    const url = normalizeImageUrl(rawUrl)
    if (!isProductImageUrl(url)) continue

    const fingerprint = fingerprintImageUrl(url)
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)

    ranked.push({ url, score: scoreProductImageUrl(url, brandDomain) })
  }

  return ranked
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.url)
}

export function uniqueProductPageUrls(urls: string[]) {
  const seenSlugs = new Set<string>()
  const unique: string[] = []

  const sorted = [...urls].sort((a, b) => {
    const score = (url: string) => {
      if (/\/en-US\//i.test(url)) return 10
      if (/\/en-[A-Z]{2}\//i.test(url)) return 8
      return 0
    }
    return score(b) - score(a)
  })

  for (const url of sorted) {
    const slug = url.match(/\/products\/([^/?#]+)/i)?.[1]?.toLowerCase()
    if (!slug) continue
    if (seenSlugs.has(slug)) continue
    seenSlugs.add(slug)
    unique.push(url)
  }

  return unique
}

function addImageCandidate(urls: Set<string>, baseUrl: string, raw?: string | null) {
  if (!raw?.trim()) return
  try {
    const resolved = normalizeImageUrl(resolveUrl(baseUrl, raw.trim()))
    if (isProductImageUrl(resolved)) urls.add(resolved)
  } catch {
    // ignore invalid urls
  }
}

function extractFromSrcset(value: string, baseUrl: string, urls: Set<string>) {
  for (const entry of value.split(",")) {
    const src = entry.trim().split(/\s+/)[0]
    addImageCandidate(urls, baseUrl, src)
  }
}

function extractJsonLdImages(html: string, baseUrl: string, urls: Set<string>) {
  const scriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(scriptPattern)) {
    try {
      const payload = JSON.parse(match[1]) as unknown
      collectJsonLdImageValues(payload, baseUrl, urls)
    } catch {
      // ignore invalid json-ld
    }
  }
}

function collectJsonLdImageValues(value: unknown, baseUrl: string, urls: Set<string>) {
  if (!value) return

  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) || value.startsWith("//")) {
      addImageCandidate(urls, baseUrl, value.startsWith("//") ? `https:${value}` : value)
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdImageValues(item, baseUrl, urls)
    return
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    if (record["@type"] === "Product" || record["@type"] === "ImageObject") {
      collectJsonLdImageValues(record.image, baseUrl, urls)
    }
    if ("image" in record) collectJsonLdImageValues(record.image, baseUrl, urls)
    if ("url" in record && typeof record.url === "string") {
      addImageCandidate(urls, baseUrl, record.url)
    }
  }
}

export function extractProductImagesFromHtml(html: string, baseUrl: string) {
  const urls = new Set<string>()
  const $ = cheerio.load(html)

  $('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]').each(
    (_, element) => {
      addImageCandidate(urls, baseUrl, $(element).attr("content"))
    },
  )

  $("img").each((_, element) => {
    const el = $(element)
    addImageCandidate(urls, baseUrl, el.attr("src"))
    addImageCandidate(urls, baseUrl, el.attr("data-src"))
    addImageCandidate(urls, baseUrl, el.attr("data-zoom-src"))
    const srcset = el.attr("srcset") ?? el.attr("data-srcset")
    if (srcset) extractFromSrcset(srcset, baseUrl, urls)
  })

  const htmlPatterns = [
    /(?:src|data-src|href|content)=["']([^"']+(?:cdn\/shop|cdn\.shopify\.com|\/s\/files\/)[^"']+)["']/gi,
    /"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp|avif|gif)(?:\?[^"]*)?)"/gi,
  ]

  for (const pattern of htmlPatterns) {
    for (const match of html.matchAll(pattern)) {
      addImageCandidate(urls, baseUrl, match[1])
    }
  }

  extractJsonLdImages(html, baseUrl, urls)

  return [...urls]
}

export function extractImagesFromMarkdown(markdown: string, baseUrl: string) {
  const urls = new Set<string>()
  for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    addImageCandidate(urls, baseUrl, match[1])
  }
  return [...urls]
}

async function fetchProductPageHtmlDirect(productUrl: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(normalizeUrl(productUrl), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MoodnaTracker/1.0; +https://moodna.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    })

    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function scrapeProductPageImages(productUrl: string) {
  if (hasFirecrawl()) {
    const page = await firecrawlScrapePage(productUrl)
    if (page) {
      const fromHtml = page.html ? extractProductImagesFromHtml(page.html, productUrl) : []
      const fromMarkdown = page.markdown ? extractImagesFromMarkdown(page.markdown, productUrl) : []
      const combined = [...new Set([...fromHtml, ...fromMarkdown])]
      if (combined.length > 0) return combined
    }
  }

  const html = await fetchProductPageHtmlDirect(productUrl)
  if (!html) return []
  return extractProductImagesFromHtml(html, productUrl)
}

export async function collectBrandProductImages(input: {
  brandWebsiteUrl: string
  productUrls: string[]
  pageHtmlSnippets: Array<{ url: string; html?: string }>
  seedImageUrls?: string[]
}) {
  const brandDomain = getDomain(input.brandWebsiteUrl)
  const allImages: string[] = [...(input.seedImageUrls ?? [])]
  const productUrls = uniqueProductPageUrls(input.productUrls).slice(0, MAX_PRODUCT_PAGES_TO_SCRAPE)

  for (const page of input.pageHtmlSnippets) {
    if (!page.html) continue
    allImages.push(...extractProductImagesFromHtml(page.html, page.url))
  }

  for (const productUrl of productUrls) {
    const images = await scrapeProductPageImages(productUrl)
    allImages.push(...images)
  }

  return dedupeAndRankProductImages(allImages, brandDomain).slice(0, MAX_PRODUCT_IMAGES)
}
