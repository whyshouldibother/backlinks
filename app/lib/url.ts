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

export function extractPath(urlString: string): string {
  try {
    const url = new URL(urlString)
    let path = url.pathname
    if (url.search) path += url.search
    return path || "/"
  } catch {
    return "/"
  }
}

export function getRootDomain(domain: string): string {
  const parts = domain.split(".")
  if (parts.length <= 2) return domain
  return parts.slice(-2).join(".")
}

export function getSubdomain(domain: string): string {
  const root = getRootDomain(domain)
  if (domain === root) return ""
  const suffix = "." + root
  if (domain.endsWith(suffix)) {
    return domain.slice(0, -suffix.length)
  }
  return ""
}

export function extractSubdomainPath(urlString: string): string {
  try {
    const url = new URL(urlString)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "")
    const parts = hostname.split(".")
    let path = url.pathname
    if (url.search) path += url.search
    if (parts.length > 2) {
      const subdomain = parts.slice(0, -2).join(".")
      path = subdomain + path
    }
    return path || "/"
  } catch {
    return "/"
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
): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = []
  const anchorRegex = /<a\s([^>]*?)>(.*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = anchorRegex.exec(html)) !== null) {
    const attrs = match[1]
    const rawText = match[2]
    const hrefAttr = /href\s*=\s*(["'])(.*?)\1/i.exec(attrs)
    if (!hrefAttr) continue
    try {
      const resolved = new URL(hrefAttr[2], baseUrl).href
      if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
        const text = rawText.replace(/<[^>]*>/g, "").trim().slice(0, 200)
        links.push({ href: normalize(resolved), text })
      }
    } catch {
      continue
    }
  }
  return links
}

export function extractPageTitle(html: string): string | undefined {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html)
  if (match) {
    const title = match[1].trim()
    return title.length > 0 ? title : undefined
  }
  return undefined
}

export function isSameDomain(domainA: string, domainB: string): boolean {
  return domainA === domainB
}

export function isSubdomainOf(domain: string, parent: string): boolean {
  return domain.endsWith("." + parent)
}

export function isSameRootDomain(domainA: string, domainB: string): boolean {
  return getRootDomain(domainA) === getRootDomain(domainB)
}
