import * as cheerio from "cheerio"
import type { BrandProfile, IpAsset } from "./types.js"
import { createId, now } from "./ids.js"
import { hasFirecrawl } from "./env.js"
import {
  chunkPageText,
  firecrawlDeepBrandIntake,
  firecrawlScrapePage,
} from "./firecrawlIntake.js"
import { extractColorPalette } from "./pageSignals.js"
import {
  collectBrandProductImages,
  extractImagesFromMarkdown,
  extractProductImagesFromHtml,
} from "./productImageIntake.js"
import {
  cleanIntakeUrl,
  getDomain,
  inferBrandName,
  inferCreatorHandle,
  isCreatorProfileUrl,
  normalizeUrl,
  resolveUrl,
} from "./urlUtils.js"
import { isGenericBrandName, isNoisySnippet, normalizeBrandNameForSearch } from "./candidateQuality.js"

type CrawlResult = {
  title: string
  description: string
  logoUrl?: string
  productUrls: string[]
  imageUrls: string[]
  pageHtmlSnippets: Array<{ url: string; html: string }>
  copyrightText?: string
  pageContents: Array<{ url: string; title: string; text: string }>
  colorPalette: string[]
}

function cleanBrandTitle(title: string) {
  return title
    .split("|")[0]
    ?.split(":")[0]
    ?.replace(/[\u2013\u2014-].*$/, "")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function extractBrandNameFromCopyright(copyrightText?: string) {
  if (!copyrightText) return ""
  const match = copyrightText.match(/©\s*(?:The\s+)?([A-Za-z0-9][A-Za-z0-9 &.'-]{1,40}?)(?:\s+\d{4}|\s+US|\s+All|\s*$)/i)
  return match?.[1] ? normalizeBrandNameForSearch(match[1]) : ""
}

function resolveBrandName(websiteUrl: string, crawled: Pick<CrawlResult, "title" | "copyrightText">) {
  const domainName = inferBrandName(websiteUrl)
  const titleName = cleanBrandTitle(crawled.title)
  const copyrightName = extractBrandNameFromCopyright(crawled.copyrightText)
  const cleanCopyright = copyrightName.replace(/\s+(AG|Inc|LLC|Ltd|GmbH)\.?$/i, "").trim()

  if (domainName && !isGenericBrandName(domainName) && titleName) {
    const normalizedTitle = normalizeBrandNameForSearch(titleName).toLowerCase()
    const normalizedDomain = normalizeBrandNameForSearch(domainName).toLowerCase()
    if (normalizedTitle.startsWith(normalizedDomain) && titleName.split(/\s+/).length > domainName.split(/\s+/).length) {
      return normalizeBrandNameForSearch(domainName)
    }
  }

  if (cleanCopyright && !isGenericBrandName(cleanCopyright)) return cleanCopyright
  if (titleName && !isGenericBrandName(titleName) && titleName.split(/\s+/).length <= 2) return titleName
  if (domainName && !isGenericBrandName(domainName)) return normalizeBrandNameForSearch(domainName)
  if (titleName && !isGenericBrandName(titleName)) return titleName

  return cleanCopyright || titleName || domainName || "Brand"
}

function extractFullPageText($: cheerio.CheerioAPI) {
  $("script, style, noscript, svg").remove()
  const sections = ["main", "article", "[role='main']", "body"]
    .map((selector) => normalizeWhitespace($(selector).first().text()))
    .filter((text) => text.length > 80)

  return (sections[0] ?? normalizeWhitespace($("body").text())).slice(0, 20000)
}

function parseHtml(baseUrl: string, html: string) {
  const $ = cheerio.load(html)
  const title = $("title").first().text().trim()
  const description =
    $('meta[name="description"]').attr("content")?.trim() ??
    $('meta[property="og:description"]').attr("content")?.trim() ??
    ""

  const logoUrl =
    $('meta[property="og:image"]').attr("content")?.trim() ??
    $('link[rel="icon"]').attr("href")?.trim() ??
    $('link[rel="shortcut icon"]').attr("href")?.trim()

  const productUrls = new Set<string>()
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")
    if (!href) return
    const lower = href.toLowerCase()
    if (
      lower.includes("/product") ||
      lower.includes("/products/") ||
      lower.includes("/collections/")
    ) {
      productUrls.add(resolveUrl(baseUrl, href))
    }
  })

  const imageUrls = extractProductImagesFromHtml(html, baseUrl)

  const copyrightText = $("footer").text().replace(/\s+/g, " ").trim().slice(0, 400)
  const fullPageText = extractFullPageText($)

  return {
    title,
    description,
    logoUrl: logoUrl ? resolveUrl(baseUrl, logoUrl) : undefined,
    productUrls: [...productUrls].slice(0, 20),
    imageUrls,
    copyrightText: copyrightText || undefined,
    fullPageText,
    html,
  }
}

async function crawlWithFirecrawlDeep(url: string): Promise<CrawlResult | null> {
  const intake = await firecrawlDeepBrandIntake(url)
  if (!intake) return null

  return {
    title: intake.siteTitle,
    description: intake.siteDescription,
    logoUrl: intake.logoUrl,
    productUrls: intake.productUrls,
    imageUrls: intake.imageUrls,
    pageHtmlSnippets: intake.pages.map((page) => ({ url: page.url, html: page.html })),
    copyrightText: intake.copyrightText,
    pageContents: intake.pages.map((page) => ({
      url: page.url,
      title: page.title,
      text: page.text,
    })),
    colorPalette: extractColorPalette(intake.pages[0]?.html ?? ""),
  }
}

async function crawlWithFetch(url: string): Promise<CrawlResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(normalizeUrl(url), {
      headers: {
        "User-Agent": "MoodnaTracker/1.0 (+https://moodna.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Could not fetch website (${response.status})`)
    }

    const html = await response.text()
    const parsed = parseHtml(url, html)

    return {
      title: parsed.title || inferBrandName(url),
      description: parsed.description,
      logoUrl: parsed.logoUrl,
      productUrls: parsed.productUrls,
      imageUrls: parsed.imageUrls,
      pageHtmlSnippets: [{ url, html: parsed.html }],
      copyrightText: parsed.copyrightText,
      pageContents: [
        {
          url,
          title: parsed.title || inferBrandName(url),
          text: parsed.fullPageText || parsed.description,
        },
      ],
      colorPalette: extractColorPalette(html),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function crawlWebsite(url: string) {
  const firecrawlResult = await crawlWithFirecrawlDeep(url)
  if (firecrawlResult) return firecrawlResult
  return crawlWithFetch(url)
}

async function scrapeProductDescription(productUrl: string) {
  if (hasFirecrawl()) {
    const page = await firecrawlScrapePage(productUrl)
    if (page && page.text.length >= 40) {
      return page.text.slice(0, 4000)
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(normalizeUrl(productUrl), {
      headers: {
        "User-Agent": "MoodnaTracker/1.0 (+https://moodna.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    })

    if (!response.ok) return null
    const html = await response.text()
    const $ = cheerio.load(html)

    const description =
      $(".product__description, .product-description, [data-product-description], .ProductMeta__Description, #product-description, .rte")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      $('meta[name="description"]').attr("content")?.trim() ||
      extractFullPageText($)

    return description.length >= 40 ? description.slice(0, 4000) : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function addPageContentAssets(
  ipAssets: IpAsset[],
  brandProfileId: string,
  pageContents: CrawlResult["pageContents"],
  timestamp: string,
) {
  for (const page of pageContents) {
    if (!page.text.trim() || isNoisySnippet(page.text)) continue
    if (/your cart is empty/i.test(page.text) && page.text.length < 500) continue
    for (const chunk of chunkPageText(page.text)) {
      if (isNoisySnippet(chunk)) continue
      ipAssets.push({
        id: createId("asset"),
        brandProfileId,
        type: "page_content",
        value: chunk,
        sourceUrl: page.url,
        createdAt: timestamp,
      })
    }
  }
}

export async function discoverBrandAssets(input: {
  websiteUrl: string
  organizationId: string
}) {
  const websiteUrl = cleanIntakeUrl(input.websiteUrl)
  const domain = getDomain(websiteUrl)
  const creatorProfile = isCreatorProfileUrl(websiteUrl)
  const creatorHandle = creatorProfile ? inferCreatorHandle(websiteUrl) : ""
  const crawled = await crawlWebsite(websiteUrl)
  const brandName =
    creatorHandle ||
    resolveBrandName(websiteUrl, crawled)
  const timestamp = now()
  const pagesCaptured = crawled.pageContents.length

  const brandProfile: BrandProfile = {
    id: createId("brand"),
    organizationId: input.organizationId,
    websiteUrl,
    brandName,
    ownerName: `${brandName} owner`,
    ownerEmail: `owner@${domain}`,
    authorizedAgent: "Moodna Enforcement Team",
    notes: creatorProfile
      ? "Creator profile detected. Recommended scan targets include Telegram, Reddit, Kemono, Bunkr, and other piracy sources."
      : [
          crawled.description,
          pagesCaptured > 1
            ? `Full-site Firecrawl intake captured ${pagesCaptured} pages of brand text, product copy, and page content.`
            : "IP assets were auto-discovered from the submitted website link.",
        ]
          .filter(Boolean)
          .join(" "),
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const ipAssets: IpAsset[] = [
    {
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "website",
      value: websiteUrl,
      sourceUrl: websiteUrl,
      createdAt: timestamp,
    },
    {
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "trademark",
      value: brandName,
      sourceUrl: websiteUrl,
      createdAt: timestamp,
    },
    {
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "copyright_text",
      value: crawled.copyrightText ?? crawled.description ?? domain,
      sourceUrl: websiteUrl,
      createdAt: timestamp,
    },
  ]

  addPageContentAssets(ipAssets, brandProfile.id, crawled.pageContents, timestamp)

  if (crawled.colorPalette.length > 0) {
    ipAssets.push({
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "design_palette",
      value: crawled.colorPalette.join(","),
      sourceUrl: websiteUrl,
      createdAt: timestamp,
    })
  }

  if (crawled.logoUrl) {
    ipAssets.push({
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "logo",
      value: crawled.logoUrl,
      sourceUrl: websiteUrl,
      createdAt: timestamp,
    })
  }

  for (const productUrl of crawled.productUrls.slice(0, 8)) {
    ipAssets.push({
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "product_url",
      value: productUrl,
      sourceUrl: websiteUrl,
      createdAt: timestamp,
    })
  }

  for (const productUrl of crawled.productUrls.slice(0, 5)) {
    const description = await scrapeProductDescription(productUrl)
    if (description) {
      ipAssets.push({
        id: createId("asset"),
        brandProfileId: brandProfile.id,
        type: "product_description",
        value: description,
        sourceUrl: productUrl,
        createdAt: timestamp,
      })
    }
  }

  const productImages = await collectBrandProductImages({
    brandWebsiteUrl: websiteUrl,
    productUrls: crawled.productUrls,
    pageHtmlSnippets: crawled.pageHtmlSnippets,
    seedImageUrls: crawled.imageUrls,
  })

  for (const imageUrl of productImages) {
    ipAssets.push({
      id: createId("asset"),
      brandProfileId: brandProfile.id,
      type: "product_image",
      value: imageUrl,
      sourceUrl: websiteUrl,
      createdAt: timestamp,
    })
  }

  if (productImages.length > 0) {
    brandProfile.notes = [brandProfile.notes, `Captured ${productImages.length} product image(s) from product pages.`]
      .filter(Boolean)
      .join(" ")
  }

  return { brandProfile, ipAssets }
}
