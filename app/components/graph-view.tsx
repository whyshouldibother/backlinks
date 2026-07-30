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
  onNodeContextMenu: (domain: string, x: number, y: number) => void
  onBackgroundTap: () => void
  onNodeTap: (domain: string) => void
}

const depthColors: Record<number, string> = {
  0: "#2563eb",
  1: "#6366f1",
  2: "#a855f7",
  3: "#ec4899",
}

export default function GraphView({
  nodes,
  edges,
  rootDomain,
  searchQuery,
  domainFilter,
  depthFilter,
  onNodeContextMenu,
  onBackgroundTap,
  onNodeTap,
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const onNodeTapRef = useRef(onNodeTap)
  const onNodeContextMenuRef = useRef(onNodeContextMenu)
  const onBackgroundTapRef = useRef(onBackgroundTap)
  const rootDomainRef = useRef(rootDomain)
  onNodeTapRef.current = onNodeTap
  onNodeContextMenuRef.current = onNodeContextMenu
  onBackgroundTapRef.current = onBackgroundTap
  rootDomainRef.current = rootDomain

  const graphElements = useCallback(() => {
    try {
      const rootParts = rootDomain.split(".").slice(-2).join(".")
      const nodeValues = Object.values(nodes || {})
      const filteredNodes = nodeValues.filter((n) => {
        if (!n) return false
        if (n.depth > depthFilter) return false
        if (domainFilter === "internal" && !n.domain.includes(rootParts)) return false
        if (domainFilter === "external" && n.domain.includes(rootParts)) return false
        if (searchQuery && !n.domain.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
      })

      const nodeSet = new Set(filteredNodes.map(n => n.domain))
      const elements: cytoscape.ElementDefinition[] = []

      for (const n of filteredNodes) {
        if (!n) continue
        const isRoot = n.domain === rootDomain
        const totalBacklinkPages = Object.values(n.subdomains || {}).reduce(
          (sum, c) => sum + (c?.backlinkPages?.length || 0), 0
        )

        elements.push({
          data: {
            id: n.domain,
            domain: n.domain,
            depth: n.depth,
            linkCount: (n.children || []).length,
            backlinkCount: totalBacklinkPages,
            parentDomain: n.parentDomain,
            isRoot,
          },
          classes: `node ${isRoot ? "root" : ""}`,
          position: undefined,
        })
      }

      const validEdges = edges.filter(e =>
        nodeSet.has(e.source) && nodeSet.has(e.target)
      )

      const aggregated = new Map<string, { count: number }>()
      for (const e of validEdges) {
        const key = `${e.source}->${e.target}`
        const existing = aggregated.get(key)
        if (existing) {
          existing.count += (e.paths || []).length
        } else {
          aggregated.set(key, { count: (e.paths || []).length })
        }
      }

      for (const [key, data] of aggregated) {
        const [src, tgt] = key.split("->")
        elements.push({
          data: {
            id: key,
            source: src,
            target: tgt,
            count: data.count,
          },
        })
      }

      const allNodeIds = new Set(elements.filter(e => e.data && !("source" in e.data)).map(e => e.data!.id!))
      const finalElements: cytoscape.ElementDefinition[] = []
      let droppedEdges = 0
      for (const el of elements) {
        if (el.data && "source" in el.data) {
          const src = el.data.source
          const tgt = el.data.target
          if (!allNodeIds.has(src) || !allNodeIds.has(tgt)) {
            droppedEdges++
            continue
          }
        }
        finalElements.push(el)
      }
      if (droppedEdges > 0) {
        console.warn(`[GRAPH-VIEW] Dropped ${droppedEdges} edges referencing non-existent nodes`)
      }

      return finalElements
    } catch (err) {
      console.error("[GRAPH-VIEW] Error building elements:", err)
      return []
    }
  }, [nodes, edges, rootDomain, searchQuery, domainFilter, depthFilter])

  useEffect(() => {
    if (!containerRef.current) return
    try {
      const els = graphElements()

      const cy = cytoscape({
        container: containerRef.current,
        elements: els,
        style: [
          {
            selector: "node",
            style: {
              "background-color": "#f0f0f0",
              "border-width": 3,
              "border-color": "#d0d0d0",
              shape: "ellipse",
              label: "data(domain)",
              "text-valign": "center",
              "text-halign": "center",
              "font-size": 14,
              "font-weight": "bold",
              "font-family": "Geist Variable, system-ui, sans-serif",
              color: "#1c1917",
              "min-zoomed-font-size": 8,
              "text-wrap": "wrap",
              "text-max-width": "140",
              width: 90,
              height: 90,
            },
          },
          {
            selector: "node.root",
            style: {
              "border-color": "#2563eb",
              "border-width": 4,
              "background-color": "#eff6ff",
            },
          },
          {
            selector: "edge",
            style: {
              width: "mapData(count, 0, 20, 1, 6)",
              "line-color": "#a8a29e",
              "target-arrow-color": "#a8a29e",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              "arrow-scale": 0.8,
              "line-style": "dashed",
            },
          },
          {
            selector: "node:selected",
            style: {
              "border-width": 3,
              "border-color": "#2563eb",
              "background-color": "#eff6ff",
            },
          },
        ],
        layout: {
          name: "cose",
          animate: true,
          animationDuration: 800,
          animationEasing: "ease-out",
          nodeRepulsion: () => 15000,
          nodeOverlap: 4,
          idealEdgeLength: () => 160,
          edgeElasticity: () => 100,
          gravity: 0.5,
          numIter: 1000,
          initialTemp: 1200,
          coolingFactor: 0.99,
          minTemp: 1,
          fit: true,
          padding: 60,
        },
        minZoom: 0.1,
        maxZoom: 5,
        wheelSensitivity: 0.3,
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false,
        selectionType: "single",
      })

      cyRef.current = cy

      cy.on("tap", "node", (evt: EventObject) => {
        const domain = evt.target.data("domain")
        onNodeTapRef.current(domain)
      })

      cy.on("cxttap", "node", (evt: EventObject) => {
        const node = evt.target
        const d = node.data("domain")
        const rp = node.renderedPosition()
        const cr = containerRef.current!.getBoundingClientRect()
        onNodeContextMenuRef.current(d, cr.left + rp.x, cr.top + rp.y)
      })

      cy.on("tap", (evt: EventObject) => {
        if (evt.target === cy) onBackgroundTapRef.current()
      })
      cy.on("cxttap", (evt: EventObject) => {
        if (evt.target === cy) onBackgroundTapRef.current()
      })
    } catch (err) {
      console.error("[GRAPH-VIEW] Init failed:", err)
    }

    return () => {
      if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null }
    }
  }, [])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    try {
      const els = graphElements()
      if (els.length === 0) return

      const newElIds = new Set(els.map(e => e.data?.id).filter(Boolean) as string[])

      const toRemove = cy.elements().filter(el => !newElIds.has(el.id()))
      const toAdd = els.filter(el => !el.data?.id || !cy.getElementById(el.data.id).length)

      if (toRemove.length > 0) cy.remove(toRemove)
      if (toAdd.length > 0) cy.add(toAdd)

      const hasNewOrRemoved = toAdd.length > 0 || toRemove.length > 0

      if (hasNewOrRemoved) {
        cy.layout({
          name: "cose",
          animate: true,
          animationDuration: 600,
          animationEasing: "ease-out",
          nodeRepulsion: () => 15000,
          nodeOverlap: 4,
          idealEdgeLength: () => 160,
          edgeElasticity: () => 100,
          gravity: 0.5,
          numIter: 300,
          initialTemp: 400,
          coolingFactor: 0.99,
          minTemp: 1,
          fit: false,
        }).run()
      }

      cy.nodes().forEach((node) => {
        const d: number = node.data("depth")
        const isRoot: boolean = node.data("isRoot")
        if (isRoot) return
        node.style("border-color", depthColors[d] || "#a8a29e")
      })
    } catch (err) {
      console.error("[GRAPH-VIEW] Update error:", err)
    }
  }, [graphElements])

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-bg-card"
      style={{ minHeight: 0 }}
    />
  )
}
