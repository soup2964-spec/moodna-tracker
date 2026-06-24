import type { BrandProfile, IpAsset } from "./types.js"
import {
  brandAliasesFromProfile,
  isGenericBrandName,
  isNoisySnippet,
  normalizeBrandNameForSearch,
} from "./candidateQuality.js"
import { inferBrandName } from "./urlUtils.js"

export type SearchTermContext = {
  brand: BrandProfile
  keywords: string[]
  ipAssets?: IpAsset[]
}

const MAX_KEYWORD_TERMS = 10
const MAX_SNIPPET_TERMS = 8

function isUsefulTerm(term: string) {
  const normalized = normalizeBrandNameForSearch(term)
  if (normalized.length < 3) return false
  if (isGenericBrandName(normalized)) return false
  if (/official$/i.test(normalized)) return false
  if (isNoisySnippet(term)) return false
  return true
}

function slugToPhrase(slug: string) {
  return slug
    .replace(/-/g, " ")
    .replace(/\bhorl\s*(\d+)\b/i, "horl $1")
    .replace(/\s+/g, " ")
    .trim()
}

function extractProductNamesFromUrls(ipAssets?: IpAsset[]) {
  const phrases = new Set<string>()

  for (const asset of ipAssets ?? []) {
    if (asset.type !== "product_url") continue
    const slug = asset.value.match(/\/products\/([^/?#]+)/i)?.[1]
    if (!slug) continue
    const phrase = slugToPhrase(slug)
    if (phrase.length >= 8) phrases.add(phrase)
  }

  return [...phrases].slice(0, 4)
}

function extractProductPhrases(ipAssets?: IpAsset[]) {
  const phrases: string[] = []

  for (const asset of ipAssets ?? []) {
    if (asset.type === "product_description" || asset.type === "copyright_text") {
      if (isNoisySnippet(asset.value)) continue
      const words = asset.value.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean)
      if (words.length >= 4) phrases.push(words.slice(0, 10).join(" "))
    }

    if (asset.type === "page_content" && !isNoisySnippet(asset.value)) {
      const text = asset.value.replace(/\s+/g, " ")
      const quoted = text.match(/"([^"]{12,80})"/g)?.map((value) => value.replace(/"/g, "")) ?? []
      phrases.push(...quoted.filter((phrase) => !isGenericBrandName(phrase)))

      const signaturePatterns = [
        /\brolling knife sharpener\b[^.]{0,40}/i,
        /\bknife sharpener\b[^.]{0,40}/i,
        /\bhorl\s*\d+\b[^.]{0,40}/i,
        /\bRFID blocking\b[^.]{0,40}/i,
        /\blifetime warranty\b[^.]{0,40}/i,
        /\bminimalist wallet\b[^.]{0,40}/i,
      ]
      for (const pattern of signaturePatterns) {
        const match = text.match(pattern)
        if (match) phrases.push(match[0].trim())
      }
    }
  }

  phrases.push(...extractProductNamesFromUrls(ipAssets))

  return [...new Set(phrases.map((p) => p.trim()).filter((p) => p.length >= 8))].slice(0, 6)
}

export function extractCoreBrandToken(brand: BrandProfile, ipAssets?: IpAsset[]) {
  const domain = inferBrandName(brand.websiteUrl)
  if (domain && !isGenericBrandName(domain)) return normalizeBrandNameForSearch(domain)

  const aliases = brandAliasesFromProfile(brand, ipAssets)
  const shortest = aliases
    .map((alias) => normalizeBrandNameForSearch(alias))
    .filter((alias) => alias.length >= 3 && !isGenericBrandName(alias))
    .sort((a, b) => a.length - b.length)[0]

  return shortest ?? normalizeBrandNameForSearch(brand.brandName)
}

export function extractKeywordSearchTerms(context: SearchTermContext) {
  const terms = new Set<string>()
  const coreBrand = extractCoreBrandToken(context.brand, context.ipAssets)

  if (isUsefulTerm(coreBrand)) terms.add(coreBrand)

  for (const alias of brandAliasesFromProfile(context.brand, context.ipAssets)) {
    if (isUsefulTerm(alias)) terms.add(normalizeBrandNameForSearch(alias))
  }

  for (const keyword of context.keywords) {
    const trimmed = normalizeBrandNameForSearch(keyword.trim())
    if (isUsefulTerm(trimmed)) terms.add(trimmed)
  }

  for (const asset of context.ipAssets ?? []) {
    if (asset.type === "trademark" && isUsefulTerm(asset.value)) {
      terms.add(normalizeBrandNameForSearch(asset.value))
    }
  }

  for (const phrase of extractProductPhrases(context.ipAssets)) {
    terms.add(phrase)
  }

  return [...terms].slice(0, MAX_KEYWORD_TERMS)
}

export function extractPublicWwwSnippets(context: SearchTermContext) {
  const snippets = new Set<string>()
  const coreBrand = extractCoreBrandToken(context.brand, context.ipAssets)

  if (isUsefulTerm(coreBrand)) snippets.add(coreBrand)

  for (const alias of brandAliasesFromProfile(context.brand, context.ipAssets)) {
    if (isUsefulTerm(alias)) snippets.add(normalizeBrandNameForSearch(alias))
  }

  for (const asset of context.ipAssets ?? []) {
    if (asset.type === "trademark" && isUsefulTerm(asset.value)) {
      snippets.add(normalizeBrandNameForSearch(asset.value))
    }
  }

  for (const phrase of extractProductPhrases(context.ipAssets)) {
    snippets.add(phrase)
  }

  return [...snippets].slice(0, MAX_SNIPPET_TERMS)
}

export function extractCopycatSearchPhrases(context: SearchTermContext) {
  const phrases = extractProductPhrases(context.ipAssets)
  const coreBrand = extractCoreBrandToken(context.brand, context.ipAssets)
  const expanded = new Set<string>(phrases)

  for (const phrase of phrases) {
    expanded.add(`${coreBrand} ${phrase}`)
    expanded.add(`${phrase} ${coreBrand}`)
  }

  expanded.add(`compatible with ${coreBrand}`)
  expanded.add(`for ${coreBrand}`)
  expanded.add(`${coreBrand} style`)
  expanded.add(`${coreBrand} clone`)
  expanded.add(`${coreBrand} replica`)

  return [...expanded].filter((phrase) => phrase.length >= 8).slice(0, 8)
}

export function quotePublicWwwPhrase(value: string) {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return `"${escaped}"`
}
