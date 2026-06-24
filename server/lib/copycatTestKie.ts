import { env, hasFirecrawl, hasPublicWww, hasSerper } from "./env.js"
import {
  buildAmazonExcludeOfficialQuery,
  buildExcludeOfficialSiteQuery,
  filterOfficialListings,
  inferMarketplaceFromUrl,
  type SearchListingResult,
} from "./marketplaceFromUrl.js"
import { searchPublicWww } from "./publicWwwClient.js"
import { searchSerper } from "./serperClient.js"
import type { Marketplace } from "./types.js"
import { getScanTarget } from "./scanTargets.js"
import { quotePublicWwwPhrase } from "./searchTerms.js"
import { streamKieGemini, type KieContent } from "./kieGemini.js"
import { extractColorPalette, fetchPageSignals } from "./pageSignals.js"
import {
  collectHitsFromToolResult,
  persistCopycatTestToReviewQueue,
  type CopycatTestHit,
} from "./copycatTestPersistence.js"
import { getDomain } from "./urlUtils.js"

type CopycatTestContext = {
  brandWebsiteUrl: string
  brandName: string
  brandAliases: string[]
}

function brandAliasesFromContext(context: CopycatTestContext) {
  return [...new Set([context.brandName, ...context.brandAliases].filter(Boolean))]
}

function brandAliasesFromIntake(intake: IntakeSnapshot | null) {
  if (!intake) return [] as string[]
  const aliases = new Set<string>()
  if (intake.brandName) aliases.add(intake.brandName)
  if (intake.pageTitle) aliases.add(intake.pageTitle)
  for (const candidate of intake.trademarkCandidates ?? []) aliases.add(candidate)
  return [...aliases]
}

const COPYCAT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "intake_brand_assets",
        description:
          "Crawl the official brand website and extract all IP-relevant brand assets: brand name, trademarks, product names, hero copy, page text, logo/image URLs, page layout structure, and color scheme",
        parameters: {
          type: "OBJECT",
          properties: {
            url: {
              type: "STRING",
              description: "The official brand website URL to intake",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "search_marketplace_listings",
        description:
          "Search for infringing listings on a marketplace. Ecommerce marketplaces use Serper (Google) + PublicWWW; piracy sources use PublicWWW source-code search.",
        parameters: {
          type: "OBJECT",
          properties: {
            marketplace: {
              type: "STRING",
              description: "Target marketplace: amazon, walmart, ebay, etsy, aliexpress, or shopify",
            },
            query: {
              type: "STRING",
              description: "Search query using brand name, product names, taglines, or distinctive phrases from intake",
            },
          },
          required: ["marketplace", "query"],
        },
      },
      {
        name: "search_publicwww_source",
        description:
          "Search PublicWWW for websites whose HTML, CSS, or JavaScript contains distinctive brand copy, product text, or storefront code snippets.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description: "Quoted phrase or distinctive copy snippet to find in page source code",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_design_clone_stores",
        description:
          "Search PublicWWW and Serper for fraudulent stores copying the brand's design, product copy, or storefront HTML/CSS.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description:
                "Search query combining brand name, distinctive marketing phrases, and design cues (e.g. color names, layout terms, product category)",
            },
          },
          required: ["query"],
        },
      },
    ],
  },
]

