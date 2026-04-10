"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { GraphNode, GraphLink } from "@/lib/github";

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  root: "#f59e0b",
  concepts: "#06b6d4",
  entities: "#8b5cf6",
  changelog: "#10b981",
  guides: "#3b82f6",
  docs: "#3b82f6",
  api: "#f43f5e",
};

export default function KnowledgeGraph({
  nodes,
  links,
  activeSlug,
  onSelect,
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const render = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svgRef.current?.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr("width", width).attr("height", height);

    const g = svg.append("g");

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom as unknown as (selection: d3.Selection<SVGSVGElement | null, unknown, null, undefined>) => void);

    // Simulation
    interface SimNode extends d3.SimulationNodeDatum, GraphNode {}
    interface SimLink extends d3.SimulationLinkDatum<SimNode> {
      source: SimNode | string;
      target: SimNode | string;
    }

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = links.map((l) => ({
      source: l.source,
      target: l.target,
    }));

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Links
    const link = g
      .append("g")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("class", "graph-link")
      .attr("stroke-width", 1);

    // Nodes
    const node = g
      .append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .attr("class", "graph-node")
      .on("click", (_, d) => onSelect(d.id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(node as any).call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node
      .append("circle")
      .attr("r", (d) => 6 + Math.min(d.linkCount * 2, 10))
      .attr("fill", (d) => CATEGORY_COLORS[d.category] || "#3b82f6")
      .attr("opacity", (d) => (d.id === activeSlug ? 1 : 0.7))
      .attr("stroke", (d) =>
        d.id === activeSlug ? "#fff" : "transparent"
      )
      .attr("stroke-width", 2);

    node
      .append("text")
      .attr("class", "graph-label")
      .attr("dy", (d) => -(10 + Math.min(d.linkCount * 2, 10)))
      .attr("text-anchor", "middle")
      .text((d) => {
        const t = d.title;
        return t.length > 20 ? t.slice(0, 18) + "…" : t;
      })
      .attr("fill", (d) => (d.id === activeSlug ? "#e8eaed" : "#9aa0b0"));

    // Tooltip
    node.append("title").text((d) => `${d.title}\n分类: ${d.category}\n链接: ${d.linkCount}`);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Cleanup
    return () => simulation.stop();
  }, [nodes, links, activeSlug, onSelect]);

  useEffect(() => {
    const cleanup = render();
    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => {
      cleanup?.();
      window.removeEventListener("resize", handleResize);
    };
  }, [render]);

  return (
    <div className="w-full h-full min-h-[400px] bg-bg-primary rounded-xl border border-border-primary overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
