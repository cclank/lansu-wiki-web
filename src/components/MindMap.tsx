"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import * as d3 from "d3";
import type { GraphNode, GraphLink } from "@/lib/github";

interface MindMapProps {
  nodes: GraphNode[];
  links: GraphLink[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

interface TreeNode {
  id: string;
  title: string;
  category: string;
  children: TreeNode[];
  depth: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  root: "#d4a96a",
  concepts: "#7ba3c4",
  entities: "#b48ec4",
  changelog: "#72b886",
  guides: "#c9985e",
  docs: "#c9985e",
  api: "#d48a8a",
};

function isLightTheme(): boolean {
  return document.documentElement.getAttribute("data-theme") === "light";
}

export default function MindMap({
  nodes,
  links,
  activeSlug,
  onSelect,
}: MindMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Build tree from active node
  const treeData = useMemo(() => {
    const centerSlug = activeSlug || (nodes.length > 0 ? nodes[0].id : null);
    if (!centerSlug) return null;

    const centerNode = nodes.find((n) => n.id === centerSlug);
    if (!centerNode) return null;

    // Build adjacency
    const adj = new Map<string, Set<string>>();
    for (const n of nodes) adj.set(n.id, new Set());
    for (const l of links) {
      const src = typeof l.source === "string" ? l.source : l.source;
      const tgt = typeof l.target === "string" ? l.target : l.target;
      adj.get(src)?.add(tgt);
      adj.get(tgt)?.add(src);
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const visited = new Set<string>();

    function buildTree(id: string, depth: number, maxDepth: number): TreeNode {
      visited.add(id);
      const node = nodeMap.get(id)!;
      const children: TreeNode[] = [];

      if (depth < maxDepth) {
        const neighbors = adj.get(id) || new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            children.push(buildTree(neighbor, depth + 1, maxDepth));
          }
        }
        // Sort children by link count
        children.sort((a, b) => b.children.length - a.children.length);
      }

      return {
        id,
        title: node.title,
        category: node.category,
        children,
        depth,
      };
    }

    return buildTree(centerSlug, 0, 3);
  }, [nodes, links, activeSlug]);

  const render = useCallback(() => {
    if (!svgRef.current || !treeData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svgRef.current.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", `translate(${width / 2 + event.transform.x},${height / 2 + event.transform.y}) scale(${event.transform.k})`);
      });
    (svg as d3.Selection<SVGSVGElement, unknown, null, undefined>).call(
      zoom as unknown as (sel: d3.Selection<SVGSVGElement, unknown, null, undefined>) => void
    );

    // Create radial tree layout
    const root = d3.hierarchy(treeData);
    const treeLayout = d3
      .tree<TreeNode>()
      .size([2 * Math.PI, Math.min(width, height) * 0.35])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

    treeLayout(root);

    // Radial link generator
    const linkGen = d3
      .linkRadial<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
      .angle((d) => d.x)
      .radius((d) => d.y);

    // Draw links with gradient animation
    const linkGroup = g.append("g");
    root.links().forEach((link, i) => {
      const sourceColor = CATEGORY_COLORS[link.source.data.category] || "#3b82f6";

      // Gradient
      const gradientId = `mindmap-grad-${i}`;
      svg.append("defs").append("linearGradient")
        .attr("id", gradientId)
        .attr("gradientUnits", "userSpaceOnUse")
        .selectAll("stop")
        .data([
          { offset: "0%", color: sourceColor, opacity: 0.6 },
          { offset: "100%", color: sourceColor, opacity: 0.1 },
        ])
        .join("stop")
        .attr("offset", (d) => d.offset)
        .attr("stop-color", (d) => d.color)
        .attr("stop-opacity", (d) => d.opacity);

      linkGroup
        .append("path")
        .attr("d", linkGen(link as unknown as d3.HierarchyPointLink<TreeNode>))
        .attr("fill", "none")
        .attr("stroke", `url(#${gradientId})`)
        .attr("stroke-width", 2)
        .attr("opacity", 0)
        .transition()
        .delay(i * 30)
        .duration(600)
        .attr("opacity", 1);
    });

    // Draw nodes
    const nodeGroup = g
      .append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", (d) => {
        const angle = (d.x ?? 0) - Math.PI / 2;
        const r = d.y ?? 0;
        return `translate(${r * Math.cos(angle)},${r * Math.sin(angle)})`;
      })
      .style("cursor", "pointer")
      .on("click", (_, d) => onSelect(d.data.id));