async function searchSerperForQuery(
  query: string,
  context: CopycatTestContext,
  marketplace: Marketplace,
) {
  if (!hasSerper()) {
    return {
      query,
      results: [],
      note: "Serper is not configured — add SERPER_API_KEY.",
    }
  }

  const target = getScanTarget(marketplace)
  const excludeOfficial = buildExcludeOfficialSiteQuery(context.brandWebsiteUrl)
  const brandAliases = brandAliasesFromContext(context)
  let searchQuery = query

  if (marketplace === "amazon") {
    searchQuery = `site:amazon.com ${query} ${excludeOfficial} ${buildAmazonExcludeOfficialQuery(brandAliases)}`.trim()
  } else if (marketplace === "shopify") {
    searchQuery =
      `(site:myshopify.com OR inurl:/products) ${query.includes('"') ? query : `"${query}"`} ${excludeOfficial}`.trim()
  } else if (target?.siteQuery) {
    searchQuery = `${target.siteQuery} ${query.includes('"') ? query : `"${query}"`} ${excludeOfficial}`.trim()
  }

  const result = await searchSerper(searchQuery, 10)
  const rawResults: SearchListingResult[] = result.organic.map((row) => ({
    title: row.title,
    url: row.link,
    snippet: row.snippet,
  }))

  const filtered = filterOfficialListings(
    rawResults.filter((row) => inferMarketplaceFromUrl(row.url) === marketplace),
    context.brandWebsiteUrl,
    brandAliases,
  )

  return {
    query: searchQuery,
    source: "Serper",
    ...filtered,
  }
}

async function searchPublicWwwForQuery(query: string, context: CopycatTestContext, marketplace?: Marketplace) {
  if (!hasPublicWww()) {
    return {
      query,
      results: [],
      note: "PublicWWW is not configured — add PUBLICWWW_API_KEY.",
    }
  }

  const phrase = query.includes('"') ? query : quotePublicWwwPhrase(query)
  const hostHint = marketplace ? getScanTarget(marketplace)?.siteQuery.replace(/^site:/i, "") : ""
  const searchQuery = hostHint ? `${phrase} ${hostHint.split(" OR ")[0]}` : phrase

  const matches = await searchPublicWww(searchQuery, { snippets: true, maxResults: 50 })
  const rawResults: SearchListingResult[] = matches.map((match) => ({
    title: match.snippet?.slice(0, 120) || match.site,
    url: match.site.startsWith("http") ? match.site : `https://${match.site}`,
    snippet: match.snippet,
  }))

  const filtered = filterOfficialListings(
    rawResults.filter((result) => {
      if (!marketplace) return true
      return inferMarketplaceFromUrl(result.url) === marketplace
    }),
    context.brandWebsiteUrl,
    brandAliasesFromContext(context),
  )

  return {
    query: searchQuery,
    source: "PublicWWW",
    ...filtered,
  }
}

async function intakeBrandAssets(url: string) {
  const pageSignals = await fetchPageSignals(url)
  let firecrawlData: {
    title?: string
    description?: string
    markdown?: string
    imageUrls?: string[]
  } = {}

  if (hasFirecrawl() && env.firecrawlApiKey) {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown", "html"], onlyMainContent: true }),
    })

    if (response.ok) {
      const payload = (await response.json()) as {
        data?: {
          metadata?: { title?: string; description?: string; ogImage?: string }
          markdown?: string
          html?: string
        }
      }
      const html = payload.data?.html ?? ""
      const imageUrls = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
        .map((match) => match[1])
        .filter((src) => !src.startsWith("data:"))
        .slice(0, 12)

      firecrawlData = {
        title: payload.data?.metadata?.title,
        description: payload.data?.metadata?.description,
        markdown: payload.data?.markdown?.slice(0, 6000),
        imageUrls: payload.data?.metadata?.ogImage
          ? [payload.data.metadata.ogImage, ...imageUrls]
          : imageUrls,
      }

      if (!pageSignals && html) {
        const palette = extractColorPalette(html)
        return {
          url,
          officialDomain: getDomain(url),
          brandName: firecrawlData.title ?? "",
          pageTitle: firecrawlData.title ?? "",
          metaDescription: firecrawlData.description ?? "",
          colorPalette: palette,
          pageDesign: {
            platform: html.toLowerCase().includes("shopify") ? "shopify" : "unknown",
            headings: [],
            sectionClasses: [],
            marketingPhrases: [],
          },
          productCopy: firecrawlData.markdown?.slice(0, 3000) ?? "",
          pageContent: firecrawlData.markdown ?? "",
          imageUrls: firecrawlData.imageUrls ?? [],
          copyrightSignals: extractCopyrightSignals(firecrawlData.markdown ?? html),
        }
      }
    }
  }

  if (!pageSignals && !firecrawlData.markdown) {
    throw new Error(`Could not fetch brand website: ${url}`)
  }

  const bodySource = firecrawlData.markdown ?? pageSignals?.bodyText ?? ""

  return {
    url,
    officialDomain: getDomain(url),
    brandName: pageSignals?.title ?? firecrawlData.title ?? "",
    pageTitle: pageSignals?.title ?? firecrawlData.title ?? "",
    metaDescription: pageSignals?.description ?? firecrawlData.description ?? "",
    colorPalette: pageSignals?.colorPalette ?? [],
    pageDesign: {
      platform: pageSignals?.isShopify ? "shopify" : "unknown",
      headings: pageSignals?.headings ?? [],
      sectionClasses: pageSignals?.sectionClasses ?? [],
      marketingPhrases: pageSignals?.marketingPhrases ?? [],
    },
    productCopy: bodySource.slice(0, 3000),
    pageContent: bodySource.slice(0, 6000),
    imageUrls: firecrawlData.imageUrls ?? [],
    copyrightSignals: extractCopyrightSignals(bodySource),
    trademarkCandidates: extractTrademarkCandidates(
      pageSignals?.title ?? firecrawlData.title ?? "",
      pageSignals?.headings ?? [],
    ),
  }
}

