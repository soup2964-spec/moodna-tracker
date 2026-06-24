import { randomUUID } from "node:crypto"
import { hasSupabase } from "./env.js"

export function now() {
  return new Date().toISOString()
}

export function createId(prefix: string) {
  if (hasSupabase()) return randomUUID()
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}
