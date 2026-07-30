"use client"

import { useMemo } from "react"
import { CrawlNode, DomainFilter } from "@/lib/types"

interface FilterBarProps {
  nodes: Record<string, CrawlNode>
  rootDomain: string
  domainFilter: DomainFilter
  onDomainFilterChange: (filter: DomainFilter) => void
  depthFilter: number
  onDepthFilterChange: (depth: number) => void
}

export default function FilterBar({
  nodes,
  rootDomain,
  domainFilter,
  onDomainFilterChange,
  depthFilter,
  onDepthFilterChange,
}: FilterBarProps) {
  const maxDepth = useMemo(() => {
    let max = 0
    for (const node of Object.values(nodes)) {
      if (node.depth > max) max = node.depth
    }
    return max
  }, [nodes])

  const counts = useMemo(() => {
    const total = Object.keys(nodes).length
    const internal = Object.values(nodes).filter(
      (n) => n.domain.includes(rootDomain.split(".").slice(-2).join("."))
    ).length
    return { total, internal, external: total - internal }
  }, [nodes, rootDomain])

  return (
    <div className="flex items-center gap-3">
      <div className="flex bg-bg-surface rounded-lg p-0.5 border border-border">
        {(["all", "internal", "external"] as DomainFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => onDomainFilterChange(filter)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
              domainFilter === filter
                ? "bg-bg-card text-text-primary shadow-xs"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {filter}
            <span className="ml-1 text-text-muted">
              ({counts[filter === "all" ? "total" : filter]})
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        <span className="font-medium text-text-secondary">Depth:</span>
        {Array.from({ length: maxDepth + 1 }, (_, i) => (
          <button
            key={i}
            onClick={() => onDepthFilterChange(i)}
            className={`px-2 py-1 rounded font-medium transition-colors ${
              depthFilter >= i
                ? "bg-accent/10 text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  )
}