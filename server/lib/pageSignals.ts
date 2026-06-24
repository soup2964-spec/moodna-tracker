import * as cheerio from "cheerio"
import { normalizeUrl } from "./urlUtils.js"

export type PageSignals = {
  url: string
  title: string
  description: string
  headings: string[]
  bodyText: string
  isShopify: boolean
  sectionClasses: string[]
  marketingPhrases: string[]
  colorPalette: string[]
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
}

function overlapScore(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  const overlap = a.filter((token) => setB.has(token)).length
  return overlap / Math.max(a.length, b.length)
}

function extractPhrases(text: string, minWords = 4, maxPhrases = 8) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)

  const phrases = new Set<string>()
  for (let size = minWords; size <= Math.min(6, words.length); size += 1) {
    for (let index = 0; index <= words.length - size; index += 1) {
      phrases.add(words.slice(index, index + size).join(" "))
      if (phrases.size >= maxPhrases) return [...phrases]
    }
  }
  return [...phrases]
}

function normalizeHex(color: string) {
  const trimmed = color.trim().toLowerCase()
  const short = trimmed.match(/^#([0-9a-f]{3})$/i)
  if (short) {
    const [r, g, b] = short[1].split("")
    return `#${r}${r}${g}${g}${b}${b}`
  }
  const long = trimmed.match(/^#([0-9a-f]{6})$/i)
  if (long) return `#${long[1]}`
  return null
}

function rgbToHex(r: number, g: number, b: number) {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`
}

function parseRgb(value: string) {
  const match = value.match(/rgba?\(([^)]+)\)/i)
  if (!match) return null
  const parts = match[1].split(",").map((part) => Number(part.trim()))
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null
  return rgbToHex(parts[0], parts[1], parts[2])
}

function isUsefulColor(hex: string) {
  const normalized = normalizeHex(hex)
  if (!normalized) return false
  const value = normalized.slice(1)
  if (value === "000000" || value === "ffffff") return false
  if (value === "111111" || value === "fafafa" || value === "f5f5f5") return false
  return true
}

export function extractColorPalette(html: string, limit = 8) {
  const colors = new Set<string>()

  const hexMatches = html.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
  for (const match of hexMatches) {
    const hex = normalizeHex(match)
    if (hex && isUsefulColor(hex)) colors.add(hex)
  }

  const rgbMatches = html.match(/rgba?\([^)]+\)/gi) ?? []
  for (const match of rgbMatches) {
    const hex = parseRgb(match)
    if (hex && isUsefulColor(hex)) colors.add(hex)
  }

  const themeColor = html.match(/name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)
  if (themeColor) {
    const hex = normalizeHex(themeColor[1]) ?? parseRgb(themeColor[1])
    if (hex) colors.add(hex)
  }

  return [...colors].slice(0, limit)
}

function colorDistance(a: string, b: string) {
  const parse = (hex: string) => {
    const normalized = normalizeHex(hex) ?? "#000000"
    return {
      r: Number.parseInt(normalized.slice(1, 3), 16),
      g: Number.parseInt(normalized.slice(3, 5), 16),
      b: Number.parseInt(normalized.slice(5, 7), 16),
    }
  }

  const left = parse(a)
  const right = parse(b)
  return Math.sqrt(
    (left.r - right.r) ** 2 + (left.g - right.g) ** 2 + (left.b - right.b) ** 2,
  )
}

export function compareColorPalettes(brandColors: string[], candidateColors: string[]) {
  if (brandColors.length === 0 || candidateColors.length === 0) {
    return { score: 0, matchedColors: [] as string[] }
  }

  const matched = new Set<string>()
  let totalSimilarity = 0

  for (const brandColor of brandColors) {
    let best = 0
    for (const candidateColor of candidateColors) {
      const distance = colorDistance(brandColor, candidateColor)
      const similarity = Math.max(0, 1 - distance / 441)
      if (similarity > best) best = similarity
      if (similarity >= 0.82) matched.add(brandColor)
    }
    totalSimilarity += best
  }

  return {
    score: totalSimilarity / brandColors.length,
    matchedColors: [...matched],
  }
}

function parsePageSignals(url: string, html: string): PageSignals {
  const $ = cheerio.load(html)
  const title = $("title").first().text().trim()
  const description =
    $('meta[name="description"]').attr("content")?.trim() ??
    $('meta[property="og:description"]').attr("content")?.trim() ??
    ""

  const headings = ["h1", "h2", "h3"]
    .flatMap((tag) =>
      $(tag)
        .map((_, element) => $(element).text().replace(/\s+/g, " ").trim())
        .get(),
    )
    .filter(Boolean)
    .slice(0, 12)

  const productDescription =
    $(".product__description, .product-description, [data-product-description], .ProductMeta__Description, #product-description")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim()

  const bodyText = [description, productDescription, $("main").text(), $("body").text()]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000)

  const htmlLower = html.toLowerCase()
  const isShopify =
    htmlLower.includes("cdn.shopify.com") ||
    htmlLower.includes("shopify.theme") ||
    htmlLower.includes("powered by shopify")

  const sectionClasses = new Set<string>()
  $("[class*='shopify-section'], [class*='section-'], [class*='product'], [class*='hero'], [class*='footer']")
    .slice(0, 40)
    .each((_, element) => {
      const className = $(element).attr("class")
      if (!className) return
      className
        .split(/\s+/)
        .filter((part) => part.length > 4)
        .slice(0, 2)
        .forEach((part) => sectionClasses.add(part.toLowerCase()))
    })

  const marketingPhrases = extractPhrases([...headings, bodyText.slice(0, 1200)].join(" "))
  const colorPalette = extractColorPalette(html)

  return {
    url,
    title,
    description: description || productDescription,
    headings,
    bodyText,
    isShopify,
    sectionClasses: [...sectionClasses].slice(0, 20),
    marketingPhrases,
    colorPalette,
  }
}

export async function fetchPageSignals(url: string): Promise<PageSignals | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(normalizeUrl(url), {
      headers: {
        "User-Agent": "MoodnaTracker/1.0 (+https://moodna.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    })

    if (!response.ok) return null
    const html = await response.text()
    return parsePageSignals(url, html)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export function comparePageSignals(
  brandSignals: PageSignals[],
  candidate: PageSignals,
): {
  descriptionScore: number
  designScore: number
  colorScore: number
  reasons: string[]
} {
  if (brandSignals.length === 0) {
    return { descriptionScore: 0, designScore: 0, colorScore: 0, reasons: [] }
  }

  const reasons: string[] = []
  let bestDescription = 0
  let bestDesign = 0
  let bestColor = 0
  let bestMatchedColors: string[] = []

  const brandColors = [...new Set(brandSignals.flatMap((signal) => signal.colorPalette))]
  const colorComparison = compareColorPalettes(brandColors, candidate.colorPalette)
  bestColor = colorComparison.score
  bestMatchedColors = colorComparison.matchedColors

  for (const brand of brandSignals) {
    const descriptionTokens = tokenize([brand.description, brand.bodyText].join(" "))
    const candidateDescriptionTokens = tokenize([candidate.description, candidate.bodyText].join(" "))
    const descriptionOverlap = overlapScore(descriptionTokens, candidateDescriptionTokens)

    const headingOverlap = overlapScore(
      tokenize(brand.headings.join(" ")),
      tokenize(candidate.headings.join(" ")),
    )
    const sectionOverlap = overlapScore(brand.sectionClasses, candidate.sectionClasses)
    const phraseOverlap = overlapScore(brand.marketingPhrases, candidate.marketingPhrases)

    let designScore =
      headingOverlap * 30 + sectionOverlap * 25 + phraseOverlap * 35 + colorComparison.score * 20
    if (brand.isShopify && candidate.isShopify) designScore += 10

    const sharedPhrases = brand.marketingPhrases.filter((phrase) =>
      candidate.bodyText.toLowerCase().includes(phrase),
    )
    if (sharedPhrases.length > 0) {
      designScore += Math.min(15, sharedPhrases.length * 5)
      reasons.push(`Shared marketing copy: "${sharedPhrases[0]}"`)
    }

    bestDescription = Math.max(bestDescription, descriptionOverlap)
    bestDesign = Math.max(bestDesign, designScore / 100)
  }

  if (bestDescription >= 0.18) {
    reasons.push(`Product copy overlap ${Math.round(bestDescription * 100)}%`)
  }
  if (bestDesign >= 0.22) {
    reasons.push(`Page layout/design similarity ${Math.round(bestDesign * 100)}%`)
  }
  if (bestColor >= 0.35 && bestMatchedColors.length > 0) {
    reasons.push(
      `Similar color scheme (${Math.round(bestColor * 100)}%): ${bestMatchedColors.slice(0, 3).join(", ")}`,
    )
  }
  if (candidate.isShopify) {
    reasons.push("Candidate runs on Shopify")
  }

  return {
    descriptionScore: bestDescription,
    designScore: bestDesign,
    colorScore: bestColor,
    reasons: [...new Set(reasons)].slice(0, 5),
  }
}

export function buildBrandSignalsFromAssets(input: {
  websiteUrl: string
  siteDescription?: string
  productDescriptions: string[]
  pageContents?: string[]
  pageHtml?: string
  colorPalette?: string[]
}): PageSignals[] {
  const signals: PageSignals[] = []
  const sharedPalette = input.colorPalette ?? []

  if (input.pageHtml) {
    const parsed = parsePageSignals(input.websiteUrl, input.pageHtml)
    signals.push({
      ...parsed,
      colorPalette: [...new Set([...sharedPalette, ...parsed.colorPalette])],
    })
  } else if (input.siteDescription || sharedPalette.length > 0) {
    signals.push({
      url: input.websiteUrl,
      title: "",
      description: input.siteDescription ?? "",
      headings: [],
      bodyText: input.siteDescription ?? "",
      isShopify: input.websiteUrl.includes("shopify") || input.siteDescription?.toLowerCase().includes("shopify") === true,
      sectionClasses: [],
      marketingPhrases: extractPhrases(input.siteDescription ?? ""),
      colorPalette: sharedPalette,
    })
  }

  for (const description of input.productDescriptions) {
    if (!description.trim()) continue
    signals.push({
      url: input.websiteUrl,
      title: "",
      description,
      headings: [],
      bodyText: description,
      isShopify: true,
      sectionClasses: [],
      marketingPhrases: extractPhrases(description),
      colorPalette: sharedPalette,
    })
  }

  for (const content of input.pageContents ?? []) {
    if (!content.trim()) continue
    signals.push({
      url: input.websiteUrl,
      title: "",
      description: content.slice(0, 500),
      headings: [],
      bodyText: content,
      isShopify: content.toLowerCase().includes("shopify") || input.websiteUrl.includes("shop"),
      sectionClasses: [],
      marketingPhrases: extractPhrases(content.slice(0, 2000)),
      colorPalette: sharedPalette,
    })
  }

  return signals
}

export function storefrontUrl(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.hostname}/`
  } catch {
    return url
  }
}
