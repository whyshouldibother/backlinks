import { BacklinkSource, BacklinkRecord } from "../types"
import { fetchAndVerify } from "./verify"

const GL_API = "https://gitlab.com/api/v4"

export const gitlabAdapter: BacklinkSource = {
  name: "GitLab",

  async search(domain: string): Promise<BacklinkRecord[]> {
    console.log(`[GitLab] Phase 1 — Searching for "${domain}"`)

    const candidates = new Map<string, { label: string }>()

    const url = `${GL_API}/projects?search=${encodeURIComponent(domain)}&per_page=100&order_by=updated_at&sort=desc`
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      console.warn(`[GitLab] Search returned ${resp.status}`)
      return []
    }

    const projects: any[] = await resp.json()
    console.log(`[GitLab] Search returned ${projects.length} projects`)

    for (const proj of projects) {
      const pageUrl = proj.web_url
      if (!pageUrl) continue
      if (candidates.has(pageUrl)) continue
      candidates.set(pageUrl, { label: proj.path_with_namespace || proj.name || "" })
    }

    console.log(`[GitLab] Phase 2 — Verifying ${candidates.size} candidate pages`)

    const results: BacklinkRecord[] = []
    const seen = new Set<string>()
    let verified = 0
    let discarded = 0

    for (const [pageUrl, meta] of candidates) {
      let outcome = await fetchAndVerify(pageUrl, domain)

      const readmeUrl = pageUrl.endsWith("/") ? `${pageUrl}-/blob/main/README.md` : `${pageUrl}/-/blob/main/README.md`
      if (!outcome.verified) {
        outcome = await fetchAndVerify(readmeUrl, domain)
      }

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
          sourceUrl: outcome.html ? pageUrl : readmeUrl,
          sourceDomain: "gitlab.com",
          sourceTitle: outcome.title || meta.label || undefined,
          targetUrl,
          targetDomain: domain,
          anchorText: outcome.anchorTexts[i]?.slice(0, 300) || undefined,
          platform: "gitlab",
          discoveredAt: new Date(),
        })
      }
    }

    console.log(`[GitLab] Complete: candidates=${candidates.size} verified=${verified} discarded=${discarded}`)
    return results
  },
}
