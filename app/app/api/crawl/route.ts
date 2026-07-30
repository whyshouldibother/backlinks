import { NextRequest } from "next/server"
import { crawlWebsite } from "@/lib/crawler"
import { cacheResult, generateCrawlId } from "@/lib/cache"
import { CrawlEvent } from "@/lib/types"

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const { url } = await req.json()

  if (!url || typeof url !== "string") {
    return new Response(JSON.stringify({ error: "URL is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const encoder = new TextEncoder()
  const crawlId = generateCrawlId()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: CrawlEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
      }

      try {
        const result = await crawlWebsite(url, send)
        cacheResult(crawlId, result)
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