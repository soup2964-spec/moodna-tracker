import type { Marketplace } from "./types.js"

export type ScanTargetConfig = {
  id: Marketplace
  label: string
  category: "ecommerce" | "creator_piracy"
  siteQuery: string
}

export const scanTargets: ScanTargetConfig[] = [
  { id: "amazon", label: "Amazon", category: "ecommerce", siteQuery: "site:amazon.com" },
  { id: "walmart", label: "Walmart", category: "ecommerce", siteQuery: "site:walmart.com" },
  { id: "ebay", label: "eBay", category: "ecommerce", siteQuery: "site:ebay.com" },
  { id: "etsy", label: "Etsy", category: "ecommerce", siteQuery: "site:etsy.com" },
  { id: "aliexpress", label: "AliExpress", category: "ecommerce", siteQuery: "site:aliexpress.com" },
  { id: "shopify", label: "Shopify stores", category: "ecommerce", siteQuery: "site:myshopify.com OR inurl:/products" },
  { id: "web", label: "Similar sites", category: "ecommerce", siteQuery: "" },
  { id: "reddit", label: "Reddit", category: "creator_piracy", siteQuery: "site:reddit.com" },
  { id: "telegram", label: "Telegram", category: "creator_piracy", siteQuery: "site:t.me" },
  { id: "twitter", label: "X / Twitter", category: "creator_piracy", siteQuery: "site:x.com OR site:twitter.com" },
  { id: "discord", label: "Discord", category: "creator_piracy", siteQuery: "site:discord.com" },
  { id: "kemono", label: "Kemono / Coomer", category: "creator_piracy", siteQuery: "site:kemono.cr OR site:kemono.su" },
  { id: "bunkr", label: "Bunkr / Cyberdrop", category: "creator_piracy", siteQuery: "site:bunkr.cr OR site:bunkr.si" },
  { id: "simpcity", label: "SimpCity", category: "creator_piracy", siteQuery: "site:simpcity.cr" },
  { id: "thothub", label: "Thothub", category: "creator_piracy", siteQuery: "site:thothub.to" },
]

export const ecommerceMarketplaces = scanTargets
  .filter((target) => target.category === "ecommerce")
  .map((target) => target.id)

export const creatorPiracyMarketplaces = scanTargets
  .filter((target) => target.category === "creator_piracy")
  .map((target) => target.id)

export function getScanTargetLabel(marketplace: Marketplace) {
  return scanTargets.find((target) => target.id === marketplace)?.label ?? marketplace
}

export function getScanTarget(marketplace: Marketplace) {
  return scanTargets.find((target) => target.id === marketplace)
}

export function isCreatorPiracyTarget(marketplace: Marketplace) {
  return creatorPiracyMarketplaces.includes(marketplace)
}

export function isEcommerceTarget(marketplace: Marketplace) {
  return ecommerceMarketplaces.includes(marketplace)
}

const CREATOR_DOMAINS = ["onlyfans.com", "fansly.com", "patreon.com", "loyalfans.com"]

export function isCreatorProfileUrl(websiteUrl: string) {
  try {
    const hostname = new URL(websiteUrl).hostname.replace(/^www\./, "")
    return CREATOR_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  } catch {
    return CREATOR_DOMAINS.some((domain) => websiteUrl.includes(domain))
  }
}

export function scanMarketplacesForBrand(websiteUrl: string) {
  if (isCreatorProfileUrl(websiteUrl)) {
    return scanTargets.map((target) => target.id)
  }
  return ecommerceMarketplaces
}

export function alertTitleForResult(marketplace: Marketplace, brandName: string) {
  const label = getScanTargetLabel(marketplace)
  if (isCreatorPiracyTarget(marketplace)) {
    return `Unauthorized ${brandName} content on ${label}`
  }
  return `New ${label} copycat found`
}
