import { CrawlResult } from "./types"

const resultCache = new Map<string, { result: CrawlResult; timestamp: number }>()
const TTL = 30 * 60 * 1000

export function cacheResult(id: string, result: CrawlResult): void {
  const nodeCount = Object.keys(result.nodes || {}).length
  const edgeCount = (result.edges || []).length
  console.log(`[CACHE] Storing result for crawlId="${id}" (${nodeCount} nodes, ${edgeCount} edges)`)
  resultCache.set(id, { result, timestamp: Date.now() })
}

export function getCachedResult(id: string): CrawlResult | null {
  const entry = resultCache.get(id)
  if (!entry) {
    console.log(`[CACHE] Miss for crawlId="${id}" — not found (${resultCache.size} entries in cache)`)
    console.log(`[CACHE] Available keys: ${Array.from(resultCache.keys()).join(", ") || "none"}`)
    return null
  }
  if (Date.now() - entry.timestamp > TTL) {
    console.log(`[CACHE] Expired for crawlId="${id}" (age: ${Date.now() - entry.timestamp}ms > ${TTL}ms)`)
    resultCache.delete(id)
    return null
  }
  const nodeCount = Object.keys(entry.result.nodes || {}).length
  console.log(`[CACHE] Hit for crawlId="${id}" (${nodeCount} nodes, age: ${Date.now() - entry.timestamp}ms)`)
  return entry.result
}

export function generateCrawlId(): string {
  return Math.random().toString(36).substring(2, 10)
}
