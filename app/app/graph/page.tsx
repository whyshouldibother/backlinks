"use client"

import { Suspense, useEffect, useState, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { ArrowLeft, RefreshCw, Loader2, AlertCircle } from "lucide-react"
import GraphView from "@/components/graph-view"
import Sidebar from "@/components/sidebar"
import FilterBar from "@/components/filter-bar"
import SearchBar from "@/components/search-bar"
import { CrawlResult, DomainFilter } from "@/lib/types"

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
      <GraphContent />
    </Suspense>
  )
}

function GraphContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const crawlId = searchParams.get("crawlId")
  const domain = searchParams.get("domain")

  const [result, setResult] = useState<CrawlResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNodeDomain, setSelectedNodeDomain] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [domainFilter, setDomainFilter] = useState<DomainFilter>("all")
  const [depthFilter, setDepthFilter] = useState(3)

  useEffect(() => {
    if (!crawlId) {
      setError("No crawl data found. Please start a new crawl.")
      setLoading(false)
      return
    }

    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/crawl/result?id=${crawlId}`)
        if (!res.ok) throw new Error("Result not found")
        const data = await res.json()
        setResult(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load results")
      } finally {
        setLoading(false)
      }
    }

    fetchResult()
  }, [crawlId])

  const handleNodeSelect = useCallback((domain: string | null) => {
    setSelectedNodeDomain(domain)
  }, [])

  const handleExploreDomain = useCallback(
    (newDomain: string) => {
      router.push(`/?url=${encodeURIComponent(newDomain)}`)
    },
    [router]
  )

  const selectedNode = useMemo(() => {
    if (!selectedNodeDomain || !result) return null
    return result.nodes[selectedNodeDomain] || null
  }, [selectedNodeDomain, result])

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

  const nodeCount = Object.keys(result.nodes).length

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
              {nodeCount} domains · {result.edges.length} connections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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

      <div className="flex flex-1 min-h-0">
        <GraphView
          nodes={result.nodes}
          edges={result.edges}
          rootDomain={result.rootDomain}
          searchQuery={searchQuery}
          domainFilter={domainFilter}
          depthFilter={depthFilter}
          onNodeSelect={handleNodeSelect}
        />
        <Sidebar
          selectedNode={selectedNode}
          allNodes={result.nodes}
          rootDomain={result.rootDomain}
          onExploreDomain={handleExploreDomain}
          onNodeSelect={handleNodeSelect}
        />
      </div>
    </div>
  )
}