type IntakeSnapshot = Awaited<ReturnType<typeof intakeBrandAssets>>

function extractCopyrightSignals(text: string) {
  const matches = text.match(/©[^\n.]{0,120}|copyright[^\n.]{0,120}/gi) ?? []
  return [...new Set(matches.map((match) => match.trim()))].slice(0, 5)
}

function extractTrademarkCandidates(title: string, headings: string[]) {
  const candidates = new Set<string>()
  if (title.trim()) candidates.add(title.trim())
  for (const heading of headings.slice(0, 5)) {
    if (heading.length >= 3 && heading.length <= 80) candidates.add(heading.trim())
  }
  return [...candidates]
}

async function searchDesignCloneStores(query: string, context: CopycatTestContext) {
  const publicWww = hasPublicWww()
    ? await searchPublicWwwForQuery(
        `${quotePublicWwwPhrase(query)} myshopify.com "/cdn/shop/files/"`,
        context,
        "shopify",
      )
    : null
  const serper = hasSerper() ? await searchSerperForQuery(query, context, "shopify") : null

  return {
    query,
    serper,
    publicWww,
    results: [...(serper?.results ?? []), ...(publicWww?.results ?? [])],
  }
}

async function searchMarketplaceListings(
  marketplace: string,
  query: string,
  context: CopycatTestContext,
) {
  const normalized = marketplace.toLowerCase() as Marketplace
  const ecommerce = ["amazon", "walmart", "ebay", "etsy", "aliexpress", "shopify"].includes(normalized)

  const serper =
    ecommerce && hasSerper() ? await searchSerperForQuery(query, context, normalized) : null
  const publicWww = hasPublicWww() ? await searchPublicWwwForQuery(query, context, normalized) : null

  return {
    marketplace: normalized,
    serper,
    publicWww,
    results: [...(serper?.results ?? []), ...(publicWww?.results ?? [])],
  }
}

async function executeToolCall(name: string, args: Record<string, unknown>, context: CopycatTestContext) {
  if (name === "intake_brand_assets" || name === "analyze_brand_website") {
    const url = String(args.url ?? "")
    if (!url) return { error: "url is required" }
    return intakeBrandAssets(url)
  }

  if (name === "search_marketplace_listings") {
    return searchMarketplaceListings(String(args.marketplace ?? ""), String(args.query ?? ""), context)
  }

  if (name === "search_publicwww_source") {
    return searchPublicWwwForQuery(String(args.query ?? ""), context)
  }

  if (name === "search_design_clone_stores") {
    return searchDesignCloneStores(String(args.query ?? ""), context)
  }

  return { error: `Unknown tool: ${name}` }
}

