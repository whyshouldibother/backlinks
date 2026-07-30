"use client"

import { useState, useRef, useEffect } from "react"
import { Loader2, CheckCircle, AlertCircle, X, ExternalLink } from "lucide-react"
import { CrawlNode, CrawlEdge } from "@/lib/types"

interface ManualBacklinkModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (nodes: Record<string, CrawlNode>, edges: CrawlEdge[]) => void
  crawlId: string
}

export default function ManualBacklinkModal({
  open,
  onClose,
  onSuccess,
  crawlId,
}: ManualBacklinkModalProps) {
  const [url, setUrl] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setUrl("")
      setResult(null)
      setVerifying(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && open && !verifying) onClose()
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open, verifying, onClose])

  if (!open) return null

  const handleVerify = async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setVerifying(true)
    setResult(null)

    try {
      const res = await fetch("/api/crawl/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: trimmed, crawlId }),
      })

      const data = await res.json()

      if (data.verified) {
        setResult({ success: true, message: data.message || "Backlink verified and added to graph!" })
        onSuccess(data.nodes, data.edges)
        setTimeout(() => onClose(), 1500)
      } else {
        setResult({ success: false, message: data.error || "Verification failed." })
      }
    } catch {
      setResult({ success: false, message: "Network error. Please try again." })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={verifying ? undefined : onClose} />
      <div className="relative bg-bg-card rounded-xl shadow-2xl border border-border w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Add Backlink Page</h2>
          <button
            onClick={verifying ? undefined : onClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Source Page URL</label>
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !verifying && url.trim()) handleVerify() }}
              placeholder="https://github.com/user/repository"
              disabled={verifying}
              className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent transition-colors disabled:opacity-50"
            />
          </div>

          {result && (
            <div
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-sm ${
                result.success
                  ? "bg-success/10 text-success"
                  : "bg-error/10 text-error"
              }`}
            >
              {result.success ? (
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{result.message}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-bg-surface/50">
          <button
            onClick={onClose}
            disabled={verifying}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleVerify}
            disabled={verifying || !url.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Verify & Add
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
