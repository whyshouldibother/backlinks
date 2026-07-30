"use client"

import { useEffect, useRef, useCallback } from "react"
import cytoscape, { Core, EventObject } from "cytoscape"
import { CrawlNode, CrawlEdge } from "@/lib/types"

interface GraphViewProps {
  nodes: Record<string, CrawlNode>
  edges: CrawlEdge[]
  rootDomain: string
  searchQuery: string
  domainFilter: "all" | "internal" | "external"
  depthFilter: number
  onNodeSelect: (domain: string | null) => void
}

const depthColors: Record<number, string> = {
  0: "#2563eb",
  1: "#6366f1",
  2: "#a855f7",
  3: "#ec4899",
}

const MIN_NODE_SIZE = 20
const MAX_NODE_SIZE = 50

export default function GraphView({
  nodes,
  edges,
  rootDomain,
  searchQuery,
  domainFilter,
  depthFilter,
  onNodeSelect,
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)

  const filteredElements = useCallback(() => {
    const rootParts = rootDomain.split(".").slice(-2).join(".")
    const filteredNodeDomains = new Set<string>()

    const nodeList = Object.values(nodes).filter((n) => {
      if (n.depth > depthFilter) return false

      if (domainFilter === "internal") {
        if (!n.domain.includes(rootParts)) return false
      } else if (domainFilter === "external") {
        if (n.domain.includes(rootParts)) return false
      }

      if (searchQuery && !n.domain.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      filteredNodeDomains.add(n.domain)
      return true
    })

    const edgeList = edges.filter(
      (e) => filteredNodeDomains.has(e.source) && filteredNodeDomains.has(e.target)
    )

    const elements: cytoscape.ElementDefinition[] = [
      ...nodeList.map((n) => {
        const nodeCount = Object.keys(nodes).length
        const size =
          MIN_NODE_SIZE +
          (MAX_NODE_SIZE - MIN_NODE_SIZE) *
            (1 - (n.depth / 3))

        return {
          data: {
            id: n.domain,
            domain: n.domain,
            depth: n.depth,
            linkCount: n.children.length,
            parentDomain: n.parentDomain,
            isRoot: n.domain === rootDomain,
          },
          classes: n.domain === rootDomain ? "root" : "",
          style: {
            width: size,
            height: size,
          },
        }
      }),
      ...edgeList.map((e) => ({
        data: {
          id: `${e.source}->${e.target}`,
          source: e.source,
          target: e.target,
        },
      })),
    ]

    return elements
  }, [nodes, edges, rootDomain, searchQuery, domainFilter, depthFilter])

  useEffect(() => {
    if (!containerRef.current) return

    const elements = filteredElements()

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(domain)",
            "text-valign": "center",
            "text-halign": "center",
            "font-size": 10,
            "font-family": "Geist Variable, system-ui, sans-serif",
            color: "#1c1917",
            "background-color": "#e7e5e4",
            "border-width": 0,
            "text-wrap": "ellipsis",
            "text-max-width": "120",
            "text-margin-y": 16,
            "min-zoomed-font-size": 8,
          },
        },
        {
          selector: "node.root",
          style: {
            "background-color": "#2563eb",
            "border-width": 3,
            "border-color": "#1d4ed8",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#d4d4d4",
            "target-arrow-color": "#d4d4d4",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 0.6,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#2563eb",
            "background-color": "#eff6ff",
            color: "#1c1917",
          },
        },
        {
          selector: "node.highlighted",
          style: {
            "border-width": 3,
            "border-color": "#2563eb",
          },
        },
        {
          selector: "edge.highlighted",
          style: {
            "line-color": "#2563eb",
            "target-arrow-color": "#2563eb",
            width: 2.5,
          },
        },
      ],
      layout: {
        name: "concentric",
        concentric: (node: any) => node.data("depth"),
        levelWidth: () => 1,
        minNodeSpacing: 80,
        padding: 60,
        animate: true,
        animationDuration: 800,
        animationEasing: "ease-out",
      },
      minZoom: 0.3,
      maxZoom: 5,
      wheelSensitivity: 0.3,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      selectionType: "single",
    })

    cyRef.current = cy

    cy.on("tap", "node", (evt: EventObject) => {
      const node = evt.target
      const domain = node.data("domain")
      onNodeSelect(domain || null)
    })

    cy.on("tap", (evt: EventObject) => {
      if (evt.target === cy) {
        onNodeSelect(null)
      }
    })

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    const elements = filteredElements()

    const currentIds = new Set(cy.nodes().map((n) => n.id()))
    const newIds = new Set(elements.filter((e) => "source" in e === false).map((e: any) => e.data.id))

    const toRemove = cy.elements().filter((el) => !newIds.has(el.id()))
    cy.remove(toRemove)

    const toAdd = elements.filter((el) => !currentIds.has(el.data.id!))
    cy.add(toAdd)

    const layout = cy.layout({
      name: "concentric",
      concentric: (node: any) => node.data("depth"),
      levelWidth: () => 1,
      minNodeSpacing: 80,
      padding: 60,
      animate: true,
      animationDuration: 500,
      animationEasing: "ease-out",
      fit: true,
    })
    layout.run()

    cy.nodes().forEach((node) => {
      const depth: number = node.data("depth")
      node.style("background-color", depthColors[depth] || "#a8a29e")
    })
  }, [filteredElements])

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-bg-card"
      style={{ minHeight: 0 }}
    />
  )
}