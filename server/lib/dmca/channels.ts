import type { Marketplace } from "../types.js"
import { getDomain } from "../urlUtils.js"
import type { DmcaChannel } from "./types.js"

const MARKETPLACE_CHANNELS: Partial<Record<Marketplace, DmcaChannel>> = {
  amazon: {
    id: "amazon-brand-registry",
    label: "Amazon Report Infringement",
    method: "portal",
    portalUrl: "https://www.amazon.com/report/infringement",
    notes: "Use Brand Registry or the public infringement form if eligible.",
  },
  walmart: {
    id: "walmart-ip",
    label: "Walmart IP Claims",
    method: "email",
    recipientEmail: "BrandProtection@walmart.com",
    portalUrl: "https://corporate.walmart.com/ip",
  },
  ebay: {
    id: "ebay-veiro",
    label: "eBay Verified Rights Owner (VeRO)",
    method: "portal",
    portalUrl: "https://www.ebay.com/seller-center/listings-and-marketing/verified-rights-owner-program",
  },
  etsy: {
    id: "etsy-ip",
    label: "Etsy IP Reporting",
    method: "portal",
    portalUrl: "https://www.etsy.com/legal/ip",
  },
  aliexpress: {
    id: "aliexpress-ip",
    label: "AliExpress IP Protection",
    method: "portal",
    portalUrl: "https://ipp.alibabagroup.com/",
  },
  shopify: {
    id: "shopify-dmca",
    label: "Shopify IP Report",
    method: "portal",
    portalUrl: "https://www.shopify.com/legal/tools/report-an-issue/dmca",
    recipientEmail: "legal@shopify.com",
    notes:
      "Log in with a free Shopify account to use the copyright/trademark form. Requires page-level product URLs. Email is an alternate channel.",
  },
}

function guessWebChannel(listingUrl: string): DmcaChannel {
  const domain = getDomain(listingUrl)
  return {
    id: `web-${domain}`,
    label: `Site owner (${domain})`,
    method: "email",
    recipientEmail: `abuse@${domain}`,
    notes: `Fallback abuse contact for ${domain}. Verify the address or use legal@ / dmca@ if abuse@ bounces.`,
  }
}

export function resolveDmcaChannel(marketplace: Marketplace, listingUrl: string): DmcaChannel {
  const configured = MARKETPLACE_CHANNELS[marketplace]
  if (configured) return configured
  if (marketplace === "web") return guessWebChannel(listingUrl)
  return {
    id: `${marketplace}-manual`,
    label: `${marketplace} (manual)`,
    method: "manual",
    notes: "No automated channel configured for this platform. Export the notice and file manually.",
  }
}
