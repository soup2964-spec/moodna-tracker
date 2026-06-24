import type { BrandProfile, IpAsset, ScanCandidate } from "./types.js"
import { brandNameMatches } from "./marketplaceFromUrl.js"
import { getDomain, inferBrandName } from "./urlUtils.js"

const JUNK_URL_PATTERNS = [
  /\/s\?k=/i,
  /\/s\?keywords=/i,
  /\/gp\/most-wished-for\//i,
  /\/gp\/bestsellers\//i,
  /\/gp\/new-releases\//i,
  /\/stores\//i,
  /\/store\//i,
  /\/s\?me=/i,
  /\/search\?/i,
  /\/browse\//i,
  /\/category\//i,
  /\/c\?/i,
  /page=\d+$/i,
  /\/wiki\//i,
  /\/help\//i,
  /\/policies\//i,
  /\/pages\/(contact|faq|about|privacy|terms|shipping|refund|accessibility|data-sharing|loyalty|store-locator|become-an-affiliate)/i,
]

const NOISE_SNIPPET_PATTERNS = [
  /err\\?\s*blocked\\?\s*by\\?\s*client/i,
  /hcaptcha/i,
  /recaptcha/i,
  /choosing a selection results in a full page refresh/i,
  /keyboard shortcuts/i,
  /map data ©/i,
  /your cart is empty/i,
  /sign in with google/i,
  /skip to content/i,
]

const GENERIC_CATEGORY_PHRASES = new Set([
  "all wallets",
  "all products",
  "all items",
  "shop all",
  "new arrivals",
  "best sellers",
  "home page",
  "official store",
  "online store",
])

const GENERIC_BRAND_WORDS = new Set([
  "all",
  "shop",
  "store",
  "home",
  "official",
  "catalog",
  "wallet",
  "wallets",
  "product",
  "products",
  "collection",
  "collections",
  "new",
  "sale",
  "the",
])

export const MIN_KIE_APPROVE_CONFIDENCE = 70

