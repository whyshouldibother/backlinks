import normalizeUrl from "normalize-url"

export function extractDomain(urlString: string): string {
  try {
    const url = new URL(urlString)
    let hostname = url.hostname.toLowerCase()
    hostname = hostname.replace(/^www\./, "")
    return hostname
  } catch {
    return urlString.toLowerCase().replace(/^www\./, "")
  }
}

export function normalize(url: string): string {
  return normalizeUrl(url, {
    stripWWW: true,
    removeTrailingSlash: true,
    sortQueryParameters: true,
    removeQueryParameters: [/^utm_.*/, /^ref$/],
    stripHash: true,
    stripTextFragment: true,
  })
}

export function extractLinksFromHtml(
  html: string,
  baseUrl: string
): string[] {
  const links: string[] = []
  const hrefRegex = /<a[^>]+href=["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl).href
      if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
        links.push(normalize(resolved))
      }
    } catch {
      continue
    }
  }
  return links
}

export function isSameDomain(domainA: string, domainB: string): boolean {
  return domainA === domainB
}

export function isSubdomainOf(domain: string, parent: string): boolean {
  return domain.endsWith("." + parent)
}

export function getRootDomain(domain: string): string {
  const parts = domain.split(".")
  if (parts.length <= 2) return domain
  return parts.slice(-2).join(".")
}