import { BacklinkSource, BacklinkRecord } from "../types"
import { fetchAndVerify } from "./verify"

const REDDIT_SEARCH = "https://www.reddit.com/search.json"

export const redditAdapter: BacklinkSource = {
  name: "Reddit",

  async search(domain: string): Promise<BacklinkRecord[]> {
    console.log(`[Reddit] Phase 1 — Searching for "${domain}"`)

    const candidates = new Map<string, { title: string; subreddit: string }>()

    const url = `${REDDIT_SEARCH}?q=${encodeURIComponent(domain)}&limit=100&sort=relevance&type=link`
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BacklinkGraphExplorer/1.0; +https://github.com/backlinks)" },
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      console.warn(`[Reddit] Search returned ${resp.status}`)
      return []
    }

    const data: any = await resp.json()
    const children: any[] = data?.data?.children || []
    console.log(`[Reddit] Search returned ${children.length} posts`)

    for (const child of children) {
      const post = child?.data
      if (!post) continue
      const permalink = post.permalink
      if (!permalink) continue
      const pageUrl = `https://old.reddit.com${permalink}`
      if (candidates.has(pageUrl)) continue
      candidates.set(pageUrl, {
        title: post.title || "",
        subreddit: post.subreddit || "",
      })
    }

    console.log(`[Reddit] Phase 2 — Verifying ${candidates.size} candidate pages`)

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
          sourceDomain: "reddit.com",
          sourceSubdomain: meta.subreddit || undefined,
          sourceTitle: outcome.title || meta.title || undefined,
          targetUrl,
          targetDomain: domain,
          anchorText: outcome.anchorTexts[i]?.slice(0, 300) || undefined,
          platform: "reddit",
          discoveredAt: new Date(),
        })
      }
    }

    console.log(`[Reddit] Complete: candidates=${candidates.size} verified=${verified} discarded=${discarded}`)
    return results
  },
}
