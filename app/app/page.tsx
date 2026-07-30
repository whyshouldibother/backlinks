"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Globe, ArrowRight, Loader2, Link, Layers } from "lucide-react"
import { extractDomain, normalize } from "@/lib/url"
import { CrawlEvent } from "@/lib/types"

export default function Home() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [crawling, setCrawling] = useState(false)
  const [progress, setProgress] = useState({
    domainsDiscovered: 0,
    linksFound: 0,
    currentDepth: 0,
  })
  const [error, setError] = useState<string | null>(null)

  const handleCrawl = useCallback(async () => {
    if (!url.trim()) return
    setCrawling(true)
    setError(null)
    setProgress({ domainsDiscovered: 0, linksFound: 0, currentDepth: 0 })

    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalize(url.trim()) }),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const reader = response.body!.getReader()
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

            if (event.type === "progress") {
              setProgress({
                domainsDiscovered: event.domainsDiscovered,
                linksFound: event.linksFound,
                currentDepth: event.currentDepth,
              })
            } else if (event.type === "complete") {
              const domain = extractDomain(normalize(url.trim()))
              router.push(`/graph?crawlId=${event.crawlId}&domain=${encodeURIComponent(domain)}`)
              return
            } else if (event.type === "error") {
              setError(event.message)
              setCrawling(false)
              return
            }
          } catch {
            continue
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Crawl failed")
      setCrawling(false)
    }
  }, [url, router])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg mx-auto text-center space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-accent/10 mb-2">
            <Globe className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
            Backlink Graph Explorer
          </h1>
          <p className="text-text-secondary text-[15px] leading-relaxed max-w-sm mx-auto">
            Enter a website URL to explore its backlink graph. Discover how
            domains connect across the web.
          </p>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-1.5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3">
              <Link className="w-4 h-4 text-text-muted shrink-0" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !crawling && handleCrawl()}
                placeholder="example.com"
                className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted text-[15px] py-2.5 outline-none"
                disabled={crawling}
              />
            </div>
            <button
              onClick={handleCrawl}
              disabled={crawling || !url.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {crawling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Crawling
                </>
              ) : (
                <>
                  Explore Website
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 rounded-lg px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {crawling && (
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              Crawling website...
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center space-y-1">
                <div className="text-2xl font-semibold text-text-primary">
                  {progress.domainsDiscovered}
                </div>
                <div className="text-xs text-text-muted">Domains</div>
              </div>
              <div className="text-center space-y-1">
                <div className="text-2xl font-semibold text-text-primary">
                  {progress.linksFound}
                </div>
                <div className="text-xs text-text-muted">Connections</div>
              </div>
              <div className="text-center space-y-1">
                <div className="text-2xl font-semibold text-text-primary">
                  {progress.currentDepth}/3
                </div>
                <div className="text-xs text-text-muted">Depth</div>
              </div>
            </div>
            <div className="w-full bg-bg-surface rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (progress.currentDepth / 3) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}