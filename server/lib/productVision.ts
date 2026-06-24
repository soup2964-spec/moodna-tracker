import { collectKieGeminiResponse } from "./kieGemini.js"
import { fetchImageAsBase64 } from "./imageFetch.js"
import { hasKieAi } from "./env.js"

export type GenericProductProfile = {
  sourceImageUrl: string
  genericDescription: string
  distinctiveFeatures: string[]
  searchQueries: string[]
}

function parseVisionPayload(text: string): GenericProductProfile | null {
  const trimmed = text.trim()
  const attempts = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim(),
    (() => {
      const start = trimmed.indexOf("{")
      const end = trimmed.lastIndexOf("}")
      return start >= 0 && end > start ? trimmed.slice(start, end + 1) : undefined
    })(),
  ].filter((value): value is string => Boolean(value))

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>
      const genericDescription =
        typeof parsed.genericDescription === "string" ? parsed.genericDescription.trim() : ""
      const distinctiveFeatures = Array.isArray(parsed.distinctiveFeatures)
        ? parsed.distinctiveFeatures.filter((row): row is string => typeof row === "string").slice(0, 6)
        : []
      const searchQueries = Array.isArray(parsed.searchQueries)
        ? parsed.searchQueries.filter((row): row is string => typeof row === "string").slice(0, 5)
        : []

      if (!genericDescription || searchQueries.length === 0) continue

      return {
        sourceImageUrl: "",
        genericDescription,
        distinctiveFeatures,
        searchQueries,
      }
    } catch {
      // try next
    }
  }

  return null
}

export async function buildGenericProductProfile(imageUrl: string): Promise<GenericProductProfile | null> {
  if (!hasKieAi()) return null

  const image = await fetchImageAsBase64(imageUrl)
  if (!image) return null

  const response = await collectKieGeminiResponse({
    stream: true,
    thinkingLevel: "low",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Analyze this product photo for counterfeit/dropshipper hunting.",
              "Ignore ALL logos, brand names, text overlays, watermarks, and packaging text.",
              "Describe only the physical product: shape, materials, colors, proportions, and distinctive design features.",
              "",
              "Return ONLY JSON:",
              JSON.stringify({
                genericDescription: "rolling knife sharpener with walnut base and gold grinding wheel",
                distinctiveFeatures: ["cylindrical grinding disc", "magnetic angle guide", "walnut wood base"],
                searchQueries: [
                  "rolling knife sharpener walnut magnetic",
                  "manual roller knife sharpener gold disc",
                  "desktop rolling sharpener wood base",
                ],
              }),
              "",
              "Rules:",
              "- searchQueries must NOT contain any brand or trademark names",
              "- searchQueries should work on AliExpress, Amazon, and generic Shopify stores",
              "- Focus on visual/product-type phrases dropshippers use",
            ].join("\n"),
          },
          { inlineData: image },
        ],
      },
    ],
  })

  const profile = parseVisionPayload(response.text || response.thoughts.join("\n"))
  if (!profile) return null

  return { ...profile, sourceImageUrl: imageUrl }
}

export async function buildGenericProfilesFromImages(imageUrls: string[], maxImages = 3) {
  const profiles: GenericProductProfile[] = []

  for (const imageUrl of imageUrls.slice(0, maxImages)) {
    try {
      const profile = await buildGenericProductProfile(imageUrl)
      if (profile) profiles.push(profile)
    } catch (error) {
      console.warn(`Generic product vision failed for ${imageUrl}:`, error)
    }
  }

  return profiles
}
