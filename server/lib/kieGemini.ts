import { env, hasKieAi } from "./env.js"

const KIE_GEMINI_BASE = "https://api.kie.ai/gemini/v1/models"

export type KieContent = {
  role: "user" | "model"
  parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | { functionResponse: { name: string; response: Record<string, unknown> } }
  >
}

export type KieStreamEvent =
  | { type: "thought"; text: string }
  | { type: "text"; text: string }
  | { type: "functionCall"; name: string; args: Record<string, unknown> }

export type KieGenerateOptions = {
  contents: KieContent[]
  tools?: Array<{
    functionDeclarations: Array<{
      name: string
      description: string
      parameters: Record<string, unknown>
    }>
  }>
  stream?: boolean
  thinkingLevel?: "low" | "medium" | "high"
}

function getModelPath(model = env.kieGeminiModel) {
  return `${KIE_GEMINI_BASE}/${model}:streamGenerateContent`
}

function extractParts(payload: unknown): KieContent["parts"] {
  if (!payload || typeof payload !== "object") return []

  const record = payload as Record<string, unknown>
  const candidates = record.candidates as Array<{ content?: { parts?: KieContent["parts"] } }> | undefined
  if (candidates?.[0]?.content?.parts?.length) {
    return candidates[0].content.parts
  }

  const content = record.content as { parts?: KieContent["parts"] } | undefined
  return content?.parts ?? []
}

function parseStreamLine(line: string): KieStreamEvent[] {
  const trimmed = line.trim()
  if (!trimmed || trimmed === "data: [DONE]") return []

  const jsonText = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed
  if (!jsonText) return []

  try {
    const payload = JSON.parse(jsonText) as unknown
    const events: KieStreamEvent[] = []

    for (const part of extractParts(payload)) {
      if ("text" in part && typeof part.text === "string" && part.text.trim()) {
        const thought = (part as { thought?: boolean }).thought === true
        events.push({ type: thought ? "thought" : "text", text: part.text })
      }

      if ("functionCall" in part && part.functionCall?.name) {
        events.push({
          type: "functionCall",
          name: part.functionCall.name,
          args: part.functionCall.args ?? {},
        })
      }
    }

    return events
  } catch {
    return []
  }
}

export async function* streamKieGemini(options: KieGenerateOptions): AsyncGenerator<KieStreamEvent> {
  if (!hasKieAi()) {
    throw new Error("KIE_AI_API_KEY is not configured")
  }

  const response = await fetch(getModelPath(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.kieAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      stream: options.stream ?? true,
      contents: options.contents,
      tools: options.tools,
      generationConfig: {
        thinkingConfig: {
          includeThoughts: true,
          thinkingLevel: options.thinkingLevel ?? "high",
        },
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`KIE Gemini request failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`)
  }

  if (!response.body) {
    throw new Error("KIE Gemini returned an empty response body")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      for (const event of parseStreamLine(line)) {
        yield event
      }
    }
  }

  if (buffer.trim()) {
    for (const event of parseStreamLine(buffer)) {
      yield event
    }
  }
}

export async function collectKieGeminiResponse(options: KieGenerateOptions) {
  const thoughts: string[] = []
  const texts: string[] = []
  const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = []

  for await (const event of streamKieGemini(options)) {
    if (event.type === "thought") thoughts.push(event.text)
    if (event.type === "text") texts.push(event.text)
    if (event.type === "functionCall") functionCalls.push({ name: event.name, args: event.args })
  }

  return { thoughts, text: texts.join(""), functionCalls }
}
