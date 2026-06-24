import type { BrandProfile, ClaimType, IpAsset, Marketplace, ScanResult } from "../types.js"
import { resolveDmcaChannel } from "./channels.js"
import type { DmcaNoticePackage } from "./types.js"
import { now } from "../ids.js"

function claimTypeLabel(claimType: ClaimType) {
  if (claimType === "trademark") return "trademark"
  if (claimType === "counterfeit") return "counterfeit product"
  return "copyright"
}

function copyrightedWorksDescription(brand: BrandProfile, ipAssets: IpAsset[]) {
  const lines = [`Official brand website: ${brand.websiteUrl}`]

  for (const asset of ipAssets) {
    if (asset.type === "trademark") lines.push(`Registered/marked trademark: ${asset.value}`)
    if (asset.type === "product_url") lines.push(`Product page: ${asset.value}`)
    if (asset.type === "product_image") lines.push(`Product image: ${asset.value}`)
    if (asset.type === "copyright_text") lines.push(`Copyrighted text: ${asset.value.slice(0, 200)}`)
  }

  return lines.slice(0, 12).join("\n")
}

export function buildDmcaNoticePackage(input: {
  brand: BrandProfile
  result: ScanResult
  ipAssets: IpAsset[]
  claimType: ClaimType
  marketplace?: Marketplace
}): DmcaNoticePackage {
  const marketplace = input.marketplace ?? input.result.marketplace
  const channel = resolveDmcaChannel(marketplace, input.result.listingUrl)
  const workType = claimTypeLabel(input.claimType)
  const today = new Date().toISOString().slice(0, 10)

  const perjuryStatement =
    "I have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law. " +
    "I swear, under penalty of perjury, that the information in this notification is accurate and that I am the copyright owner or authorized to act on behalf of the owner of an exclusive right that is allegedly infringed."

  const body = [
    `DMCA Takedown Notice — ${input.brand.brandName}`,
    `Date: ${today}`,
    "",
    "To Whom It May Concern:",
    "",
    `I am ${input.brand.ownerName}, owner or authorized agent of ${input.brand.brandName} (${input.brand.websiteUrl}).`,
    "",
    "1. IDENTIFICATION OF COPYRIGHTED WORK",
    `The following original ${workType} material is being infringed:`,
    copyrightedWorksDescription(input.brand, input.ipAssets),
    "",
    "2. IDENTIFICATION OF INFRINGING MATERIAL",
    `Listing title: ${input.result.listingTitle}`,
    `Seller / site: ${input.result.sellerName}`,
    `Infringing URL: ${input.result.listingUrl}`,
    `Detection evidence: ${input.result.matchReason}`,
    "",
    "3. CONTACT INFORMATION",
    `Name: ${input.brand.ownerName}`,
    `Email: ${input.brand.ownerEmail}`,
    `Authorized agent: ${input.brand.authorizedAgent || input.brand.ownerName}`,
    "",
    "4. STATEMENT OF GOOD FAITH AND ACCURACY",
    perjuryStatement,
    "",
    "5. SIGNATURE",
    `/s/ ${input.brand.ownerName}`,
    `Authorized agent for ${input.brand.brandName}`,
  ].join("\n")

  return {
    subject: `DMCA Notice — Unauthorized use of ${input.brand.brandName} ${workType} material`,
    body,
    evidence: input.result.evidenceUrls,
    channel,
    marketplace,
    listingUrl: input.result.listingUrl,
    listingTitle: input.result.listingTitle,
    sellerName: input.result.sellerName,
    claimType: input.claimType,
    generatedAt: now(),
  }
}