function buildInitialPrompt(websiteUrl: string) {
  return [
    "You are an expert brand protection and intellectual property enforcement analyst.",
    "",
    `Official brand website URL: ${websiteUrl}`,
    "",
    "## Your mission",
    "Perform a full brand asset intake from the official website, then identify potential copycats",
    "that may be infringing on the brand's intellectual property (copyright, trademark, product design,",
    "trade dress, distinctive page copy, and storefront look-and-feel).",
    "",
    "## Step 1 — Brand asset intake",
    `Brand intake for ${websiteUrl} is already complete. Use the intake tool response in context.`,
    "Catalog: brand name, trademarks, products, copy, images, page design, color palette, copyright signals.",
    "",
    "## Step 2 — Copycat / infringement search",
    "Search for suspected infringers ONLY. Official brand listings are already filtered out of tool results.",
    "",
    "Never report these as copycats:",
    `- Any Amazon listing with "Visit the ... Store" in the title or snippet`,
    `- Any Amazon /stores/ or brand storefront URL`,
    `- Any listing sold by the brand itself ("Sold by ${getDomain(websiteUrl)}" or sold by brand name)`,
    `- Any URL on ${getDomain(websiteUrl)} or its subdomains`,
    "- Walmart/eBay/Etsy official brand store pages",
    "",
    "Only report potentially FRAUDULENT third-party copycats: unauthorized sellers, knockoffs, counterfeit products,",
    "stores cloning the brand's design, or confusingly similar listings from unrelated sellers.",
    "",
    "Search using:",
    "- search_marketplace_listings on amazon, walmart, ebay, etsy, aliexpress, and shopify",
    "- search_publicwww_source for distinctive brand copy, product text, or HTML/CSS snippets in page source",
    "- search_design_clone_stores for ecommerce stores cloning the brand's page design or storefront code",
    "",
    "For each candidate, assess whether it likely infringes:",
    "- Trademark (brand name, logo, confusing similarity)",
    "- Copyright (copied product copy, page text, images)",
    "- Trade dress / design (color palette, layout, storefront clone)",
    "- Counterfeit product (same product category with unauthorized branding)",
    "",
    "## Output format",
    "Return a detailed report with these sections:",
    "",
    "### 1. Brand asset intake",
    "List all captured assets: name, trademarks, products, key copy, colors (hex), design notes, images.",
    "",
    "### 2. Suspected copycats / infringers (fraudulent only — no official brand listings)",
    "For each hit include:",
    "- Platform or site",
    "- Listing/store title",
    "- URL",
    "- Seller name (if known)",
    "- Infringement type (trademark / copyright / trade dress / counterfeit)",
    "- Confidence (low / medium / high)",
    "- Evidence: what specifically matches the brand assets",
    "",
    "### 3. Highest-priority targets",
    "Rank the top 3–5 cases most likely to succeed in a takedown.",
    "",
    "### 4. Recommended monitoring",
    "Keywords, marketplaces, and design signals to watch ongoing.",
    "",
    "Be thorough. Use tools before concluding. Do not invent URLs — only report results returned by tools.",
    "Tool results already filter out official brand listings — trust excludedOfficialCount in tool responses.",
  ].join("\n")
}

