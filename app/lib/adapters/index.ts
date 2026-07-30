import { BacklinkSource, BacklinkRecord } from "../types"
import { hackernewsAdapter } from "./hackernews"
import { redditAdapter } from "./reddit"
import { githubAdapter } from "./github"
import { gitlabAdapter } from "./gitlab"
import { stackoverflowAdapter } from "./stackoverflow"
import { devtoAdapter } from "./devto"
import { lobstersAdapter } from "./lobsters"
import { mediumAdapter } from "./medium"
import { hashnodeAdapter } from "./hashnode"

export const allAdapters: BacklinkSource[] = [
  hackernewsAdapter,
  redditAdapter,
  githubAdapter,
  gitlabAdapter,
  stackoverflowAdapter,
  devtoAdapter,
  lobstersAdapter,
  mediumAdapter,
  hashnodeAdapter,
]

export interface AdapterResult {
  name: string
  records: BacklinkRecord[]
  error?: string
  durationMs: number
  pagesScanned: number
}

export async function runAdapter(
  adapter: BacklinkSource,
  domain: string
): Promise<AdapterResult> {
  const start = Date.now()
  console.log(`[ADAPTER] ${adapter.name} started for "${domain}"`)
  try {
    const records = await adapter.search(domain)
    const duration = Date.now() - start
    const unique = new Set(records.map(r => r.sourceUrl + "::" + r.targetUrl))
    console.log(`[ADAPTER] ${adapter.name} complete: ${records.length} records, ${unique.size} unique paths, ${duration}ms`)
    return {
      name: adapter.name,
      records,
      durationMs: duration,
      pagesScanned: records.length,
    }
  } catch (err) {
    const duration = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[ADAPTER] ${adapter.name} failed after ${duration}ms: ${msg}`)
    return {
      name: adapter.name,
      records: [],
      error: msg,
      durationMs: duration,
      pagesScanned: 0,
    }
  }
}
