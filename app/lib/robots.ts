import robotsParser from "robots-parser"
import { chromium } from "playwright"

type Robot = ReturnType<typeof robotsParser>

const robotsCache = new Map<string, Robot>()

export async function isAllowed(domain: string): Promise<boolean> {
  if (!robotsCache.has(domain)) {
    try {
      const browser = await chromium.launch({ headless: true })
      const page = await browser.newPage()
      let robotsTxt = ""
      try {
        const response = await page.goto(
          `https://${domain}/robots.txt`,
          { timeout: 10000, waitUntil: "domcontentloaded" }
        )
        robotsTxt = await response!.text()
      } catch {
        robotsTxt = "User-agent: *\nDisallow:"
      }
      await browser.close()

      const parser = robotsParser(`https://${domain}/robots.txt`, robotsTxt)
      robotsCache.set(domain, parser)
    } catch {
      robotsCache.set(domain, null as unknown as Robot)
      return true
    }
  }

  const parser = robotsCache.get(domain)
  if (!parser) return true
  return parser.isAllowed(`https://${domain}/`, "backlinks-graph-explorer") !== false
}
