import { BacklinkSource, BacklinkRecord } from "../types"
import { fetchAndVerify } from "./verify"

const HN_ALGOLIA = "https://hn.algolia.com/api/v1/search"

export const hackernewsAdapter: BacklinkSource = {
  name: "Hacker News",

  async search(domain: string): Promise<BacklinkRecord[]> {
    console.log(`[HN] Phase 1 — Searching Algolia for "${domain}"`)
    const candidates = new Map<string, { storyId: string; title: string; url: string }>()

    for (const tag of ["story", "comment"]) {
      const url = `${HN_ALGOLIA}?query=${encodeURIComponent(domain)}&tags=${tag}&hitsPerPage=200`
      const resp = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!resp.ok) {
        console.warn(`[HN] Algolia returned ${resp.status} for ${tag}`)
        continue
      }

      const data: any = await resp.json()
      const hits: any[] = data.hits || []
      console.log(`[HN] Algolia returned ${hits.length} ${tag} hits`)

      for (const hit of hits) {
        const storyId = hit.objectID
        if (candidates.has(storyId)) continue

        const hnUrl = `https://news.ycombinator.com/item?id=${storyId}`
        candidates.set(storyId, {
          storyId,
          title: hit.title || hit.story_title || "",
          url: hnUrl,
        })
      }
    }

    console.log(`[HN] Phase 2 — Verifying ${candidates.size} candidate pages`)

    const results: BacklinkRecord[] = []
    const seen = new Set<string>()
    let verified = 0
    let discarded = 0

    for (const [, candidate] of candidates) {
      const outcome = await fetchAndVerify(candidate.url, domain)

      if (!outcome.verified) {
        discarded++
        continue
      }

      verified++

      for (let i = 0; i < outcome.matchedUrls.length; i++) {
        const targetUrl = outcome.matchedUrls[i]
        const key = candidate.url + "::" + targetUrl
        if (seen.has(key)) continue
        seen.add(key)

        results.push({
          sourceUrl: candidate.url,
          sourceDomain: "news.ycombinator.com",
          sourceTitle: outcome.title || candidate.title || undefined,
          targetUrl,
          targetDomain: domain,
          anchorText: outcome.anchorTexts[i]?.slice(0, 300) || undefined,
          platform: "hackernews",
          discoveredAt: new Date(),
        })
      }
    }

    console.log(`[HN] Complete: candidates=${candidates.size} verified=${verified} discarded=${discarded}`)
    return results
  },
}
