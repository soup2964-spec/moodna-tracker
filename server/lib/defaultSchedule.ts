import type { BrandProfile, Marketplace, ScanSchedule } from "./types.js"
import { env } from "./env.js"
import { createId, now } from "./ids.js"
import { inferCreatorHandle, isCreatorProfileUrl } from "./urlUtils.js"
import { creatorPiracyMarketplaces, ecommerceMarketplaces } from "./scanTargets.js"

const ECOMMERCE_MARKETPLACES: Marketplace[] = [
  "amazon",
  "walmart",
  "ebay",
  "etsy",
  "shopify",
]

const PM_ECOMMERCE_MARKETPLACES: Marketplace[] = [
  "amazon",
  "walmart",
  "ebay",
  "etsy",
  "shopify",
]

const PIRACY_MARKETPLACES: Marketplace[] = [...creatorPiracyMarketplaces]

export function staggerMinutesForBrand(brandProfileId: string) {
  let hash = 0
  for (let i = 0; i < brandProfileId.length; i += 1) {
    hash = (hash + brandProfileId.charCodeAt(i)) % 30
  }
  return hash
}

export function defaultKeywordsForBrand(brand: BrandProfile) {
  const creator = isCreatorProfileUrl(brand.websiteUrl)
  const handle = creator ? inferCreatorHandle(brand.websiteUrl) : ""
  return [brand.brandName, handle, `${brand.brandName} official`].filter(Boolean)
}

export function buildDefaultScanSchedule(brand: BrandProfile): ScanSchedule {
  const creator = isCreatorProfileUrl(brand.websiteUrl)
  const timestamp = now()

  return {
    id: createId("schedule"),
    brandProfileId: brand.id,
    enabled: true,
    frequency: "twice_daily",
    amMarketplaces: [...ECOMMERCE_MARKETPLACES],
    pmMarketplaces: creator ? [...PIRACY_MARKETPLACES] : [...PM_ECOMMERCE_MARKETPLACES],
    keywords: defaultKeywordsForBrand(brand),
    timezone: env.scanTimezone,
    amRunAt: env.scanAmTime,
    pmRunAt: env.scanPmTime,
    staggerMinutes: staggerMinutesForBrand(brand.id),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export { ecommerceMarketplaces, creatorPiracyMarketplaces }
