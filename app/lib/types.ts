export interface CrawlNode {
  domain: string
  depth: number
  parentDomain: string | null
  children: string[]
  linkCount: number
  totalLinks: number
}

export interface CrawlEdge {
  source: string
  target: string
}

export interface CrawlResult {
  rootDomain: string
  nodes: Record<string, CrawlNode>
  edges: CrawlEdge[]
}

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

export type CrawlEvent = CrawlProgress | CrawlComplete | CrawlError

export interface GraphNodeData {
  id: string
  domain: string
  depth: number
  linkCount: number
  parentDomain: string | null
}

export interface GraphEdgeData {
  id: string
  source: string
  target: string
}

export type DomainFilter = "all" | "internal" | "external"