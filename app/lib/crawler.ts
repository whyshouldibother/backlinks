import { CrawlResult, CrawlEvent, CrawlNode, CrawlPath, CrawlEdge } from "./types"
import { extractDomain, normalize, extractLinksFromHtml, extractPageTitle, getRootDomain, getSubdomain, isSameRootDomain, extractSubdomainPath } from "./url"
import { discoverAll, buildGraph } from "./orchestrator"

function debug(onEvent: (event: CrawlEvent) => void, message: string, data?: unknown) {
  const msg = `[CRAWLER] ${message}`
  console.log(msg, data !== undefined ? data : "")
  onEvent({ type: "debug", message: msg, data })
}

export async function crawlWebsite(
  url: string,
  maxDepth: number,
  onEvent: (event: CrawlEvent) => void,
  signal?: AbortSignal
): Promise<CrawlResult> {
  const normalizedUrl = normalize(url)
  const targetDomain = extractDomain(normalizedUrl)

  debug(onEvent, `=== Phase 1: Multi-platform backlink discovery for "${targetDomain}" ===`)

  const { records, adapterResults } = await discoverAll(targetDomain, onEvent, signal)

  const successful = adapterResults.filter(r => !r.error && r.records.length > 0).length
  const failed = adapterResults.filter(r => r.error).length
  debug(onEvent, `Discovery complete: ${records.length} verified backlinks from ${successful}/${failed} adapters`)

  const result = buildGraph(records, targetDomain)

  debug(onEvent, `Phase 1 graph: ${Object.keys(result.nodes).length} nodes, ${result.edges.length} edges`)

  debug(onEvent, `=== Phase 2: Enriching titles (lightweight) ===`)

  const pagesToEnrich: Array<{ nodeDomain: string; url: string }> = []
  for (const [nodeDomain, node] of Object.entries(result.nodes)) {
    if (nodeDomain === targetDomain) continue
    for (const child of Object.values(node.subdomains || {})) {
      if (!child || !child.backlinkPages) continue
      for (const bp of child.backlinkPages) {
        if (!bp.title && pagesToEnrich.length < 20) {
          pagesToEnrich.push({ nodeDomain, url: bp.url })
        }
      }
    }
  }

  debug(onEvent, `Enriching titles for ${pagesToEnrich.length} pages`)

  let enriched = 0
  for (const { nodeDomain, url } of pagesToEnrich) {
    if (signal?.aborted) break
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
      })
      if (resp.ok) {
        const html = await resp.text()
        const title = extractPageTitle(html)
        if (title) {
          const node = result.nodes[nodeDomain]
          if (node) {
            for (const child of Object.values(node.subdomains || {})) {
              if (!child || !child.backlinkPages) continue
              for (const bp of child.backlinkPages) {
                if (bp.url === url) bp.title = title
              }
            }
          }
          enriched++
        }
      }
    } catch {
      // skip enrichment failures silently
    }
  }

  debug(onEvent, `Title enrichment complete: ${enriched}/${pagesToEnrich.length}`)

  for (const node of Object.values(result.nodes)) {
    node.linkCount = node.children.length
  }

  debug(onEvent, `=== CRAWL COMPLETE: ${Object.keys(result.nodes).length} nodes, ${result.edges.length} edges ===`)
  return result
}

export async function expandDomain(
  domain: string,
  parentDomain: string | null,
  currentDepth: number,
  maxDepth: number,
  crawlId: string,
  onEvent: (event: CrawlEvent) => void,
  signal?: AbortSignal
): Promise<CrawlResult> {
  debug(onEvent, `=== EXPAND DOMAIN: "${domain}" ===`)

  const { records } = await discoverAll(domain, onEvent, signal)
  const result = buildGraph(records, domain)

  return { rootDomain: domain, nodes: result.nodes, edges: result.edges }
}

export async function expandPath(
  url: string,
  domain: string,
  parentDomain: string | null,
  currentDepth: number,
  maxDepth: number,
  crawlId: string,
  onEvent: (event: CrawlEvent) => void,
  signal?: AbortSignal
): Promise<CrawlResult> {
  debug(onEvent, `=== EXPAND PATH: "${url}" via fetch ===`)

  const normalizedTarget = normalize(url)
  const rootDomain = getRootDomain(extractDomain(normalizedTarget))
  const nodes: Record<string, CrawlNode> = {}
  const edges: CrawlEdge[] = []
  const edgeKeys = new Set<string>()

  try {
    if (signal?.aborted) return { rootDomain: domain, nodes, edges }

    const resp = await fetch(normalizedTarget, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    })

    if (!resp.ok) return { rootDomain: domain, nodes, edges }

    const html = await resp.text()
    const pageTitle = extractPageTitle(html)
    const links = extractLinksFromHtml(html, normalizedTarget)

    if (!nodes[rootDomain]) {
      nodes[rootDomain] = {
        domain: rootDomain, depth: currentDepth, parentDomain,
        children: [], linkCount: 0, totalLinks: 0, subdomains: {},
      }
    }
    const node = nodes[rootDomain]
    const crawledFull = extractDomain(normalizedTarget)
    const crawledSub = getSubdomain(crawledFull)
    let foundExternal = false

    for (const link of links) {
      const linkFullDomain = extractDomain(link.href)
      const linkRootDomain = getRootDomain(linkFullDomain)
      const linkSubdomain = getSubdomain(linkFullDomain)

      if (isSameRootDomain(linkFullDomain, rootDomain)) continue
      foundExternal = true

      const edgeKey = [rootDomain, crawledSub, linkRootDomain, linkSubdomain].join("::")
      const pathInfo: CrawlPath = { url: link.href, sourceUrl: normalizedTarget, sourceDomain: rootDomain, anchorText: link.text || undefined }

      if (!edgeKeys.has(edgeKey)) {
        edgeKeys.add(edgeKey)
        edges.push({ source: rootDomain, target: linkRootDomain, sourceSubdomain: crawledSub, targetSubdomain: linkSubdomain, paths: [pathInfo] })
      } else {
        const existing = edges.find(e => [e.source, e.sourceSubdomain, e.target, e.targetSubdomain].join("::") === edgeKey)
        if (existing) {
          const seen = new Set(existing.paths.map(p => p.sourceUrl + "::" + p.url))
          if (!seen.has(normalizedTarget + "::" + link.href)) existing.paths.push(pathInfo)
        }
      }
    }

    if (foundExternal) {
      if (!node.subdomains[crawledSub]) {
        node.subdomains[crawledSub] = { subdomain: crawledSub, fullDomain: crawledFull, backlinkPages: [] }
      }
      const child = node.subdomains[crawledSub]
      const relPath = extractSubdomainPath(normalizedTarget)
      const seen = new Set(child.backlinkPages.map(p => p.url))
      if (!seen.has(normalizedTarget)) {
        child.backlinkPages.push({ url: normalizedTarget, relativePath: relPath, subdomain: crawledSub, title: pageTitle })
      }
    }

    onEvent({
      type: "progress",
      domainsDiscovered: Object.keys(nodes).length,
      linksFound: edges.length,
      currentDepth: currentDepth + 1,
      status: "crawling",
    })
  } finally {}

  debug(onEvent, `[EXPAND-PATH] Complete: ${Object.keys(nodes).length} nodes, ${edges.length} edges`)
  return { rootDomain: domain, nodes, edges }
}


