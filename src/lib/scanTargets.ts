import type { BrandProfile, Marketplace, ScanJob, ScanResult } from "./trackerTypes"

export type ScanTargetCategory = "ecommerce" | "creator_piracy"

export type ScanTargetConfig = {
  id: Marketplace
  label: string
  category: ScanTargetCategory
}

export const scanTargets: ScanTargetConfig[] = [
  { id: "amazon", label: "Amazon", category: "ecommerce" },
  { id: "walmart", label: "Walmart", category: "ecommerce" },
  { id: "ebay", label: "eBay", category: "ecommerce" },
  { id: "etsy", label: "Etsy", category: "ecommerce" },
  { id: "aliexpress", label: "AliExpress", category: "ecommerce" },
  { id: "shopify", label: "Shopify stores", category: "ecommerce" },
  { id: "web", label: "Similar sites", category: "ecommerce" },
  { id: "reddit", label: "Reddit", category: "creator_piracy" },
  { id: "telegram", label: "Telegram", category: "creator_piracy" },
  { id: "twitter", label: "X / Twitter", category: "creator_piracy" },
  { id: "discord", label: "Discord", category: "creator_piracy" },
  { id: "kemono", label: "Kemono / Coomer", category: "creator_piracy" },
  { id: "bunkr", label: "Bunkr / Cyberdrop", category: "creator_piracy" },
  { id: "simpcity", label: "SimpCity", category: "creator_piracy" },
  { id: "thothub", label: "Thothub", category: "creator_piracy" },
]

export const creatorPiracyMarketplaces = scanTargets
  .filter((target) => target.category === "creator_piracy")
  .map((target) => target.id)

export const ecommerceMarketplaces = scanTargets
  .filter((target) => target.category === "ecommerce")
  .map((target) => target.id)

export const allScanMarketplaces = scanTargets.map((target) => target.id)

export function scanMarketplacesForBrand(websiteUrl: string) {
  if (isCreatorProfileUrl(websiteUrl)) return allScanMarketplaces
  return ecommerceMarketplaces
}

const labelByMarketplace = Object.fromEntries(
  scanTargets.map((target) => [target.id, target.label]),
) as Record<Marketplace, string>

export function getScanTargetLabel(marketplace: Marketplace) {
  return labelByMarketplace[marketplace] ?? marketplace
}

