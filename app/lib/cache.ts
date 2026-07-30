import { CrawlResult } from "./types"

const resultCache = new Map<string, { result: CrawlResult; timestamp: number }>()
const TTL = 30 * 60 * 1000

export function cacheResult(id: string, result: CrawlResult): void {
  resultCache.set(id, { result, timestamp: Date.now() })
}

export function getCachedResult(id: string): CrawlResult | null {
  const entry = resultCache.get(id)
  if (!entry) return null
  if (Date.now() - entry.timestamp > TTL) {
    resultCache.delete(id)
    return null
  }
  return entry.result
}

export function generateCrawlId(): string {
  return Math.random().toString(36).substring(2, 10)
}