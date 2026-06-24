const MAX_IMAGE_BYTES = 4_000_000

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
}

function mimeTypeFromUrl(url: string) {
  const match = url.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i)
  if (!match) return "image/jpeg"
  return MIME_BY_EXT[match[1].toLowerCase()] ?? "image/jpeg"
}

export async function fetchImageAsBase64(imageUrl: string) {
  const response = await fetch(imageUrl, {
    headers: { Accept: "image/*" },
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) return null

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return null

  return {
    mimeType: response.headers.get("content-type")?.split(";")[0]?.trim() || mimeTypeFromUrl(imageUrl),
    data: buffer.toString("base64"),
  }
}
