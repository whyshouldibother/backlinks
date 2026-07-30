import { BacklinkRecord, CrawlResult, CrawlEvent, CrawlNode, CrawlEdge } from "./types"
import { allAdapters, runAdapter, AdapterResult } from "./adapters/index"
import { extractDomain, getRootDomain, getSubdomain, extractSubdomainPath } from "./url"

function debug(onEvent: (event: CrawlEvent) => void, message: string, data?: unknown) {
  const msg = `[ORCH] ${message}`
  console.log(msg, data !== undefined ? data : "")
  onEvent({ type: "debug" as const, message: msg, data })
}

export async function discoverAll(
  targetDomain: string,
  onEvent: (event: CrawlEvent) => void,
  _signal?: AbortSignal
): Promise<{ records: BacklinkRecord[]; adapterResults: AdapterResult[] }> {
  if (_signal?.aborted) return { records: [], adapterResults: [] }

  debug(onEvent, `Running ${allAdapters.length} adapters for "${targetDomain}"`)

  const promises = allAdapters.map(adapter => runAdapter(adapter, targetDomain))
  const settled = await Promise.allSettled(promises)

  const allRecords: BacklinkRecord[] = []
  const adapterResults: AdapterResult[] = []

  for (const result of settled) {
    if (result.status === "fulfilled") {
      adapterResults.push(result.value)
      allRecords.push(...result.value.records)
    } else {
      debug(onEvent, `Adapter promise rejected: ${result.reason}`)
    }
  }

  const before = allRecords.length
  const seen = new Set<string>()
  const deduped: BacklinkRecord[] = []

  for (const record of allRecords) {
    const key = record.sourceUrl + "::" + record.targetUrl
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(record)
    }
  }

  debug(onEvent, `Deduplication: ${before} → ${deduped.length} unique backlink records`)

  for (const r of adapterResults) {
    if (r.error) {
      debug(onEvent, `Adapter "${r.name}" error: ${r.error}`)
    }
    debug(onEvent, `Adapter "${r.name}": ${r.records.length} records, ${r.durationMs}ms`)
  }

  return { records: deduped, adapterResults }
}

export function buildGraph(
  records: BacklinkRecord[],
  targetDomain: string
): CrawlResult {
  const rootDomain = extractDomain(targetDomain)
  const nodes: Record<string, CrawlNode> = {}
  const edges: CrawlEdge[] = []
  const edgeKeys = new Set<string>()

  nodes[rootDomain] = {
    domain: rootDomain,
    depth: 0,
    parentDomain: null,
    children: [],
    linkCount: 0,
    totalLinks: 0,
    subdomains: {},
  }

  for (const record of records) {
    const sourceDomain = getRootDomain(extractDomain(record.sourceUrl))
    if (sourceDomain === rootDomain) continue

    if (!nodes[sourceDomain]) {
      nodes[sourceDomain] = {
        domain: sourceDomain,
        depth: 1,
        parentDomain: rootDomain,
        children: [],
        linkCount: 0,
        totalLinks: 0,
        subdomains: {},
      }
    }

    const sub = record.sourceSubdomain || getSubdomain(extractDomain(record.sourceUrl)) || ""

    if (!nodes[sourceDomain].subdomains[sub]) {
      nodes[sourceDomain].subdomains[sub] = {
        subdomain: sub,
        fullDomain: extractDomain(record.sourceUrl),
        backlinkPages: [],
      }
    }

    const child = nodes[sourceDomain].subdomains[sub]
    const pageSeen = new Set(child.backlinkPages.map(p => p.url))
    if (!pageSeen.has(record.sourceUrl)) {
      child.backlinkPages.push({
        url: record.sourceUrl,
        relativePath: extractSubdomainPath(record.sourceUrl) || new URL(record.sourceUrl).pathname,
        subdomain: sub,
        title: record.sourceTitle,
      })
    }

    const edgeKey = [sourceDomain, sub, rootDomain, ""].join("::")
    if (!edgeKeys.has(edgeKey)) {
      edgeKeys.add(edgeKey)
      edges.push({
        source: sourceDomain,
        target: rootDomain,
        sourceSubdomain: sub,
        targetSubdomain: "",
        paths: [],
      })
    }

    const edge = edges.find(e =>
      [e.source, e.sourceSubdomain, e.target, e.targetSubdomain].join("::") === edgeKey
    )!

    const pathSeen = new Set(edge.paths.map(p => p.sourceUrl + "::" + p.url))
    if (!pathSeen.has(record.sourceUrl + "::" + record.targetUrl)) {
      edge.paths.push({
        url: record.targetUrl,
        sourceUrl: record.sourceUrl,
        sourceDomain: sourceDomain,
        anchorText: record.anchorText,
      })
    }
  }

  for (const node of Object.values(nodes)) {
    node.children = Object.keys(nodes).filter(k => k !== node.domain && k !== rootDomain && nodes[k]?.parentDomain === node.domain)
    node.linkCount = node.children.length
    node.totalLinks = Object.values(node.subdomains).reduce((s, c) => s + (c?.backlinkPages?.length || 0), 0)
  }

  const bpCount = Object.values(nodes).reduce(
    (s, n) => s + Object.values(n.subdomains).reduce((s2, c) => s2 + (c?.backlinkPages?.length || 0), 0), 0
  )

  console.log(`[ORCH] Graph built: ${Object.keys(nodes).length} nodes, ${edges.length} edges, ${bpCount} backlink pages`)
  return { rootDomain, nodes, edges }
}

