"use client"

import { useMemo } from "react"
import { ExternalLink, Globe, ArrowUpRight, Layers, Link, FileText, Expand, BookText } from "lucide-react"
import { CrawlNode, CrawlEdge } from "@/lib/types"
import { extractSubdomainPath } from "@/lib/url"

interface SidebarProps {
  selectedNode: CrawlNode | null
  allNodes: Record<string, CrawlNode>
  allEdges: CrawlEdge[]
  rootDomain: string
  onNodeSelect: (domain: string | null) => void
  onExpandDomain: (domain: string) => void
}

export default function Sidebar({
  selectedNode,
  allNodes,
  allEdges,
  rootDomain,
  onNodeSelect,
  onExpandDomain,
}: SidebarProps) {
  const isRoot = selectedNode ? selectedNode.domain === rootDomain : false

  const incomingEdges = useMemo(() => {
    if (!selectedNode) return []
    return allEdges.filter(e => e.target === selectedNode.domain)
  }, [allEdges, selectedNode])

  const outgoingEdges = useMemo(() => {
    if (!selectedNode) return []
    return allEdges.filter(e => e.source === selectedNode.domain)
  }, [allEdges, selectedNode])

  const incomingLinks = useMemo(() => {
    return incomingEdges.flatMap(e =>
      e.paths.map(p => ({
        sourceDomain: e.source,
        sourceUrl: p.sourceUrl,
      }))
    )
  }, [incomingEdges])

  const backlinkPageEntries = useMemo(() => {
    if (!selectedNode) return []
    const entries: Array<{
      title: string
      sourceUrl: string
      linkedTargetUrl: string
      anchorText: string
    }> = []
    const seen = new Set<string>()
    for (const child of Object.values(selectedNode.subdomains || {})) {
      if (!child || !child.backlinkPages) continue
      for (const bp of child.backlinkPages) {
        const matchingPaths = outgoingEdges.flatMap(e =>
          (e.paths || []).filter(p => p.sourceUrl === bp.url)
        )
        if (matchingPaths.length > 0) {
          for (const path of matchingPaths) {
            const key = bp.url + "::" + path.url
            if (seen.has(key)) continue
            seen.add(key)
            entries.push({
              title: bp.title || "",
              sourceUrl: bp.url,
              linkedTargetUrl: path.url,
              anchorText: path.anchorText || "",
            })
          }
        } else {
          const key = bp.url
          if (seen.has(key)) continue
          seen.add(key)
          entries.push({
            title: bp.title || "",
            sourceUrl: bp.url,
            linkedTargetUrl: "",
            anchorText: "",
          })
        }
      }
    }
    return entries
  }, [selectedNode, outgoingEdges])

  if (!selectedNode) {
    return (
      <div className="w-80 border-l border-border bg-bg-sidebar flex flex-col">
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Node Details</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <Globe className="w-8 h-8 text-text-muted mx-auto" />
            <p className="text-sm text-text-muted">Click a node to view details</p>
          </div>
        </div>
      </div>
    )
  }

  const parentNode = selectedNode.parentDomain
    ? allNodes[selectedNode.parentDomain]
    : null

  const validChildren = selectedNode.children.filter(child => child in allNodes)
  const childrenCount = validChildren.length
  const invalidChildren = selectedNode.children.filter(child => !(child in allNodes))
  if (invalidChildren.length > 0) {
    console.warn(`[SIDEBAR] ${invalidChildren.length} children of "${selectedNode.domain}" not in node set: ${invalidChildren.join(", ")}`)
  }

  const totalBp = Object.values(selectedNode.subdomains || {}).reduce(
    (sum, c) => sum + (c?.backlinkPages?.length || 0), 0
  )

  return (
    <div className="w-80 border-l border-border bg-bg-sidebar flex flex-col">
      <div className="p-5 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Node Details</h2>
          <button
            onClick={() => onNodeSelect(null)}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Deselect
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isRoot
                ? "bg-accent"
                : selectedNode.depth === 1
                  ? "bg-indigo-500"
                  : selectedNode.depth === 2
                    ? "bg-purple-500"
                    : "bg-pink-500"
            }`}
          />
          <span className="text-[15px] font-medium text-text-primary truncate">
            {selectedNode.domain}
          </span>
        </div>

        {isRoot && (
          <span className="inline-flex text-xs font-medium text-accent bg-accent-light px-2 py-0.5 rounded">
            Root domain
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-surface rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Layers className="w-3.5 h-3.5" />
              Depth
            </div>
            <div className="text-lg font-semibold text-text-primary">
              {selectedNode.depth}
            </div>
          </div>
          <div className="bg-bg-surface rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Link className="w-3.5 h-3.5" />
              Links out
            </div>
            <div className="text-lg font-semibold text-text-primary">
              {childrenCount}
            </div>
          </div>
        </div>

        <div className="bg-bg-surface rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <FileText className="w-3.5 h-3.5" />
            Backlink pages
          </div>
          <div className="text-lg font-semibold text-text-primary">
            {totalBp}
          </div>
        </div>

        {backlinkPageEntries.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Pages with Backlinks
            </h3>
            <div className="space-y-2">
              {backlinkPageEntries.map((entry, i) => (
                <div key={i} className="bg-bg-surface rounded-lg p-3 space-y-2">
                  {entry.title && (
                    <p className="text-sm font-medium text-text-primary">{entry.title}</p>
                  )}
                  <div className="space-y-1">
                    <span className="text-xs text-text-muted">Source URL</span>
                    <p className="text-xs font-mono text-text-secondary break-all">{entry.sourceUrl}</p>
                  </div>
                  {entry.linkedTargetUrl && (
                    <div className="space-y-1">
                      <span className="text-xs text-text-muted">Linked target URL</span>
                      <a
                        href={entry.linkedTargetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-accent break-all hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        {entry.linkedTargetUrl}
                      </a>
                    </div>
                  )}
                  {entry.anchorText && (
                    <div className="flex items-start gap-1 text-xs text-text-secondary">
                      <BookText className="w-3 h-3 mt-0.5 shrink-0" />
                      <span className="italic">"{entry.anchorText}"</span>
                    </div>
                  )}
                  <a
                    href={entry.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Visit Backlink Page
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {incomingLinks.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Incoming Links ({incomingLinks.length})
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {incomingLinks.map((bl, i) => (
                <a
                  key={i}
                  href={bl.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-0.5 px-3 py-2 bg-bg-surface rounded-lg text-xs hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  <span className="text-text-primary truncate font-mono">
                    {extractSubdomainPath(bl.sourceUrl)}
                  </span>
                  <span className="text-text-muted truncate">
                    on {bl.sourceDomain}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {parentNode && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Parent Domain
            </h3>
            <button
              onClick={() => onNodeSelect(selectedNode.parentDomain)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-bg-surface rounded-lg text-sm text-text-primary hover:bg-bg-hover transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-text-muted" />
              {selectedNode.parentDomain}
            </button>
          </div>
        )}

        {validChildren.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Connected Domains ({childrenCount})
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {validChildren.map((child) => {
                const childNode = allNodes[child]
                return (
                  <button
                    key={child}
                    onClick={() => onNodeSelect(child)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors text-left"
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        childNode
                          ? childNode.depth === 1
                            ? "bg-indigo-400"
                            : childNode.depth === 2
                              ? "bg-purple-400"
                              : "bg-pink-400"
                          : "bg-text-muted"
                      }`}
                    />
                    <span className="truncate">{child}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Actions
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => onExpandDomain(selectedNode.domain)}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              <Expand className="w-4 h-4" />
              Expand Domain
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border space-y-2">
        <a
          href={`https://${selectedNode.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-bg-surface rounded-lg text-sm font-medium text-text-primary hover:bg-bg-hover transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Open Website
        </a>
      </div>
    </div>
  )
}
