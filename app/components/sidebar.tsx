"use client"

import { ExternalLink, Share2, Globe, ArrowUpRight, Layers, Link } from "lucide-react"
import { CrawlNode } from "@/lib/types"

interface SidebarProps {
  selectedNode: CrawlNode | null
  allNodes: Record<string, CrawlNode>
  rootDomain: string
  onExploreDomain: (domain: string) => void
  onNodeSelect: (domain: string | null) => void
}

export default function Sidebar({
  selectedNode,
  allNodes,
  rootDomain,
  onExploreDomain,
  onNodeSelect,
}: SidebarProps) {
  if (!selectedNode) {
    return (
      <div className="w-80 border-l border-border bg-bg-sidebar flex flex-col">
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Node Details</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <Globe className="w-8 h-8 text-text-muted mx-auto" />
            <p className="text-sm text-text-muted">Select a node to view details</p>
          </div>
        </div>
      </div>
    )
  }

  const isRoot = selectedNode.domain === rootDomain
  const childrenCount = selectedNode.children.length
  const parentNode = selectedNode.parentDomain
    ? allNodes[selectedNode.parentDomain]
    : null

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

        {selectedNode.children.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Connected Domains ({childrenCount})
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {selectedNode.children.map((child) => {
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
        <button
          onClick={() => onExploreDomain(selectedNode.domain)}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-accent rounded-lg text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Explore this Domain
        </button>
      </div>
    </div>
  )
}