export function normalizeBrandNameForSearch(brandName: string) {
  return brandName
    .split("|")[0]
    ?.split(":")[0]
    ?.replace(/[\u2013\u2014-].*$/, "")
    .replace(/[®™©]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function isGenericBrandName(name: string) {
  const normalized = normalizeBrandNameForSearch(name).toLowerCase()
  if (!normalized) return true
  if (GENERIC_CATEGORY_PHRASES.has(normalized)) return true

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  if (words.every((word) => GENERIC_BRAND_WORDS.has(word))) return true

  return false
}

export function brandAliasesFromProfile(brand: BrandProfile, ipAssets?: IpAsset[]) {
  const aliases = new Set<string>()
  const domainAlias = inferBrandName(brand.websiteUrl)
  const domainRoot = getDomain(brand.websiteUrl).split(".")[0]?.toLowerCase() ?? ""

  if (domainAlias && !isGenericBrandName(domainAlias)) {
    aliases.add(domainAlias)
    if (domainAlias.toLowerCase().startsWith("the ")) {
      aliases.add(domainAlias.slice(4).trim())
    } else {
      aliases.add(`The ${domainAlias}`)
    }
  }

  const normalized = normalizeBrandNameForSearch(brand.brandName)
  if (normalized && !isGenericBrandName(normalized)) aliases.add(normalized)

  for (const asset of ipAssets ?? []) {
    if (asset.type !== "trademark" && asset.type !== "copyright_text") continue
    const value = normalizeBrandNameForSearch(asset.value)
    if (value.length >= 3 && !isGenericBrandName(value)) aliases.add(value)

    const copyrightBrand = asset.value.match(/©\s*(?:The\s+)?([A-Za-z0-9][A-Za-z0-9 &.'-]{1,40}?)(?:\s+\d{4}|\s+US|\s+All)/i)
    if (copyrightBrand?.[1]) {
      const extracted = normalizeBrandNameForSearch(copyrightBrand[1])
      if (extracted && !isGenericBrandName(extracted)) aliases.add(extracted)
    }
  }

  if (domainRoot.length >= 3) aliases.add(domainRoot)

  return [...aliases]
}

export function isJunkListingUrl(url: string) {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.toLowerCase()
    const full = url.toLowerCase()

    if (JUNK_URL_PATTERNS.some((pattern) => pattern.test(full) || pattern.test(path))) {
      return true
    }

    if (path === "/" || path.length <= 1) return true
    if (/\.(pdf|xml|json|css|js|gif|png)$/i.test(path)) return true

    return false
  } catch {
    return true
  }
}

export function isNoisySnippet(text: string) {
  if (!text.trim()) return false
  return NOISE_SNIPPET_PATTERNS.some((pattern) => pattern.test(text))
}

export function candidateReferencesBrand(
  candidate: Pick<ScanCandidate, "listingTitle" | "listingUrl" | "snippet">,
  brand: BrandProfile,
  ipAssets?: IpAsset[],
) {
  const haystack = `${candidate.listingTitle} ${candidate.snippet ?? ""} ${candidate.listingUrl}`
  const aliases = brandAliasesFromProfile(brand, ipAssets).filter((alias) => !isGenericBrandName(alias))

  if (aliases.some((alias) => brandNameMatches(haystack, alias))) return true

  const brandDomain = getDomain(brand.websiteUrl).toLowerCase()
  const listingDomain = getDomain(candidate.listingUrl).toLowerCase()
  if (listingDomain !== brandDomain && haystack.toLowerCase().includes(brandDomain)) {
    return true
  }

  return false
}

export function candidateReferencesBrandOrProduct(
  candidate: Pick<ScanCandidate, "listingTitle" | "listingUrl" | "snippet">,
  brand: BrandProfile,
  ipAssets?: IpAsset[],
) {
  if (candidateReferencesBrand(candidate, brand, ipAssets)) return true

  const haystack = `${candidate.listingTitle} ${candidate.snippet ?? ""}`.toLowerCase()
  const productPhrases = (ipAssets ?? [])
    .filter((asset) => asset.type === "product_url")
    .map((asset) => asset.value.match(/\/products\/([^/?#]+)/i)?.[1])
    .filter(Boolean)
    .map((slug) => slug!.replace(/-/g, " ").toLowerCase())

  const knockoffSignals = [
    /compatible with/i,
    /for original/i,
    /replacement for/i,
    /works with/i,
    /knock[- ]?off/i,
    /replica/i,
    /clone/i,
    /style/i,
  ]

  if (knockoffSignals.some((pattern) => pattern.test(haystack))) {
    if (productPhrases.some((phrase) => haystack.includes(phrase.slice(0, Math.min(phrase.length, 20))))) {
      return true
    }
  }

  for (const asset of ipAssets ?? []) {
    if (asset.type !== "product_description" && asset.type !== "page_content") continue
    const text = asset.value.toLowerCase()
    const signature = text.match(/\brolling knife sharpener\b|\bknife sharpener\b|\bhorl\s*\d+\b/)?.[0]
    if (signature && haystack.includes(signature)) return true
  }

  return false
}

export function isReverseImageCandidate(
  candidate: Pick<ScanCandidate, "discoveryMethod" | "matchReason">,
) {
  return (
    candidate.discoveryMethod === "reverse_image" ||
    candidate.matchReason.startsWith("Reverse image match")
  )
}

export function isDropshipperCandidate(
  candidate: Pick<ScanCandidate, "discoveryMethod" | "matchReason">,
) {
  return (
    candidate.discoveryMethod === "dropshipper_search" ||
    candidate.matchReason.startsWith("Dropshipper search")
  )
}

export function candidateQualifiesForKieReview(
  candidate: Pick<
    ScanCandidate,
    "listingTitle" | "listingUrl" | "snippet" | "discoveryMethod" | "matchReason"
  >,
  brand: BrandProfile,
  ipAssets?: IpAsset[],
) {
  if (isReverseImageCandidate(candidate)) return true
  if (isDropshipperCandidate(candidate)) return true
  return candidateReferencesBrandOrProduct(candidate, brand, ipAssets)
}

export function isLikelyOfficialBrandProduct(
  candidate: Pick<ScanCandidate, "listingTitle" | "listingUrl" | "snippet">,
  brandAliases: string[],
) {
  const url = candidate.listingUrl.toLowerCase()
  const haystack = `${candidate.listingTitle} ${candidate.snippet ?? ""}`

  const isAmazonProduct = /amazon\.(com|[a-z]{2,3})/i.test(url) && /\/dp\/|\/gp\/product\//i.test(url)
  if (!isAmazonProduct) return false

  for (const alias of brandAliases) {
    if (isGenericBrandName(alias)) continue
    if (!brandNameMatches(candidate.listingTitle, alias)) continue
    if (brandNameMatches(haystack, alias)) {
      if (/brand\.\s/i.test(haystack) || /visit the/i.test(haystack)) return true
      if (brandNameMatches(candidate.listingTitle, alias) && candidate.listingTitle.length < 120) {
        return true
      }
    }
  }

  return false
}

export function filterCandidatesWithBrandSignal(
  candidates: ScanCandidate[],
  brand: BrandProfile,
  ipAssets?: IpAsset[],
) {
  return candidates.filter((candidate) => candidateReferencesBrand(candidate, brand, ipAssets))
}
