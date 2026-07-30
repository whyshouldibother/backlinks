import { BacklinkSource, BacklinkRecord } from "../types"
import { fetchAndVerify } from "./verify"

const LOBSTERS_SEARCH = "https://lobste.rs/search.json"

export const lobstersAdapter: BacklinkSource = {
  name: "Lobsters",

  async search(domain: string): Promise<BacklinkRecord[]> {
    console.log(`[Lobsters] Phase 1 — Searching for "${domain}"`)

    const candidates = new Map<string, { title: string }>()

    const url = `${LOBSTERS_SEARCH}?q=${encodeURIComponent(domain)}&what=stories&order=relevance`
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      console.warn(`[Lobsters] Search returned ${resp.status}`)
      const body = await resp.text().catch(() => "")
      console.warn(`[Lobsters] Response: ${body.slice(0, 300)}`)
      return []
    }

    const data: any = await resp.json()
    const results: any[] = []
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        results.push(...data[key])
      }
    }
    if (results.length === 0 && Array.isArray(data)) {
      results.push(...data)
    }

    console.log(`[Lobsters] Search returned ${results.length} stories`)

    for (const item of results) {
      const shortId = item.short_id
      if (!shortId) continue
      const pageUrl = `https://lobste.rs/s/${shortId}`
      if (candidates.has(pageUrl)) continue
      candidates.set(pageUrl, { title: item.title || item.description || "" })
    }

    console.log(`[Lobsters] Phase 2 — Verifying ${candidates.size} candidate pages`)

    const backlinks: BacklinkRecord[] = []
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

        backlinks.push({
          sourceUrl: pageUrl,
          sourceDomain: "lobste.rs",
          sourceTitle: outcome.title || meta.title || undefined,
          targetUrl,
          targetDomain: domain,
          anchorText: outcome.anchorTexts[i]?.slice(0, 300) || undefined,
          platform: "lobsters",
          discoveredAt: new Date(),
        })
      }
    }

    console.log(`[Lobsters] Complete: candidates=${candidates.size} verified=${verified} discarded=${discarded}`)
    return backlinks
  },
}