export function isCreatorPiracyTarget(marketplace: Marketplace) {
  return creatorPiracyMarketplaces.includes(marketplace)
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

export function inferCreatorHandle(websiteUrl: string) {
  try {
    const handle = new URL(websiteUrl).pathname.replace(/^\//, "").split("/")[0]
    return handle || ""
  } catch {
    return ""
  }
}

type PiracyResultTemplate = (
  brand: BrandProfile,
  slug: string,
) => Pick<ScanResult, "sellerName" | "listingTitle" | "listingUrl" | "matchReason" | "evidenceUrls">

const piracyResultTemplates: Record<
  Extract<
    Marketplace,
    "reddit" | "telegram" | "twitter" | "discord" | "kemono" | "bunkr" | "simpcity" | "thothub"
  >,
  PiracyResultTemplate
> = {
  reddit: (brand, slug) => ({
    sellerName: `u/${slug}_archive`,
    listingTitle: `${brand.brandName} leaked content megathread`,
    listingUrl: `https://reddit.com/r/leaks/comments/demo/${slug}`,
    matchReason: `Reddit post title, comments, and outbound links match ${brand.brandName} creator keywords and watermarked media.`,
    evidenceUrls: [brand.websiteUrl, `https://reddit.com/r/leaks/comments/demo/${slug}`],
  }),
  telegram: (brand, slug) => ({
    sellerName: `@${slug}_leaks`,
    listingTitle: `${brand.brandName} full pack / mega folder`,
    listingUrl: `https://t.me/${slug}_leaks/1284`,
    matchReason: `Telegram channel name and pinned posts distribute unauthorized ${brand.brandName} content.`,
    evidenceUrls: [brand.websiteUrl, `https://t.me/${slug}_leaks`],
  }),
  twitter: (brand, slug) => ({
    sellerName: `@${slug}Vault`,
    listingTitle: `${brand.brandName} preview thread with leak links`,
    listingUrl: `https://x.com/${slug}Vault/status/demo`,
    matchReason: `X account promotes stolen ${brand.brandName} media and routes traffic to external leak hosts.`,
    evidenceUrls: [brand.websiteUrl, `https://x.com/${slug}Vault/status/demo`],
  }),
  discord: (brand, slug) => ({
    sellerName: `${slug}-vault server`,
    listingTitle: `#premium-leaks channel sharing ${brand.brandName} content`,
    listingUrl: `https://discord.com/channels/demo/${slug}-vault`,
    matchReason: `Discord server channels and invite funnels match ${brand.brandName} creator name and reposted media.`,
    evidenceUrls: [brand.websiteUrl],
  }),
  kemono: (brand, slug) => ({
    sellerName: `${slug} archive`,
    listingTitle: `${brand.brandName} mirrored posts and paid content dump`,
    listingUrl: `https://kemono.cr/${slug}`,
    matchReason: `Kemono/Coomer archive republishes paywalled ${brand.brandName} posts without authorization.`,
    evidenceUrls: [brand.websiteUrl, `https://kemono.cr/${slug}`],
  }),
  bunkr: (brand, slug) => ({
    sellerName: `${slug}-dump`,
    listingTitle: `${brand.brandName} photo/video album upload`,
    listingUrl: `https://bunkr.cr/a/${slug}-leaks`,
    matchReason: `Bunkr album filenames and preview thumbnails match protected ${brand.brandName} creator media.`,
    evidenceUrls: [brand.websiteUrl, `https://bunkr.cr/a/${slug}-leaks`],
  }),
  simpcity: (brand, slug) => ({
    sellerName: `${slug}_fan`,
    listingTitle: `${brand.brandName} leak discussion thread`,
    listingUrl: `https://simpcity.cr/threads/${slug}-onlyfans-leaks`,
    matchReason: `SimpCity thread aggregates unauthorized ${brand.brandName} downloads and re-upload links.`,
    evidenceUrls: [brand.websiteUrl, `https://simpcity.cr/threads/${slug}-onlyfans-leaks`],
  }),
  thothub: (brand, slug) => ({
    sellerName: `${slug} mirror`,
    listingTitle: `${brand.brandName} stolen videos reposted`,
    listingUrl: `https://thothub.to/search/${slug}`,
    matchReason: `Tube mirror pages host re-uploaded ${brand.brandName} videos with matching titles and thumbnails.`,
    evidenceUrls: [brand.websiteUrl, `https://thothub.to/search/${slug}`],
  }),
}

export function buildSyntheticScanResult(
  marketplace: Marketplace,
  brand: BrandProfile,
  _scanJob: ScanJob,
  index: number,
): Omit<ScanResult, "id" | "scanJobId" | "brandProfileId" | "createdAt"> {
  const confidence = Math.min(98, 84 + index * 3)
  const slug = brand.brandName.toLowerCase().replace(/\s+/g, "")

  if (isCreatorPiracyTarget(marketplace)) {
    const template = piracyResultTemplates[marketplace as keyof typeof piracyResultTemplates]
    const piracyResult = template(brand, slug)
    return {
      marketplace,
      confidence,
      status: confidence >= 90 ? "new" : "reviewing",
      ...piracyResult,
    }
  }

  return {
    marketplace,
    sellerName: `${brand.brandName.replace(/\s+/g, "")}Deals${index + 1}`,
    listingTitle: `${brand.brandName} product listing using protected brand assets`,
    listingUrl: `https://${marketplace}.example.com/${encodeURIComponent(brand.brandName.toLowerCase())}`,
    confidence,
    matchReason: `Matched ${brand.brandName} keywords, product copy, and suspected image reuse on ${getScanTargetLabel(marketplace)}.`,
    status: confidence >= 90 ? "new" : "reviewing",
    evidenceUrls: [brand.websiteUrl],
  }
}

export function alertTitleForResult(marketplace: Marketplace, brandName: string) {
  if (isCreatorPiracyTarget(marketplace)) {
    return `Unauthorized ${brandName} content on ${getScanTargetLabel(marketplace)}`
  }
  return `New ${getScanTargetLabel(marketplace)} copycat found`
}
