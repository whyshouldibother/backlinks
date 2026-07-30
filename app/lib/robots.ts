import robotsParser from "robots-parser"

type Robot = ReturnType<typeof robotsParser>

const robotsCache = new Map<string, Robot>()

export async function isAllowed(domain: string): Promise<boolean> {
  if (robotsCache.has(domain)) {
    const parser = robotsCache.get(domain)
    if (!parser) return true
    return parser.isAllowed(`https://${domain}/`, "backlinks-graph-explorer") !== false
  }

  try {
    const response = await fetch(`https://${domain}/robots.txt`, {
      signal: AbortSignal.timeout(8000),
    })
    const robotsTxt = await response.text()
    const parser = robotsParser(`https://${domain}/robots.txt`, robotsTxt)
    robotsCache.set(domain, parser)
    return parser.isAllowed(`https://${domain}/`, "backlinks-graph-explorer") !== false
  } catch {
    robotsCache.set(domain, null as unknown as Robot)
    return true
  }
}
