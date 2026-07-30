import { BacklinkSource, BacklinkRecord } from "../types"
import { fetchAndVerify } from "./verify"

const SO_API = "https://api.stackexchange.com/2.3/search/advanced"

export const stackoverflowAdapter: BacklinkSource = {
  name: "Stack Overflow",

  async search(domain: string): Promise<BacklinkRecord[]> {
    console.log(`[StackOverflow] Phase 1 — Searching for "${domain}"`)

    const candidates = new Map<string, { title: string }>()

    const url = `${SO_API}?q=${encodeURIComponent(domain)}&site=stackoverflow&pagesize=100&order=desc&sort=relevance&filter=!nNPvSNVZGz`
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      console.warn(`[StackOverflow] Search returned ${resp.status}`)
      const body = await resp.text().catch(() => "")
      console.warn(`[StackOverflow] Response: ${body.slice(0, 500)}`)
      return []
    }

    const data: any = await resp.json()
    const items: any[] = data.items || []
    console.log(`[StackOverflow] Search returned ${items.length} questions`)

    for (const item of items) {
      const questionId = item.question_id
      if (!questionId) continue
      const pageUrl = `https://stackoverflow.com/questions/${questionId}/${item.title ? item.title.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase() : "question"}`
      if (candidates.has(pageUrl)) continue
      candidates.set(pageUrl, { title: item.title || "" })
    }

    console.log(`[StackOverflow] Phase 2 — Verifying ${candidates.size} candidate pages`)

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
          sourceDomain: "stackoverflow.com",
          sourceTitle: outcome.title || meta.title || undefined,
          targetUrl,
          targetDomain: domain,
          anchorText: outcome.anchorTexts[i]?.slice(0, 300) || undefined,
          platform: "stackoverflow",
          discoveredAt: new Date(),
        })
      }
    }

    console.log(`[StackOverflow] Complete: candidates=${candidates.size} verified=${verified} discarded=${discarded}`)
    return results
  },
}
