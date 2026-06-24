import { readFile, writeFile } from "node:fs/promises"
import { sanitizeTrackerState } from "../server/lib/resultSanitizer.ts"

const path = new URL("../server/data/tracker-state.json", import.meta.url)
const raw = await readFile(path, "utf8")
const state = JSON.parse(raw)
const before = state.scanResults?.length ?? 0
const sanitized = sanitizeTrackerState(state)
const after = sanitized.scanResults.length
await writeFile(path, JSON.stringify(sanitized, null, 2))
console.log(`Purged scan results: ${before} -> ${after}`)
console.log(`Alerts remaining: ${sanitized.alerts.length}`)
