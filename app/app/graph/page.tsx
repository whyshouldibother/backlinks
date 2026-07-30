"use client"

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, AlertCircle, Expand, Globe, Plus } from "lucide-react"
import GraphView from "@/components/graph-view"
import Sidebar from "@/components/sidebar"
import FilterBar from "@/components/filter-bar"
import SearchBar from "@/components/search-bar"
import ErrorBoundary from "@/components/error-boundary"
import ManualBacklinkModal from "@/components/manual-backlink-modal"
import { CrawlResult, CrawlEvent, DomainFilter, CrawlNode, CrawlEdge } from "@/lib/types"

export default function GraphPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    }>
      <ErrorBoundary>
        <GraphContent />
      </ErrorBoundary>
    </Suspense>
  )
}

function GraphContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const crawlId = searchParams.get("crawlId")
  const domain = searchParams.get("domain")
  const initialMaxDepth = parseInt(searchParams.get("maxDepth") || "1")

  const [result, setResult] = useState<CrawlResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNodeDomain, setSelectedNodeDomain] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [domainFilter, setDomainFilter] = useState<DomainFilter>("all")
  const [depthFilter, setDepthFilter] = useState(initialMaxDepth)

  const [showManualModal, setShowManualModal] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; domain: string
  } | null>(null)
  const [expanding, setExpanding] = useState(false)
  const [expandingDomain, setExpandingDomain] = useState<string | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!crawlId) {
      setError("No crawl data found. Please start a new crawl.")
      setLoading(false)
      return
    }

    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/crawl/result?id=${crawlId}`)
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Result not found (${res.status})`)
        }
        const data = await res.json()
        setResult(data)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load results"
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    fetchResult()
  }, [crawlId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleNodeContextMenu = useCallback((domain: string, x: number, y: number) => {
    setContextMenu({ x, y, domain })
  }, [])

  const handleNodeTap = useCallback((domain: string) => {
    setSelectedNodeDomain(domain)
  }, [])

  const handleBackgroundTap = useCallback(() => {
    setContextMenu(null)
    setSelectedNodeDomain(null)
  }, [])

  const mergeResults = useCallback((prev: CrawlResult, update: CrawlResult): CrawlResult => {
    if (!prev) return update
    const mergedNodes = { ...prev.nodes }
    const mergedEdges = [...prev.edges]
    const existingEdgeKeys = new Set(
      mergedEdges.map(e => [e.source, e.sourceSubdomain, e.target, e.targetSubdomain].join("::"))
    )

    for (const [nodeDomain, node] of Object.entries(update.nodes)) {
      if (mergedNodes[nodeDomain]) {
        const existing = mergedNodes[nodeDomain]
        const existingSubdomains = { ...existing.subdomains }
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
        mergedNodes[nodeDomain] = {
          ...existing,
          children: [...new Set([...existing.children, ...(node.children || [])])],
          linkCount: existing.children.length,
          totalLinks: existing.totalLinks + (node.totalLinks || 0),
          subdomains: existingSubdomains,
        }
      } else {
        mergedNodes[nodeDomain] = node
      }
    }

    for (const edge of update.edges || []) {
      const edgeKey = [edge.source, edge.sourceSubdomain, edge.target, edge.targetSubdomain].join("::")
      if (existingEdgeKeys.has(edgeKey)) {
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
        existingEdgeKeys.add(edgeKey)
      }
    }

    return { ...prev, nodes: mergedNodes, edges: mergedEdges }
  }, [])

  const handleManualSuccess = useCallback((nodes: Record<string, CrawlNode>, edges: CrawlEdge[]) => {
    setResult(prev => {
      if (!prev) return prev
      return mergeResults(prev, { ...prev, nodes, edges })
    })
  }, [mergeResults])

  const handleExpandDomain = useCallback(async (expandDomain: string) => {
    if (!crawlId) return
    setExpanding(true)
    setExpandingDomain(expandDomain)
    setContextMenu(null)

    const currentNode = result?.nodes[expandDomain]
    const currentDepth = currentNode ? currentNode.depth : 0

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crawlId,
          expandDomain: {
            domain: expandDomain,
            parentDomain: currentNode?.parentDomain || null,
            currentDepth,
            maxDepth: initialMaxDepth,
          },
        }),
      })

      if (!res.ok) throw new Error(`Server error: ${res.status}`)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event: CrawlEvent = JSON.parse(line)
            if (event.type === "update") {
              setResult(prev => {
                const updateResult: CrawlResult = {
                  rootDomain: prev?.rootDomain || "",
                  nodes: event.nodes,
                  edges: event.edges,
                }
                return prev ? mergeResults(prev, updateResult) : updateResult
              })
            }
          } catch {
            continue
          }
        }
      }
    } catch (err) {
      console.error("Expansion failed:", err)
    } finally {
      setExpanding(false)
      setExpandingDomain(null)
    }
  }, [crawlId, result, initialMaxDepth, mergeResults])

  const contextNode = useMemo(() => {
    if (!contextMenu || !result) return null
    return result.nodes[contextMenu.domain] || null
  }, [contextMenu, result])

  const selectedNode = useMemo(() => {
    if (!selectedNodeDomain || !result) return null
    return result.nodes[selectedNodeDomain] || null
  }, [selectedNodeDomain, result])

  const validatedEdges = useMemo(() => {
    if (!result) return []
    const validNodeIds = new Set(Object.keys(result.nodes))
    const bad: CrawlEdge[] = []
    const good: CrawlEdge[] = []
    for (const e of result.edges) {
      if (validNodeIds.has(e.source) && validNodeIds.has(e.target)) {
        good.push(e)
      } else {
        bad.push(e)
      }
    }
    if (bad.length > 0) {
      console.warn(`[GRAPH] Filtered ${bad.length}/${result.edges.length} edges with non-existent parent node:`, bad.map(e => `${e.source}->${e.target}`))
    }
    return good
  }, [result])

  const nodeCount = result ? Object.keys(result.nodes).length : 0

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
          <p className="text-sm text-text-muted">Loading graph data...</p>
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-error mx-auto" />
          <p className="text-sm text-text-secondary">{error || "No data available"}</p>
          <p className="text-xs text-text-muted">
            Crawl ID: {crawlId || "none"} | Domain: {domain || "none"}
          </p>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-sm font-semibold text-text-primary">{domain}</h1>
            <p className="text-xs text-text-muted">
              {nodeCount} domains · {validatedEdges.length} connections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {expanding && (
            <div className="flex items-center gap-1.5 text-xs text-accent">
              <Loader2 className="w-3 h-3 animate-spin" />
              Expanding {expandingDomain}...
            </div>
          )}
          <button
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Backlink Page
          </button>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <FilterBar
            nodes={result.nodes}
            rootDomain={result.rootDomain}
            domainFilter={domainFilter}
            onDomainFilterChange={setDomainFilter}
            depthFilter={depthFilter}
            onDepthFilterChange={setDepthFilter}
          />
        </div>
      </header>

      <div className="flex flex-1 min-h-0 relative">
        <GraphView
          nodes={result.nodes}
          edges={validatedEdges}
          rootDomain={result.rootDomain}
          searchQuery={searchQuery}
          domainFilter={domainFilter}
          depthFilter={depthFilter}
          onNodeContextMenu={handleNodeContextMenu}
          onBackgroundTap={handleBackgroundTap}
          onNodeTap={handleNodeTap}
        />

        {contextMenu && contextNode && (
          <div
            ref={menuRef}
            className="fixed z-50 bg-bg-card border border-border rounded-xl shadow-xl py-1 w-60"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-2 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-text-muted" />
                <p className="text-xs font-medium text-text-primary truncate">
                  {contextMenu.domain}
                </p>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                {Object.values(contextNode.subdomains || {}).reduce(
                  (s, c) => s + (c?.backlinkPages?.length || 0), 0
                )} backlink page{(Object.values(contextNode.subdomains || {}).reduce(
                  (s, c) => s + (c?.backlinkPages?.length || 0), 0
                )) !== 1 ? "s" : ""}
              </p>
            </div>

            <button
              onClick={() => handleExpandDomain(contextMenu.domain)}
              disabled={expanding}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
            >
              <Expand className="w-4 h-4 text-accent" />
              Expand Domain
            </button>
          </div>
        )}

        <Sidebar
          selectedNode={selectedNode}
          allNodes={result.nodes}
          allEdges={validatedEdges}
          rootDomain={result.rootDomain}
          onNodeSelect={setSelectedNodeDomain}
          onExpandDomain={handleExpandDomain}
        />
      </div>

      {crawlId && (
        <ManualBacklinkModal
          open={showManualModal}
          onClose={() => setShowManualModal(false)}
          onSuccess={handleManualSuccess}
          crawlId={crawlId}
        />
      )}
    </div>
  )
}
