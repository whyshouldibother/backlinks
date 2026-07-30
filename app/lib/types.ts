export interface CrawlPath {
  url: string
  sourceUrl: string
  sourceDomain: string
  anchorText?: string
}

export interface BacklinkPage {
  url: string
  relativePath: string
  subdomain: string
  title?: string
}

export interface SubdomainChild {
  subdomain: string
  fullDomain: string
  backlinkPages: BacklinkPage[]
}

export interface CrawlNode {
  domain: string
  depth: number
  parentDomain: string | null
  children: string[]
  linkCount: number
  totalLinks: number
  subdomains: Record<string, SubdomainChild>
}

export interface CrawlEdge {
  source: string
  target: string
  sourceSubdomain: string
  targetSubdomain: string
  paths: CrawlPath[]
}

export interface CrawlResult {
  rootDomain: string
  nodes: Record<string, CrawlNode>
  edges: CrawlEdge[]
}

export interface CrawlConfig {
  url: string
  maxDepth: number
  rootDomain: string
}

export interface ExpandRequest {
  type: "expand-domain"
  domain: string
  parentDomain: string | null
  currentDepth: number
  maxDepth: number
  crawlId: string
}

export interface ExpandPathRequest {
  type: "expand-path"
  url: string
  domain: string
  parentDomain: string | null
  currentDepth: number
  maxDepth: number
  crawlId: string
}

export type ExpandAction = ExpandRequest | ExpandPathRequest

export interface CrawlProgress {
  type: "progress"
  domainsDiscovered: number
  linksFound: number
  currentDepth: number
  status: "crawling"
}

export interface CrawlComplete {
  type: "complete"
  crawlId: string
}

export interface CrawlError {
  type: "error"
  message: string
}

export interface CrawlDebug {
  type: "debug"
  message: string
  data?: unknown
}

export interface CrawlUpdate {
  type: "update"
  nodes: Record<string, CrawlNode>
  edges: CrawlEdge[]
}

export type CrawlEvent = CrawlProgress | CrawlComplete | CrawlError | CrawlDebug | CrawlUpdate

export interface GraphNodeData {
  id: string
  domain: string
  depth: number
  linkCount: number
  parentDomain: string | null
  subdomain: string
  isParent: boolean
  pathCount: number
}

export interface GraphEdgeData {
  id: string
  source: string
  target: string
  count: number
}

export type DomainFilter = "all" | "internal" | "external"

export interface ContextMenuState {
  x: number
  y: number
  domain: string
  subdomain: string
}

export interface BacklinkRecord {
  sourceUrl: string
  sourceDomain: string
  sourceSubdomain?: string
  sourceTitle?: string
  targetUrl: string
  targetDomain: string
  anchorText?: string
  platform: string
  discoveredAt: Date
  discoveryMethod?: "manual" | "automated"
}

export interface BacklinkSource {
  name: string
  search(domain: string, targetUrl?: string): Promise<BacklinkRecord[]>
}
