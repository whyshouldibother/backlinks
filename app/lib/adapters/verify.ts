import { extractLinksFromHtml, extractPageTitle, extractDomain, normalize } from "../url"

export interface VerificationResult {
  verified: boolean
  matchedUrls: string[]
  anchorTexts: string[]
  title: string | undefined
  html: string | null
}

export async function fetchAndVerify(
  pageUrl: string,
  targetDomain: string
): Promise<VerificationResult> {
  try {
    const resp = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    })
    if (!resp.ok) {
      return { verified: false, matchedUrls: [], anchorTexts: [], title: undefined, html: null }
    }

    const html = await resp.text()
    const title = extractPageTitle(html)
    const links = extractLinksFromHtml(html, pageUrl)

    const matchedUrls: string[] = []
    const anchorTexts: string[] = []

    for (const link of links) {
      const domain = extractDomain(link.href)
      if (domain === targetDomain) {
        const normalized = normalize(link.href)
        matchedUrls.push(normalized)
        if (link.text) anchorTexts.push(link.text)
      }
    }

    return {
      verified: matchedUrls.length > 0,
      matchedUrls,
      anchorTexts,
      title: title || undefined,
      html,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[VERIFY] Failed to verify ${pageUrl}: ${msg}`)
    return { verified: false, matchedUrls: [], anchorTexts: [], title: undefined, html: null }
  }
}
