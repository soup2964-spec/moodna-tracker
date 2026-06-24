import type { BrandProfile, IpAsset, ScanCandidate } from "./types.js"
import { collectKieGeminiResponse } from "./kieGemini.js"
import { hasKieAi } from "./env.js"
import {
  brandAliasesFromProfile,
  candidateQualifiesForKieReview,
  candidateReferencesBrandOrProduct,
  isGenericBrandName,
  isNoisySnippet,
  isReverseImageCandidate,
  isDropshipperCandidate,
  MIN_KIE_APPROVE_CONFIDENCE,
  normalizeBrandNameForSearch,
} from "./candidateQuality.js"
import { extractAuthorizedRetailerDomains } from "./authorizedRetailers.js"
import { brandNameMatches } from "./marketplaceFromUrl.js"
import { getScanTargetLabel } from "./scanTargets.js"

const REVIEW_BATCH_SIZE = 8
const MAX_REVIEW_ATTEMPTS = 3

type KieCandidateReview = {
  index: number
  approved: boolean
  confidence: number
  infringementType?: string
  brandEvidence?: string
  reason: string
}

function summarizeBrandAssets(brand: BrandProfile, ipAssets: IpAsset[]) {
  const aliases = brandAliasesFromProfile(brand, ipAssets).filter((alias) => !isGenericBrandName(alias))
  const lines = [
    `Primary brand: ${normalizeBrandNameForSearch(brand.brandName)}`,
    `Official website: ${brand.websiteUrl}`,
    `Searchable brand names (must appear in a real infringement): ${aliases.join(", ") || "see website domain"}`,
  ]

  for (const asset of ipAssets) {
    if (asset.type === "trademark" && !isGenericBrandName(asset.value)) {
      lines.push(`Trademark: ${asset.value}`)
    }
    if (asset.type === "product_description" && !isNoisySnippet(asset.value)) {
      lines.push(`Product copy: ${asset.value.slice(0, 400)}`)
    }
    if (asset.type === "product_url") {
      const slug = asset.value.match(/\/products\/([^/?#]+)/i)?.[1]
      if (slug) lines.push(`Known product: ${slug.replace(/-/g, " ")}`)
    }
    if (asset.type === "copyright_text") {
      lines.push(`Copyright: ${asset.value.slice(0, 200)}`)
    }
    if (asset.type === "design_palette") {
      lines.push(`Brand colors: ${asset.value}`)
    }
  }

  return lines.join("\n")
}

function buildReviewPrompt(brand: BrandProfile, ipAssets: IpAsset[], candidates: ScanCandidate[]) {
  const brandName = normalizeBrandNameForSearch(brand.brandName)
  const aliases = brandAliasesFromProfile(brand, ipAssets).filter((alias) => !isGenericBrandName(alias))
  const authorizedDomains = extractAuthorizedRetailerDomains(brand, ipAssets)
  const candidateLines = candidates
    .map(
      (candidate, index) =>
        [
          `[${index}]`,
          isReverseImageCandidate(candidate) ? "Discovery: reverse image search (Serper Lens)" : "",
          isDropshipperCandidate(candidate)
            ? "Discovery: dropshipper search (de-branded product vision, no brand name in query)"
            : "",
          candidate.sourceImageUrl ? `Matched from product image: ${candidate.sourceImageUrl}` : "",
          `Platform: ${getScanTargetLabel(candidate.marketplace)}`,
          `Title: ${candidate.listingTitle}`,
          `URL: ${candidate.listingUrl}`,
          candidate.snippet ? `Snippet: ${candidate.snippet.slice(0, 300)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
    )
    .join("\n\n")

  return [
    `# Role`,
    `You are the founder of "${brandName}" (${brand.websiteUrl}). You know your exact brand name(s): ${aliases.join(", ") || brandName}.`,
    `You are reviewing search hits to decide which are worth sending to enforcement.`,
    ``,
    `# Critical rules — read carefully`,
    `- Approve when the listing uses our brand name(s) OR clearly sells a knockoff/compatible/replacement for our specific products.`,
    `- For reverse-image candidates (marked Discovery: reverse image search), approve when the listing appears to sell the same or visually identical product as our catalog, even if the brand name is missing.`,
    `- For dropshipper-search candidates (de-branded vision), approve ONLY when the listing sells a visually matching knockoff/generic clone WITHOUT being an authorized retailer. Title may omit our brand entirely.`,
    `- REJECT authorized retailers, official stockists, and premium kitchen stores reselling genuine product.`,
    `- Knockoff signals: "compatible with ${brandName}", "for ${brandName} 2/3", "replacement grinding disc", same distinctive product name from our catalog.`,
    `- Generic category overlap alone does NOT count (e.g. any random knife sharpener with no brand or product link to us).`,
    `- Do NOT invent brand names, model numbers, or trademarks not literally present in the listing text.`,
    `- If approving, brandEvidence MUST be an exact quote from the listing title or snippet.`,
    `- Reject unrelated products, official first-party listings, and search/category pages.`,
    ``,
    `# Brand context`,
    summarizeBrandAssets(brand, ipAssets),
    authorizedDomains.length > 0
      ? `Known authorized retailer domains (REJECT these — do not flag as infringers): ${authorizedDomains.join(", ")}`
      : "If a listing looks like an authorized dealer/reseller selling genuine product with brand name, REJECT it.",
    ``,
    `# Candidates`,
    candidateLines,
    ``,
    `# Output — JSON only, no markdown`,
    JSON.stringify({
      reviews: [
        {
          index: 0,
          approved: false,
          confidence: 0,
          infringementType: "trademark | copyright | trade_dress | counterfeit | none",
          brandEvidence: "Exact substring from listing title/snippet — brand name OR knockoff/compatibility signal",
          reason: "One sentence explaining the decision",
        },
      ],
    }),
    ``,
    `# Rules`,
    `- Return one review per candidate, same order`,
    `- approved: true ONLY when brandEvidence is a real quote from the listing`,
    `- brandEvidence: null or empty string → must reject (approved: false)`,
    `- confidence: 0-100, only meaningful when approved (minimum ${MIN_KIE_APPROVE_CONFIDENCE} for approval)`,
    `- reason: max 120 chars, no double-quote characters`,
    `- brandEvidence: short exact substring from listing, no double-quote characters; null if rejecting`,
  ].join("\n")
}

function tryParseJsonObject(raw: string) {
  return JSON.parse(raw) as { reviews?: KieCandidateReview[] }
}

function extractJsonObject(text: string) {
  const trimmed = text.trim()
  const attempts = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim(),
    (() => {
      const start = trimmed.indexOf("{")
      const end = trimmed.lastIndexOf("}")
      return start >= 0 && end > start ? trimmed.slice(start, end + 1) : undefined
    })(),
    trimmed.match(/\{[\s\S]*"reviews"\s*:\s*\[[\s\S]*\]\s*\}/)?.[0],
  ].filter((value): value is string => Boolean(value))

  let lastError: Error | undefined
  for (const candidate of attempts) {
    try {
      return tryParseJsonObject(candidate)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Invalid JSON")
    }
  }

  throw lastError ?? new Error("KIE review response did not contain JSON")
}

function parseReviewPayload(text: string, thoughts: string[]) {
  const sources = [text, ...thoughts].filter((value) => value.trim().length > 0)
  let lastError: Error | undefined

  for (const source of sources) {
    try {
      return extractJsonObject(source)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Invalid JSON")
    }
  }

  throw lastError ?? new Error("KIE review response did not contain JSON")
}

function normalizeReview(raw: unknown, index: number): KieCandidateReview | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  const reason = typeof record.reason === "string" ? record.reason.trim() : ""
  if (!reason) return null

  const confidence =
    typeof record.confidence === "number"
      ? Math.min(100, Math.max(0, Math.round(record.confidence)))
      : 0

  const brandEvidence =
    typeof record.brandEvidence === "string" && record.brandEvidence.trim().toLowerCase() !== "null"
      ? record.brandEvidence.trim()
      : undefined

  return {
    index: typeof record.index === "number" ? record.index : index,
    approved: record.approved === true,
    confidence,
    infringementType:
      typeof record.infringementType === "string" ? record.infringementType : undefined,
    brandEvidence,
    reason,
  }
}

function reviewEvidenceMatchesListing(review: KieCandidateReview, candidate: ScanCandidate) {
  if (!review.brandEvidence || review.brandEvidence.length < 2) return false

  const haystack = `${candidate.listingTitle} ${candidate.snippet ?? ""}`.toLowerCase()
  const evidence = review.brandEvidence.toLowerCase()
  if (haystack.includes(evidence)) return true

  return evidence.split(/\s+/).filter((word) => word.length >= 4).some((word) => haystack.includes(word))
}

function reviewEvidenceMatchesBrand(
  review: KieCandidateReview,
  brand: BrandProfile,
  ipAssets: IpAsset[],
) {
  if (!review.brandEvidence) return false

  const aliases = brandAliasesFromProfile(brand, ipAssets).filter((alias) => !isGenericBrandName(alias))
  return aliases.some((alias) => brandNameMatches(review.brandEvidence ?? "", alias))
}

function reviewEvidenceMatchesBrandOrProduct(
  review: KieCandidateReview,
  brand: BrandProfile,
  ipAssets: IpAsset[],
) {
  if (!review.brandEvidence) return false

  if (reviewEvidenceMatchesBrand(review, brand, ipAssets)) return true

  const evidence = review.brandEvidence.toLowerCase()
  const haystackProducts = (ipAssets ?? [])
    .filter((asset) => asset.type === "product_url")
    .map((asset) => asset.value.match(/\/products\/([^/?#]+)/i)?.[1]?.replace(/-/g, " ").toLowerCase())
    .filter(Boolean)

  return haystackProducts.some((phrase) => phrase && evidence.includes(phrase.slice(0, Math.min(phrase.length, 24))))
}

function passesPostReviewGate(
  review: KieCandidateReview,
  candidate: ScanCandidate,
  brand: BrandProfile,
  ipAssets: IpAsset[],
) {
  if (!review.approved) return false
  if (review.confidence < MIN_KIE_APPROVE_CONFIDENCE) return false
  if (!reviewEvidenceMatchesListing(review, candidate)) return false

  if (isReverseImageCandidate(candidate)) {
    return true
  }

  if (isDropshipperCandidate(candidate)) {
    return true
  }

  if (!reviewEvidenceMatchesBrandOrProduct(review, brand, ipAssets)) return false
  if (!candidateReferencesBrandOrProduct(candidate, brand, ipAssets)) return false
  return true
}

async function reviewBatch(
  brand: BrandProfile,
  ipAssets: IpAsset[],
  candidates: ScanCandidate[],
): Promise<ScanCandidate[]> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= MAX_REVIEW_ATTEMPTS; attempt += 1) {
    try {
      const response = await collectKieGeminiResponse({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  attempt === 1
                    ? buildReviewPrompt(brand, ipAssets, candidates)
                    : `${buildReviewPrompt(brand, ipAssets, candidates)}\n\nIMPORTANT: Your previous response was invalid JSON. Reply with ONLY a single JSON object matching the schema. No prose, no markdown.`,
              },
            ],
          },
        ],
        stream: true,
        thinkingLevel: "low",
      })

      if (!response.text.trim() && response.thoughts.length === 0) {
        throw new Error("KIE returned an empty review response")
      }

      const parsed = parseReviewPayload(response.text, response.thoughts)
      const reviews = Array.isArray(parsed.reviews) ? parsed.reviews : []
      const approved: ScanCandidate[] = []

      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index]
        const review =
          normalizeReview(
            reviews.find((row) => row && typeof row === "object" && (row as KieCandidateReview).index === index),
            index,
          ) ?? normalizeReview(reviews[index], index)

        if (!review || !passesPostReviewGate(review, candidate, brand, ipAssets)) continue

        const infringementLabel = review.infringementType
          ? review.infringementType.replace(/_/g, " ")
          : "potential infringement"

        approved.push({
          ...candidate,
          confidence: review.confidence,
          matchReason: `KIE review (${infringementLabel}): "${review.brandEvidence}" — ${review.reason}`,
        })
      }

      return approved
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("KIE review failed")
      console.warn(`KIE review attempt ${attempt}/${MAX_REVIEW_ATTEMPTS} failed:`, lastError.message)
    }
  }

  throw lastError ?? new Error("KIE review failed")
}

