import { NextRequest } from "next/server"
import { crawlWebsite, expandDomain, expandPath } from "@/lib/crawler"
import { cacheResult, generateCrawlId } from "@/lib/cache"
import { CrawlEvent, CrawlResult } from "@/lib/types"

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const body = await req.json()

  const encoder = new TextEncoder()
  const crawlId = body.crawlId || generateCrawlId()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: CrawlEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
      }

      try {
        let result: CrawlResult

        if (body.expandDomain) {
          const { domain, parentDomain, currentDepth, maxDepth } = body.expandDomain
          result = await expandDomain(
            domain,
            parentDomain || null,
            currentDepth || 0,
            maxDepth || 1,
            crawlId,
            send
          )
        } else if (body.expandPath) {
          const { url, domain, parentDomain, currentDepth, maxDepth } = body.expandPath
          result = await expandPath(
            url,
            domain,
            parentDomain || null,
            currentDepth || 0,
            maxDepth || 1,
            crawlId,
            send
          )
        } else {
          const { url, maxDepth } = body
          if (!url || typeof url !== "string") {
            send({ type: "error", message: "URL is required" })
            controller.close()
            return
          }
          result = await crawlWebsite(url, maxDepth || 1, send)
        }

        cacheResult(crawlId, result)
        send({ type: "update", nodes: result.nodes, edges: result.edges })
        send({ type: "complete", crawlId })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Crawl failed unexpectedly"
        send({ type: "error", message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