    // Node glow
    nodeGroup
      .append("circle")
      .attr("r", (d) => (d.depth === 0 ? 24 : 16 - d.depth * 3))
      .attr("fill", (d) => {
        const c = CATEGORY_COLORS[d.data.category] || "#3b82f6";
        return c;
      })
      .attr("opacity", 0.12)
      .attr("filter", "blur(4px)");

    // Node core
    nodeGroup
      .append("circle")
      .attr("r", (d) => (d.depth === 0 ? 14 : 8 - d.depth))
      .attr("fill", (d) => CATEGORY_COLORS[d.data.category] || "#3b82f6")
      .attr("stroke", (d) => (d.data.id === activeSlug ? (light ? "#2c2825" : "#fff") : "transparent"))
      .attr("stroke-width", 2)
      .attr("opacity", 0)
      .transition()
      .delay((_, i) => i * 40)
      .duration(400)
      .attr("opacity", 1);

    // Pulse animation for center node
    nodeGroup
      .filter((d) => d.depth === 0)
      .append("circle")
      .attr("r", 14)
      .attr("fill", "none")
      .attr("stroke", (d) => CATEGORY_COLORS[d.data.category] || "#3b82f6")
      .attr("stroke-width", 1)
      .attr("opacity", 0.6)
      .each(function pulse() {
        d3.select(this)
          .transition()
          .duration(2000)
          .attr("r", 28)
          .attr("opacity", 0)
          .transition()
          .duration(0)
          .attr("r", 14)
          .attr("opacity", 0.6)
          .on("end", pulse);
      });

    const light = isLightTheme();

    // Labels
    nodeGroup
      .append("text")
      .attr("dy", (d) => (d.depth === 0 ? -22 : -14))
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => (d.depth === 0 ? "13px" : `${12 - d.depth}px`))
      .attr("fill", (d) => (d.depth === 0 ? (light ? "#2c2825" : "#e8eaed") : (light ? "#5c5550" : "#9aa0b0")))
      .attr("font-weight", (d) => (d.depth === 0 ? "600" : "400"))
      .text((d) => {
        const t = d.data.title;
        const maxLen = d.depth === 0 ? 30 : 20 - d.depth * 4;
        return t.length > maxLen ? t.slice(0, maxLen - 1) + "…" : t;
      })
      .attr("opacity", 0)
      .transition()
      .delay((_, i) => i * 40 + 200)
      .duration(400)
      .attr("opacity", 1);
  }, [treeData, activeSlug, onSelect]);

  useEffect(() => {
    render();
    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [render]);

  if (!treeData) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
        选择一个页面作为脑图中心
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[500px] bg-bg-primary rounded-xl border border-border-primary overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />

      {/* Center node info */}
      <div className="absolute top-4 left-4 bg-bg-primary/80 backdrop-blur-md border border-border-primary rounded-xl px-4 py-3">
        <div className="text-xs text-text-tertiary mb-1">脑图中心</div>
        <div className="text-sm font-medium text-text-primary">{treeData.title}</div>
        <div className="text-xs text-text-tertiary mt-1">
          {treeData.children.length} 个直接关联
        </div>
      </div>

      {/* Help */}
      <div className="absolute bottom-4 right-4 text-xs text-text-tertiary bg-bg-primary/80 backdrop-blur-md border border-border-primary rounded-xl px-3 py-2">
        点击节点切换中心 · 滚轮缩放
      </div>
    </div>
  );
}
