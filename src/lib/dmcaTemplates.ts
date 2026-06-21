import type { BrandProfile, ScanResult, TakedownRequest } from "./trackerTypes"

export type DmcaPackage = {
  subject: string
  body: string
  evidence: string[]
}

export function buildDmcaPackage(
  brand: BrandProfile,
  result: ScanResult,
  request: TakedownRequest,
): DmcaPackage {
  const marketplace = request.submittedTo ?? result.marketplace

  return {
    subject: `DMCA takedown request for ${brand.brandName} infringement on ${marketplace}`,
    evidence: result.evidenceUrls,
    body: [
      `To ${marketplace} Trust and Safety,`,
      "",
      `I am ${brand.ownerName}, owner or authorized representative of ${brand.brandName}.`,
      `The listing below appears to use protected ${request.claimType} material without authorization:`,
      "",
      `Listing: ${result.listingTitle}`,
      `Seller: ${result.sellerName}`,
      `URL: ${result.listingUrl}`,
      `Evidence: ${result.matchReason}`,
      "",
      request.dmcaStatement,
      "",
      `Authorized agent: ${brand.authorizedAgent}`,
      `Contact: ${brand.ownerEmail}`,
    ].join("\n"),
  }
}
