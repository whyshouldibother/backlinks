import { BacklinkSource, BacklinkRecord } from "../types"
import { fetchAndVerify } from "./verify"

const GH_API = "https://api.github.com"

export const githubAdapter: BacklinkSource = {
  name: "GitHub",

  async search(domain: string): Promise<BacklinkRecord[]> {
    console.log(`[GitHub] Phase 1 — Searching for "${domain}"`)

    const candidates = new Map<string, { url: string; label: string }>()

    const searches = [
      { url: `${GH_API}/search/repositories?q=${encodeURIComponent(domain)}+in:readme,description&sort=updated&per_page=100`, type: "repo" },
      { url: `${GH_API}/search/issues?q=${encodeURIComponent(domain)}+in:body,title&sort=updated&per_page=100`, type: "issue" },
      { url: `${GH_API}/search/code?q=${encodeURIComponent(domain)}&per_page=100`, type: "code" },
    ]

    for (const search of searches) {
      console.log(`[GitHub] Searching ${search.type}: ${search.url}`)
      const resp = await fetch(search.url, {
        headers: { Accept: "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(15000),
      })

      if (!resp.ok) {
        if (resp.status === 403) {
          console.warn(`[GitHub] Rate limited, stopping searches`)
          break
        }
        console.warn(`[GitHub] Search returned ${resp.status} for ${search.type}`)
        continue
      }

      const data: any = await resp.json()
      const items: any[] = data.items || []
      console.log(`[GitHub] ${search.type} search: ${items.length} results`)

      for (const item of items) {
        const pageUrl = item.html_url
        if (candidates.has(pageUrl)) continue
        const label = item.full_name || item.repository_url?.replace("https://api.github.com/repos/", "") || item.name || ""
        candidates.set(pageUrl, { url: pageUrl, label })
      }
    }

    console.log(`[GitHub] Phase 2 — Verifying ${candidates.size} candidate pages`)

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
          sourceDomain: "github.com",
          sourceTitle: outcome.title || candidate.label || undefined,
          targetUrl,
          targetDomain: domain,
          anchorText: outcome.anchorTexts[i]?.slice(0, 300) || undefined,
          platform: "github",
          discoveredAt: new Date(),
        })
      }
    }

    console.log(`[GitHub] Complete: candidates=${candidates.size} verified=${verified} discarded=${discarded}`)
    return results
  },
}
