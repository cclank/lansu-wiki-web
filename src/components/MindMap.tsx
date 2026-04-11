"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import * as d3 from "d3";
import type { GraphNode, GraphLink, WikiPage } from "@/lib/github";

interface MindMapProps {
  nodes: GraphNode[];
  links: GraphLink[];
  pages: WikiPage[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
  onNavigate: (slug: string) => void;
}

interface TreeNode {
  id: string;
  title: string;
  category: string;
  children: TreeNode[];
  depth: number;
  totalDescendants: number;
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

function countDescendants(node: TreeNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  node.totalDescendants = count;
  return count;
}

function extractSummary(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("---") &&
      !trimmed.startsWith("|") &&
      !trimmed.startsWith("```") &&
      !trimmed.startsWith("![") &&
      !trimmed.startsWith(">")
    ) {
      // Strip markdown formatting
      const clean = trimmed
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\[\[([^\]]+)\]\]/g, "$1")
        .replace(/[*_`~]/g, "");
      if (clean.length > 10) {
        return clean.length > 120 ? clean.slice(0, 117) + "…" : clean;
      }
    }
  }
  return "";
}

export default function MindMap({
  nodes,
  links,
  pages,
  activeSlug,
  onSelect,
  onNavigate,
}: MindMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [maxDepth, setMaxDepth] = useState(3);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build adjacency map once
  const adj = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const n of nodes) map.set(n.id, new Set());
    for (const l of links) {
      const src = typeof l.source === "string" ? l.source : l.source;
      const tgt = typeof l.target === "string" ? l.target : l.target;
      map.get(src)?.add(tgt);
      map.get(tgt)?.add(src);
    }
    return map;
  }, [nodes, links]);

  // Build tree from active node
  const treeData = useMemo(() => {
    const centerSlug = activeSlug || (nodes.length > 0 ? nodes[0].id : null);
    if (!centerSlug) return null;

    const centerNode = nodes.find((n) => n.id === centerSlug);
    if (!centerNode) return null;

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const visited = new Set<string>();

    function buildTree(id: string, depth: number): TreeNode {
      visited.add(id);
      const node = nodeMap.get(id)!;
      const children: TreeNode[] = [];

      if (depth < maxDepth) {
        const neighbors = adj.get(id) || new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            children.push(buildTree(neighbor, depth + 1));
          }
        }
        children.sort((a, b) => b.children.length - a.children.length);
      }

      return {
        id,
        title: node.title,
        category: node.category,
        children,
        depth,
        totalDescendants: 0,
      };
    }

    const tree = buildTree(centerSlug, 0);
    countDescendants(tree);
    return tree;
  }, [nodes, adj, activeSlug, maxDepth]);

  // Page lookup for hover preview
  const pageMap = useMemo(() => {
    const map = new Map<string, WikiPage>();
    for (const p of pages) map.set(p.slug, p);
    return map;
  }, [pages]);

  // Hovered page info
  const hoveredPage = useMemo(() => {
    if (!hoveredNode) return null;
    const page = pageMap.get(hoveredNode);
    if (!page) return null;
    const connectionCount = adj.get(hoveredNode)?.size || 0;
    const summary = extractSummary(page.content);
    const tags = Array.isArray(page.frontmatter.tags)
      ? (page.frontmatter.tags as string[])
      : [];
    return { title: page.title, category: page.category, summary, tags, connectionCount };
  }, [hoveredNode, pageMap, adj]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      // Single click vs double click
      if (clickTimerRef.current) {
        // Double click — navigate to read mode
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
        onNavigate(nodeId);
      } else {
        // Wait for potential double click
        clickTimerRef.current = setTimeout(() => {
          clickTimerRef.current = null;
          onSelect(nodeId);
        }, 250);
      }
    },
    [onSelect, onNavigate]
  );

  const render = useCallback(() => {
    if (!svgRef.current || !treeData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svgRef.current.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr(
          "transform",
          `translate(${width / 2 + event.transform.x},${height / 2 + event.transform.y}) scale(${event.transform.k})`
        );
      });
    (svg as d3.Selection<SVGSVGElement, unknown, null, undefined>).call(
      zoom as unknown as (
        sel: d3.Selection<SVGSVGElement, unknown, null, undefined>
      ) => void
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
      .linkRadial<
        d3.HierarchyPointLink<TreeNode>,
        d3.HierarchyPointNode<TreeNode>
      >()
      .angle((d) => d.x)
      .radius((d) => d.y);

    // Draw links with gradient animation
    const linkGroup = g.append("g");
    root.links().forEach((link, i) => {
      const sourceColor =
        CATEGORY_COLORS[link.source.data.category] || "#3b82f6";

      const gradientId = `mindmap-grad-${i}`;
      svg
        .append("defs")
        .append("linearGradient")
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
        .attr(
          "d",
          linkGen(
            link as unknown as d3.HierarchyPointLink<TreeNode>
          )
        )
        .attr("fill", "none")
        .attr("stroke", `url(#${gradientId})`)
        .attr("stroke-width", 2)
        .attr("opacity", 0)
        .transition()
        .delay(i * 30)
        .duration(600)
        .attr("opacity", 1);
    });

    const light = isLightTheme();

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
      .on("click", (_, d) => handleNodeClick(d.data.id))
      .on("mouseenter", (_, d) => setHoveredNode(d.data.id))
      .on("mouseleave", () => setHoveredNode(null));

    // Node glow
    nodeGroup
      .append("circle")
      .attr("r", (d) => (d.depth === 0 ? 24 : 16 - d.depth * 3))
      .attr("fill", (d) => CATEGORY_COLORS[d.data.category] || "#3b82f6")
      .attr("opacity", 0.12)
      .attr("filter", "blur(4px)");

    // Node core
    nodeGroup
      .append("circle")
      .attr("r", (d) => (d.depth === 0 ? 14 : 8 - d.depth))
      .attr("fill", (d) => CATEGORY_COLORS[d.data.category] || "#3b82f6")
      .attr("stroke", (d) =>
        d.data.id === activeSlug
          ? light
            ? "#2c2825"
            : "#fff"
          : "transparent"
      )
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

    // Labels
    nodeGroup
      .append("text")
      .attr("dy", (d) => (d.depth === 0 ? -22 : -14))
      .attr("text-anchor", "middle")
      .attr("font-size", (d) =>
        d.depth === 0 ? "13px" : `${12 - d.depth}px`
      )
      .attr("fill", (d) =>
        d.depth === 0
          ? light
            ? "#2c2825"
            : "#e8eaed"
          : light
            ? "#5c5550"
            : "#9aa0b0"
      )
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

    // Connection count badges (for nodes with children or hidden neighbors)
    nodeGroup
      .filter((d) => {
        const neighborCount = adj.get(d.data.id)?.size || 0;
        return neighborCount > 1 && d.depth > 0;
      })
      .append("text")
      .attr("dx", (d) => {
        const r = 8 - d.depth;
        return r + 4;
      })
      .attr("dy", 4)
      .attr("font-size", "9px")
      .attr("fill", light ? "#8a837c" : "#6e6963")
      .attr("font-weight", "500")
      .text((d) => {
        const count = adj.get(d.data.id)?.size || 0;
        return `·${count}`;
      })
      .attr("opacity", 0)
      .transition()
      .delay((_, i) => i * 40 + 300)
      .duration(400)
      .attr("opacity", 1);
  }, [treeData, activeSlug, handleNodeClick, adj]);

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
        <div className="text-sm font-medium text-text-primary">
          {treeData.title}
        </div>
        <div className="text-xs text-text-tertiary mt-1">
          {treeData.children.length} 个直接关联 · {treeData.totalDescendants} 个节点
        </div>
      </div>

      {/* Depth control */}
      <div className="absolute top-4 right-4 bg-bg-primary/80 backdrop-blur-md border border-border-primary rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-xs text-text-tertiary">层深</span>
        <input
          type="range"
          min={1}
          max={5}
          value={maxDepth}
          onChange={(e) => setMaxDepth(Number(e.target.value))}
          className="w-20 h-1 accent-accent-vivid cursor-pointer"
        />
        <span className="text-xs text-text-primary font-mono w-3 text-center">
          {maxDepth}
        </span>
      </div>

      {/* Hover preview card */}
      {hoveredPage && (
        <div className="absolute bottom-4 left-4 bg-bg-primary/90 backdrop-blur-md border border-border-primary rounded-xl px-4 py-3 max-w-sm animate-fade-in">
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background:
                  CATEGORY_COLORS[hoveredPage.category] || "#3b82f6",
              }}
            />
            <span className="text-sm font-medium text-text-primary truncate">
              {hoveredPage.title}
            </span>
            <span className="text-xs text-text-tertiary shrink-0">
              {hoveredPage.connectionCount} 关联
            </span>
          </div>
          {hoveredPage.summary && (
            <p className="text-xs text-text-secondary leading-relaxed mb-1.5">
              {hoveredPage.summary}
            </p>
          )}
          {hoveredPage.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hoveredPage.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div className="text-[10px] text-text-tertiary mt-2 opacity-60">
            单击切换中心 · 双击打开阅读
          </div>
        </div>
      )}

      {/* Help (only show when no hover card) */}
      {!hoveredPage && (
        <div className="absolute bottom-4 right-4 text-xs text-text-tertiary bg-bg-primary/80 backdrop-blur-md border border-border-primary rounded-xl px-3 py-2">
          单击切换中心 · 双击阅读 · 滚轮缩放
        </div>
      )}
    </div>
  );
}
