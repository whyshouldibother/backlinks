import { NextRequest } from "next/server"
import { extractDomain, extractLinksFromHtml, extractPageTitle, normalize, getRootDomain, getSubdomain, extractSubdomainPath } from "@/lib/url"
import { BacklinkRecord, CrawlResult, CrawlNode, CrawlEdge, CrawlPath } from "@/lib/types"
import { cacheResult, getCachedResult } from "@/lib/cache"

export async function POST(req: NextRequest) {
  try {
    const { sourceUrl, crawlId } = await req.json()

    if (!sourceUrl || typeof sourceUrl !== "string") {
      return Response.json({ verified: false, error: "Source Page URL is required" }, { status: 400 })
    }

    if (!crawlId || typeof crawlId !== "string") {
      return Response.json({ verified: false, error: "Crawl ID is required" }, { status: 400 })
    }

    const existing = getCachedResult(crawlId)
    if (!existing) {
      return Response.json({ verified: false, error: "Crawl session not found or expired" }, { status: 404 })
    }

    const targetDomain = existing.rootDomain

    let parsed: URL
    try {
      parsed = new URL(sourceUrl)
      if (!parsed.protocol.startsWith("http")) throw new Error()
    } catch {
      return Response.json({ verified: false, error: "Invalid URL. Please enter a valid HTTP or HTTPS URL." }, { status: 400 })
    }

    let resp: Response
    try {
      resp = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
        redirect: "follow",
      })
    } catch {
      return Response.json({ verified: false, error: "Page is unreachable. Could not connect to the server." }, { status: 422 })
    }

    if (!resp.ok) {
      return Response.json({ verified: false, error: `Page returned HTTP ${resp.status} ${resp.statusText}. Only 2xx responses are accepted.` }, { status: 422 })
    }

    const html = await resp.text()
    const title = extractPageTitle(html)
    const links = extractLinksFromHtml(html, sourceUrl)

    if (links.length === 0) {
      return Response.json({ verified: false, error: "No hyperlinks found on this page." }, { status: 422 })
    }

    const matchedLinks = links.filter(link => extractDomain(link.href) === targetDomain)

    if (matchedLinks.length === 0) {
      return Response.json({ verified: false, error: "No backlink to the searched website was found on this page." }, { status: 422 })
    }

    const firstMatch = matchedLinks[0]
    const sourceDomain = extractDomain(sourceUrl)
    const sourceRoot = getRootDomain(sourceDomain)
    const sourceSub = getSubdomain(sourceDomain) || ""

    const record: BacklinkRecord = {
      sourceUrl,
      sourceDomain,
      sourceSubdomain: sourceSub,
      sourceTitle: title || undefined,
      targetUrl: normalize(firstMatch.href),
      targetDomain,
      anchorText: firstMatch.text || undefined,
      platform: "manual",
      discoveredAt: new Date(),
      discoveryMethod: "manual",
    }

    const { nodes, edges } = buildManualGraph(record, targetDomain, existing)

    const mergedNodes = { ...existing.nodes }
    const mergedEdges = [...existing.edges]
    const edgeKeys = new Set(mergedEdges.map(e => [e.source, e.sourceSubdomain, e.target, e.targetSubdomain].join("::")))

    for (const [domain, node] of Object.entries(nodes)) {
      if (mergedNodes[domain]) {
        const existingNode = mergedNodes[domain]
        const existingSubdomains = { ...existingNode.subdomains }
        for (const [subKey, subChild] of Object.entries(node.subdomains || {})) {
          if (existingSubdomains[subKey]) {
            const existingBps = existingSubdomains[subKey].backlinkPages
            const urls = new Set(existingBps.map(p => p.url))
            const newBps = subChild.backlinkPages.filter(p => !urls.has(p.url))
            existingSubdomains[subKey] = {
              ...existingSubdomains[subKey],
              backlinkPages: [...existingBps, ...newBps],
            }
          } else {
            existingSubdomains[subKey] = subChild
          }
        }
        mergedNodes[domain] = {
          ...existingNode,
          children: [...new Set([...existingNode.children, ...(node.children || [])])],
          linkCount: existingNode.children.length,
          totalLinks: existingNode.totalLinks + (node.totalLinks || 0),
          subdomains: existingSubdomains,
        }
      } else {
        mergedNodes[domain] = node
      }
    }

    for (const edge of edges) {
      const edgeKey = [edge.source, edge.sourceSubdomain, edge.target, edge.targetSubdomain].join("::")
      if (edgeKeys.has(edgeKey)) {
        const existingEdge = mergedEdges.find(e =>
          [e.source, e.sourceSubdomain, e.target, e.targetSubdomain].join("::") === edgeKey
        )
        if (existingEdge) {
          const seenPaths = new Set(existingEdge.paths.map(p => p.sourceUrl + "::" + p.url))
          for (const p of (edge.paths || [])) {
            if (!seenPaths.has(p.sourceUrl + "::" + p.url)) {
              existingEdge.paths.push(p)
            }
          }
        }
      } else {
        mergedEdges.push(edge)
        edgeKeys.add(edgeKey)
      }
    }

    const updatedResult: CrawlResult = {
      ...existing,
      nodes: mergedNodes,
      edges: mergedEdges,
    }

    cacheResult(crawlId, updatedResult)

    return Response.json({
      verified: true,
      nodes,
      edges,
      record,
      message: `Backlink verified! Added page from ${sourceDomain} to the graph.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed unexpectedly"
    return Response.json({ verified: false, error: message }, { status: 500 })
  }
}

function buildManualGraph(
  record: BacklinkRecord,
  targetDomain: string,
  existing: CrawlResult
): { nodes: Record<string, CrawlNode>; edges: CrawlEdge[] } {
  const nodes: Record<string, CrawlNode> = {}
  const edges: CrawlEdge[] = []

  const sourceDomain = record.sourceDomain
  const sourceRoot = getRootDomain(sourceDomain)
  const sourceSub = record.sourceSubdomain || getSubdomain(sourceDomain) || ""

  const existingNode = existing.nodes[sourceRoot]

  if (!nodes[sourceRoot]) {
    nodes[sourceRoot] = {
      domain: sourceRoot,
      depth: existingNode ? existingNode.depth : 1,
      parentDomain: existingNode ? existingNode.parentDomain : targetDomain,
      children: [],
      linkCount: 0,
      totalLinks: 0,
      subdomains: {},
    }
  }

  const node = nodes[sourceRoot]

  if (!node.subdomains[sourceSub]) {
    const fullDomain = extractDomain(record.sourceUrl)
    node.subdomains[sourceSub] = {
      subdomain: sourceSub,
      fullDomain,
      backlinkPages: [],
    }
  }

  const pageSeen = new Set(node.subdomains[sourceSub].backlinkPages.map(p => p.url))
  if (!pageSeen.has(record.sourceUrl)) {
    node.subdomains[sourceSub].backlinkPages.push({
      url: record.sourceUrl,
      relativePath: extractSubdomainPath(record.sourceUrl) || new URL(record.sourceUrl).pathname,
      subdomain: sourceSub,
      title: record.sourceTitle,
    })
  }

  node.children = [targetDomain]
  node.linkCount = 1
  node.totalLinks = Object.values(node.subdomains).reduce((s, c) => s + (c?.backlinkPages?.length || 0), 0)

  const pathInfo: CrawlPath = {
    url: record.targetUrl,
    sourceUrl: record.sourceUrl,
    sourceDomain: sourceRoot,
    anchorText: record.anchorText,
  }

  edges.push({
    source: sourceRoot,
    target: targetDomain,
    sourceSubdomain: sourceSub,
    targetSubdomain: "",
    paths: [pathInfo],
  })

  return { nodes, edges }
}
