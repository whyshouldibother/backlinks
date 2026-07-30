import { BacklinkSource, BacklinkRecord } from "../types"
import { fetchAndVerify } from "./verify"

const DEVTO_API = "https://dev.to/api/articles"

export const devtoAdapter: BacklinkSource = {
  name: "Dev.to",

  async search(domain: string): Promise<BacklinkRecord[]> {
    console.log(`[Dev.to] Phase 1 — Searching for "${domain}"`)

    const candidates = new Map<string, { title: string }>()

    const url = `${DEVTO_API}?q=${encodeURIComponent(domain)}&per_page=100`
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      console.warn(`[Dev.to] Search returned ${resp.status}`)
      return []
    }

    const data: any = await resp.json()
    const items: any[] = Array.isArray(data) ? data : []
    console.log(`[Dev.to] Search returned ${items.length} articles`)

    for (const item of items) {
      const pageUrl = item.url
      if (!pageUrl) continue
      if (candidates.has(pageUrl)) continue
      candidates.set(pageUrl, { title: item.title || "" })
    }

    console.log(`[Dev.to] Phase 2 — Verifying ${candidates.size} candidate pages`)

    const results: BacklinkRecord[] = []
    const seen = new Set<string>()
    let verified = 0
    let discarded = 0

    for (const [pageUrl, meta] of candidates) {
      const outcome = await fetchAndVerify(pageUrl, domain)

      if (!outcome.verified) {
        discarded++
        continue
      }

      verified++

      for (let i = 0; i < outcome.matchedUrls.length; i++) {
        const targetUrl = outcome.matchedUrls[i]
        const key = pageUrl + "::" + targetUrl
        if (seen.has(key)) continue
        seen.add(key)

        results.push({
          sourceUrl: pageUrl,
          sourceDomain: "dev.to",
          sourceTitle: outcome.title || meta.title || undefined,
          targetUrl,
          targetDomain: domain,
          anchorText: outcome.anchorTexts[i]?.slice(0, 300) || undefined,
          platform: "devto",
          discoveredAt: new Date(),
        })
      }
    }

    console.log(`[Dev.to] Complete: candidates=${candidates.size} verified=${verified} discarded=${discarded}`)
    return results
  },
}
