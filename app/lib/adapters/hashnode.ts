import { BacklinkSource, BacklinkRecord } from "../types"
import { fetchAndVerify } from "./verify"

const HASHNODE_GQL = "https://gql.hashnode.com"

export const hashnodeAdapter: BacklinkSource = {
  name: "Hashnode",

  async search(domain: string): Promise<BacklinkRecord[]> {
    console.log(`[Hashnode] Phase 1 — Searching for "${domain}"`)

    const candidates = new Map<string, { title: string }>()

    const query = `{
  searchPosts(query: "${domain}", page: 1, pageSize: 50) {
    edges {
      node {
        title
        url
      }
    }
  }
}`

    const resp = await fetch(HASHNODE_GQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      console.warn(`[Hashnode] Search returned ${resp.status}`)
      return []
    }

    const data: any = await resp.json()
    const edges: any[] = data?.data?.searchPosts?.edges || []
    console.log(`[Hashnode] Search returned ${edges.length} posts`)

    for (const edge of edges) {
      const node = edge?.node
      if (!node?.url) continue
      if (candidates.has(node.url)) continue
      candidates.set(node.url, { title: node.title || "" })
    }

    console.log(`[Hashnode] Phase 2 — Verifying ${candidates.size} candidate pages`)

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
          sourceDomain: "hashnode.dev",
          sourceTitle: outcome.title || meta.title || undefined,
          targetUrl,
          targetDomain: domain,
          anchorText: outcome.anchorTexts[i]?.slice(0, 300) || undefined,
          platform: "hashnode",
          discoveredAt: new Date(),
        })
      }
    }

    console.log(`[Hashnode] Complete: candidates=${candidates.size} verified=${verified} discarded=${discarded}`)
    return results
  },
}
