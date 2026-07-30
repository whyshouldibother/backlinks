import { BacklinkSource, BacklinkRecord } from "../types"
import { extractLinksFromHtml, extractDomain } from "../url"

const MEDIUM_SEARCH = "https://medium.com/search/posts"

export const mediumAdapter: BacklinkSource = {
  name: "Medium",

  async search(domain: string): Promise<BacklinkRecord[]> {
    console.log(`[Medium] Phase 1 — Searching for "${domain}"`)

    const candidates = new Map<string, { title: string }>()

    const url = `${MEDIUM_SEARCH}?q=${encodeURIComponent(domain)}`
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      console.warn(`[Medium] Search returned ${resp.status}`)
      return []
    }

    const html = await resp.text()
    const hrefRegex = /href="(https:\/\/medium\.com\/[^"]+[0-9a-f]{8,}[^"]*|[^"]*medium\.com\/[^"]*p\/[a-f0-9]{8,}[^"]*)"/g
    let match
    const seenLinks = new Set<string>()

    while ((match = hrefRegex.exec(html)) !== null) {
      const foundUrl = match[1].replace(/&amp;/g, "&")
      if (seenLinks.has(foundUrl)) continue
      seenLinks.add(foundUrl)

      if (candidates.size >= 50) break

      if (foundUrl.includes("/p/") && !foundUrl.includes("/search")) {
        candidates.set(foundUrl, { title: "" })
      }
    }

    console.log(`[Medium] Phase 2 — Verifying ${candidates.size} candidate pages`)

    const results: BacklinkRecord[] = []
    const seen = new Set<string>()
    let verified = 0
    let discarded = 0

    for (const [pageUrl, meta] of candidates) {
      const outcome = await verifyMediumPost(pageUrl, domain)

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
          sourceDomain: "medium.com",
          sourceTitle: outcome.title || meta.title || undefined,
          targetUrl,
          targetDomain: domain,
          anchorText: outcome.anchorTexts[i]?.slice(0, 300) || undefined,
          platform: "medium",
          discoveredAt: new Date(),
        })
      }
    }

    console.log(`[Medium] Complete: candidates=${candidates.size} verified=${verified} discarded=${discarded}`)
    return results
  },
}

async function verifyMediumPost(
  pageUrl: string,
  targetDomain: string
): Promise<{ verified: boolean; matchedUrls: string[]; anchorTexts: string[]; title?: string }> {
  const jsonUrl = pageUrl.includes("?") ? `${pageUrl}&format=json` : `${pageUrl}?format=json`

  try {
    const resp = await fetch(jsonUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      return { verified: false, matchedUrls: [], anchorTexts: [] }
    }

    let raw = await resp.text()
    raw = raw.replace(/^\]\)while\s*1\s*;\s*\[\]/, "").trim()
    raw = raw.replace(/^\)\]\}'?\s*/, "").trim()

    let data: any
    try {
      data = JSON.parse(raw)
    } catch {
      return { verified: false, matchedUrls: [], anchorTexts: [] }
    }

    const payload = data?.payload
    if (!payload) return { verified: false, matchedUrls: [], anchorTexts: [] }

    const bodyHtml = payload.content?.bodyModel?.paragraphs
      ?.map((p: any) => p.text || "")
      .filter(Boolean)
      .join(" ") || ""

    const allHtml = bodyHtml + (payload.content?.bodyModel?.sections?.map((s: any) => s?.text || "").join(" ") || "")

    const links = extractLinksFromHtml(`<html><body>${allHtml}</body></html>`, pageUrl)
    const title = payload.title || payload.content?.title || undefined

    const matchedUrls: string[] = []
    const anchorTexts: string[] = []

    for (const link of links) {
      const domain = extractDomain(link.href)
      if (domain === targetDomain) {
        matchedUrls.push(link.href)
        if (link.text) anchorTexts.push(link.text)
      }
    }

    return { verified: matchedUrls.length > 0, matchedUrls, anchorTexts, title }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[Medium] Failed to verify ${pageUrl}: ${msg}`)
    return { verified: false, matchedUrls: [], anchorTexts: [] }
  }
}
