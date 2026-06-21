import type { BrandProfile, Marketplace, ScanResult } from "./trackerTypes"
import { buildSyntheticScanResult, getScanTargetLabel, isCreatorPiracyTarget } from "./scanTargets"

export type MarketplaceScanContext = {
  brand: BrandProfile
  keywords: string[]
  riskThreshold: number
}

export type MarketplaceConnector = {
  marketplace: Marketplace
  displayName: string
  supportsOfficialApi: boolean
  scan(context: MarketplaceScanContext): Promise<Omit<ScanResult, "id" | "scanJobId" | "brandProfileId" | "createdAt">[]>
  buildTakedownEndpoint(): string
}

function syntheticEcommerceResult(
  marketplace: Marketplace,
  displayName: string,
  context: MarketplaceScanContext,
  confidenceOffset: number,
): Omit<ScanResult, "id" | "scanJobId" | "brandProfileId" | "createdAt"> {
  return {
    marketplace,
    sellerName: `${context.brand.brandName.replace(/\s+/g, "")}${displayName}Deals`,
    listingTitle: `${context.brand.brandName} listing with suspected protected asset reuse`,
    listingUrl: `https://${marketplace}.example.com/suspected-${encodeURIComponent(context.brand.brandName.toLowerCase())}`,
    confidence: Math.min(98, context.riskThreshold + confidenceOffset),
    matchReason: `${displayName} result matched brand keywords (${context.keywords.slice(0, 3).join(", ")}) and official site signals.`,
    status: "new",
    evidenceUrls: [context.brand.websiteUrl],
  }
}

function createConnector(
  marketplace: Marketplace,
  displayName: string,
  supportsOfficialApi: boolean,
  confidenceOffset: number,
): MarketplaceConnector {
  return {
    marketplace,
    displayName,
    supportsOfficialApi,
    async scan(context) {
      return [syntheticEcommerceResult(marketplace, displayName, context, confidenceOffset)]
    },
    buildTakedownEndpoint() {
      return `marketplace:${marketplace}:takedown`
    },
  }
}

function createPiracyConnector(
  marketplace: Marketplace,
  displayName: string,
  confidenceOffset: number,
): MarketplaceConnector {
  return {
    marketplace,
    displayName,
    supportsOfficialApi: false,
    async scan(context) {
      const result = buildSyntheticScanResult(
        marketplace,
        context.brand,
        {
          id: "connector-scan",
          brandProfileId: context.brand.id,
          marketplaces: [marketplace],
          keywords: context.keywords,
          status: "running",
          frequency: "once",
          riskThreshold: context.riskThreshold,
          createdAt: new Date().toISOString(),
        },
        0,
      )
      return [
        {
          ...result,
          confidence: Math.min(98, context.riskThreshold + confidenceOffset),
          matchReason: `${displayName} matched creator keywords (${context.keywords.slice(0, 3).join(", ")}) and protected media fingerprints.`,
        },
      ]
    },
    buildTakedownEndpoint() {
      return `platform:${marketplace}:dmca`
    },
  }
}

export const marketplaceConnectors: Record<Marketplace, MarketplaceConnector> = {
  amazon: createConnector("amazon", "Amazon", true, 16),
  walmart: createConnector("walmart", "Walmart", true, 14),
  ebay: createConnector("ebay", "eBay", true, 12),
  etsy: createConnector("etsy", "Etsy", true, 10),
  aliexpress: createConnector("aliexpress", "AliExpress", false, 11),
  shopify: createConnector("shopify", "Shopify stores", false, 13),
  reddit: createPiracyConnector("reddit", getScanTargetLabel("reddit"), 9),
  telegram: createPiracyConnector("telegram", getScanTargetLabel("telegram"), 12),
  twitter: createPiracyConnector("twitter", getScanTargetLabel("twitter"), 10),
  discord: createPiracyConnector("discord", getScanTargetLabel("discord"), 8),
  kemono: createPiracyConnector("kemono", getScanTargetLabel("kemono"), 14),
  bunkr: createPiracyConnector("bunkr", getScanTargetLabel("bunkr"), 11),
  simpcity: createPiracyConnector("simpcity", getScanTargetLabel("simpcity"), 10),
  thothub: createPiracyConnector("thothub", getScanTargetLabel("thothub"), 13),
}

export function connectorFor(marketplace: Marketplace) {
  return marketplaceConnectors[marketplace]
}

export function isPiracyConnector(marketplace: Marketplace) {
  return isCreatorPiracyTarget(marketplace)
}
