import { chromium } from "playwright"
import { CrawlNode, CrawlEdge, CrawlResult, CrawlEvent } from "./types"
import { extractDomain, normalize, extractLinksFromHtml, isSameDomain } from "./url"
import { isAllowed } from "./robots"

const MAX_DEPTH = 3

export async function crawlWebsite(
  url: string,
  onEvent: (event: CrawlEvent) => void,
  signal?: AbortSignal
): Promise<CrawlResult> {
  const normalizedUrl = normalize(url)
  const rootDomain = extractDomain(normalizedUrl)

  const nodes: Record<string, CrawlNode> = {}
  const edges: CrawlEdge[] = []
  const visited = new Set<string>()
  const domainLinks = new Map<string, Set<string>>()

  const queue: Array<{ domain: string; depth: number; parentDomain: string | null }> = [
    { domain: rootDomain, depth: 0, parentDomain: null },
  ]

  const browser = await chromium.launch({ headless: true })

  try {
    while (queue.length > 0) {
      if (signal?.aborted) break

      const item = queue.shift()!
      const { domain, depth, parentDomain } = item

      if (visited.has(domain) || depth > MAX_DEPTH) continue
      visited.add(domain)

      const allowed = await isAllowed(domain)
      if (!allowed) {
        nodes[domain] = {
          domain,
          depth,
          parentDomain,
          children: [],
          linkCount: 0,
          totalLinks: 0,
        }
        continue
      }

      const page = await browser.newPage()
      let links: string[] = []

      try {
        await page.goto(`https://${domain}`, {
          timeout: 15000,
          waitUntil: "domcontentloaded",
        })
        const html = await page.content()
        links = extractLinksFromHtml(html, `https://${domain}`)
      } catch {
        try {
          await page.goto(`http://${domain}`, {
            timeout: 15000,
            waitUntil: "domcontentloaded",
          })
          const html = await page.content()
          links = extractLinksFromHtml(html, `http://${domain}`)
        } catch {
          // domain unreachable
        }
      }
      await page.close()

      const linkedDomains = new Set<string>()
      let selfLinks = 0

      for (const link of links) {
        const linkDomain = extractDomain(link)
        if (isSameDomain(linkDomain, domain)) {
          selfLinks++
          continue
        }
        linkedDomains.add(linkDomain)

        const edgeId = [domain, linkDomain].sort().join("::")
        if (!domainLinks.has(edgeId)) {
          domainLinks.set(edgeId, new Set())
          edges.push({ source: domain, target: linkDomain })
        }
      }

      nodes[domain] = {
        domain,
        depth,
        parentDomain,
        children: Array.from(linkedDomains),
        linkCount: linkedDomains.size,
        totalLinks: links.length,
      }

      if (parentDomain) {
        const existingEdgeId = [parentDomain, domain].sort().join("::")
        if (!domainLinks.has(existingEdgeId)) {
          domainLinks.set(existingEdgeId, new Set())
          edges.push({ source: parentDomain, target: domain })
        }
      }

      if (depth < MAX_DEPTH) {
        for (const linkDomain of linkedDomains) {
          if (!visited.has(linkDomain)) {
            queue.push({
              domain: linkDomain,
              depth: depth + 1,
              parentDomain: domain,
            })
          }
        }
      }

      onEvent({
        type: "progress",
        domainsDiscovered: visited.size,
        linksFound: edges.length,
        currentDepth: depth + 1,
        status: "crawling",
      })
    }
  } finally {
    await browser.close()
  }

  return { rootDomain, nodes, edges }
}