function dedupeHits(hits: CopycatTestHit[]) {
  const seen = new Set<string>()
  return hits.filter((hit) => {
    const key = hit.url.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function* finalizeCopycatTest(
  websiteUrl: string,
  intakeSnapshot: IntakeSnapshot | null,
  hits: CopycatTestHit[],
) {
  let intake = intakeSnapshot
  if (!intake) {
    yield { type: "status" as const, message: "Saving brand intake..." }
    intake = await intakeBrandAssets(websiteUrl)
  }

  yield { type: "status" as const, message: "Adding results to review queue..." }

  const persisted = await persistCopycatTestToReviewQueue({
    websiteUrl,
    intake,
    hits: dedupeHits(hits),
  })

  yield {
    type: "review_queue" as const,
    resultCount: persisted.resultCount,
    scanJobId: persisted.scanJob.id,
    brandProfileId: persisted.brandProfile.id,
    brandName: persisted.brandProfile.brandName,
  }
}

export async function* runCopycatTestStream(websiteUrl: string) {
  const context: CopycatTestContext = {
    brandWebsiteUrl: websiteUrl,
    brandName: "",
    brandAliases: [],
  }

  const hits: CopycatTestHit[] = []
  let intakeSnapshot: IntakeSnapshot | null = null

  yield { type: "status" as const, message: "Intaking brand assets before search..." }
  intakeSnapshot = await intakeBrandAssets(websiteUrl)
  context.brandName = intakeSnapshot.brandName ?? intakeSnapshot.pageTitle ?? ""
  context.brandAliases = brandAliasesFromIntake(intakeSnapshot)
  yield {
    type: "tool_result" as const,
    name: "intake_brand_assets",
    result: intakeSnapshot,
  }

  const contents: KieContent[] = [
    {
      role: "user",
      parts: [{ text: buildInitialPrompt(websiteUrl) }],
    },
    {
      role: "model",
      parts: [
        {
          functionCall: {
            name: "intake_brand_assets",
            args: { url: websiteUrl },
          },
        },
      ],
    },
    {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: "intake_brand_assets",
            response: intakeSnapshot as Record<string, unknown>,
          },
        },
      ],
    },
  ]

  yield { type: "status" as const, message: "Starting KIE Gemini analysis..." }

  for (let round = 0; round < 6; round += 1) {
    const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = []
    const modelParts: KieContent["parts"] = []

    for await (const event of streamKieGemini({
      contents,
      tools: COPYCAT_TOOLS,
      stream: true,
      thinkingLevel: "high",
    })) {
      if (event.type === "thought") {
        yield { type: "thought" as const, text: event.text }
      } else if (event.type === "text") {
        yield { type: "text" as const, text: event.text }
        modelParts.push({ text: event.text })
      } else if (event.type === "functionCall") {
        functionCalls.push({ name: event.name, args: event.args })
        modelParts.push({ functionCall: { name: event.name, args: event.args } })
        yield { type: "tool_call" as const, name: event.name, args: event.args }
      }
    }

    if (functionCalls.length === 0) {
      yield* finalizeCopycatTest(websiteUrl, intakeSnapshot, hits)
      yield { type: "done" as const }
      return
    }

    contents.push({ role: "model", parts: modelParts })

    const responseParts: KieContent["parts"] = []
    for (const call of functionCalls) {
      const result = await executeToolCall(call.name, call.args, context)
      if (call.name === "intake_brand_assets" || call.name === "analyze_brand_website") {
        intakeSnapshot = result as IntakeSnapshot
        const brandName = (result as { brandName?: string }).brandName
        if (brandName) context.brandName = brandName
      }

      collectHitsFromToolResult(
        call.name,
        result as Record<string, unknown>,
        hits,
        context.brandWebsiteUrl,
        brandAliasesFromContext(context),
      )

      responseParts.push({
        functionResponse: {
          name: call.name,
          response: result as Record<string, unknown>,
        },
      })
      yield { type: "tool_result" as const, name: call.name, result }
    }

    contents.push({ role: "user", parts: responseParts })
    yield { type: "status" as const, message: "Processing tool results..." }
  }

  yield* finalizeCopycatTest(websiteUrl, intakeSnapshot, hits)
  yield { type: "done" as const }
}

export async function runCopycatTest(websiteUrl: string) {
  const events: Array<Record<string, unknown>> = []
  for await (const event of runCopycatTestStream(websiteUrl)) {
    events.push(event as Record<string, unknown>)
  }
  return events
}