export async function reviewScanCandidatesWithKie(
  brand: BrandProfile,
  ipAssets: IpAsset[],
  candidates: ScanCandidate[],
): Promise<ScanCandidate[]> {
  if (!hasKieAi()) {
    throw new Error("KIE_AI_API_KEY is required to review scan results")
  }

  const brandLinkedCandidates = candidates.filter((candidate) =>
    candidateQualifiesForKieReview(candidate, brand, ipAssets),
  )

  if (brandLinkedCandidates.length === 0) return []

  const approved: ScanCandidate[] = []
  const reviewErrors: string[] = []

  for (let offset = 0; offset < brandLinkedCandidates.length; offset += REVIEW_BATCH_SIZE) {
    const batch = brandLinkedCandidates.slice(offset, offset + REVIEW_BATCH_SIZE)
    try {
      approved.push(...(await reviewBatch(brand, ipAssets, batch)))
    } catch (error) {
      const message = error instanceof Error ? error.message : "KIE review failed"
      reviewErrors.push(message)
      console.error(`KIE review batch failed (${batch.length} candidates):`, message)
    }
  }

  if (approved.length === 0 && reviewErrors.length > 0) {
    throw new Error(reviewErrors[reviewErrors.length - 1])
  }

  approved.sort((a, b) => b.confidence - a.confidence)
  return approved
}
