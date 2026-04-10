"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as d3 from "d3";
import type { GraphNode, GraphLink } from "@/lib/github";

interface RelationGraphProps {
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

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  category: string;
  linkCount: number;
}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
}

export default function RelationGraph({
  nodes,
  links,
  activeSlug,
  onSelect,
}: RelationGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const transformRef = useRef(d3.zoomIdentity);
  const frameRef = useRef(0);
  const animFrameRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    frameRef.current++;
    const frame = frameRef.current;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const t = transformRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // Subtle dot grid background
    const gridSize = 30;
    ctx.fillStyle = "rgba(55, 65, 81, 0.15)";
    for (let gx = gridSize; gx < width; gx += gridSize) {
      for (let gy = gridSize; gy < height; gy += gridSize) {
        ctx.beginPath();
        ctx.arc(gx, gy, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    const simNodes = nodesRef.current;
    const simLinks = linksRef.current;
    const highlightedId = hovered || activeSlug;

    // Build neighbor set
    const neighbors = new Set<string>();
    const highlightLinks = new Set<number>();
    if (highlightedId) {
      neighbors.add(highlightedId);
      simLinks.forEach((l, i) => {
        const src = (l.source as SimNode).id;
        const tgt = (l.target as SimNode).id;
        if (src === highlightedId || tgt === highlightedId) {
          neighbors.add(src);
          neighbors.add(tgt);
          highlightLinks.add(i);
        }
      });
    }

    // Draw links
    simLinks.forEach((l, i) => {
      const src = l.source as SimNode;
      const tgt = l.target as SimNode;
      if (src.x == null || tgt.x == null) return;

      const isHighlight = highlightLinks.has(i);

      if (isHighlight) {
        const color = CATEGORY_COLORS[src.category] || "#3b82f6";

        // Glow line
        ctx.beginPath();
        ctx.moveTo(src.x, src.y!);
        ctx.lineTo(tgt.x, tgt.y!);
        ctx.strokeStyle = color + "30";
        ctx.lineWidth = 6;
        ctx.stroke();

        // Gradient line
        const grad = ctx.createLinearGradient(src.x, src.y!, tgt.x, tgt.y!);
        grad.addColorStop(0, color);
        grad.addColorStop(1, color + "60");
        ctx.beginPath();
        ctx.moveTo(src.x, src.y!);
        ctx.lineTo(tgt.x, tgt.y!);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Animated particle along the link
        const progress = ((frame * 2 + i * 37) % 200) / 200;
        const px = src.x + (tgt.x - src.x) * progress;
        const py = src.y! + (tgt.y! - src.y!) * progress;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Second particle offset
        const p2 = ((frame * 2 + i * 37 + 100) % 200) / 200;
        const px2 = src.x + (tgt.x - src.x) * p2;
        const py2 = src.y! + (tgt.y! - src.y!) * p2;
        ctx.beginPath();
        ctx.arc(px2, py2, 2, 0, Math.PI * 2);
        ctx.fillStyle = color + "80";
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(src.x, src.y!);
        ctx.lineTo(tgt.x, tgt.y!);
        ctx.strokeStyle = highlightedId
          ? "rgba(55, 65, 81, 0.08)"
          : "rgba(55, 65, 81, 0.2)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    });

    // Draw nodes
    simNodes.forEach((node) => {
      if (node.x == null || node.y == null) return;

      const color = CATEGORY_COLORS[node.category] || "#3b82f6";
      const isActive = node.id === activeSlug;
      const isHover = node.id === hovered;
      const isNeighbor = neighbors.has(node.id);
      const dimmed = highlightedId && !isNeighbor;
      const radius = 5 + Math.min(node.linkCount * 1.2, 10);

      // Outer glow for active/hover
      if (isActive || isHover) {
        const pulseR = radius + 10 + Math.sin(frame * 0.06) * 4;
        const glowGrad = ctx.createRadialGradient(
          node.x, node.y, radius,
          node.x, node.y, pulseR
        );
        glowGrad.addColorStop(0, color + "40");
        glowGrad.addColorStop(1, color + "00");
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseR, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
      }

      // Circle with gradient fill
      const nodeGrad = ctx.createRadialGradient(
        node.x - radius * 0.3, node.y - radius * 0.3, 0,
        node.x, node.y, radius
      );
      if (dimmed) {
        nodeGrad.addColorStop(0, color + "40");
        nodeGrad.addColorStop(1, color + "20");
      } else {
        nodeGrad.addColorStop(0, color);
        nodeGrad.addColorStop(1, color + "cc");
      }
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = nodeGrad;
      ctx.fill();

      // Ring for active
      if (isActive) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isHover) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Label
      const fontSize = isHover || isActive ? 13 : t.k > 0.5 ? 11 : t.k > 0.35 ? 9 : 0;
      if (fontSize > 0) {
        const label =
          node.title.length > 24 ? node.title.slice(0, 22) + "…" : node.title;
        ctx.font = `${isActive || isHover ? "600" : "400"} ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // Text shadow for readability
        if (!dimmed) {
          ctx.fillStyle = "rgba(10, 11, 14, 0.7)";
          ctx.fillText(label, node.x + 0.5, node.y + radius + 5.5);
        }

        ctx.fillStyle = dimmed
          ? "rgba(154, 160, 176, 0.2)"
          : isActive || isHover
            ? "#e8eaed"
            : "rgba(154, 160, 176, 0.8)";
        ctx.fillText(label, node.x, node.y + radius + 5);
      }
    });

    // Hover tooltip card
    if (hovered) {
      const node = simNodes.find((n) => n.id === hovered);
      if (node && node.x != null && node.y != null) {
        const color = CATEGORY_COLORS[node.category] || "#3b82f6";
        const title = node.title;
        const sub = `${node.category} · ${node.linkCount} 条链接`;
        ctx.font = "600 13px system-ui, sans-serif";
        const tw = ctx.measureText(title).width;
        ctx.font = "400 11px system-ui, sans-serif";
        const sw = ctx.measureText(sub).width;
        const boxW = Math.max(tw, sw) + 28;
        const boxH = 52;
        const bx = node.x - boxW / 2;
        const by = node.y - 24 - boxH;

        // Shadow
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "rgba(10, 11, 14, 0.94)";
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 10);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Top color accent bar
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, 3, [10, 10, 0, 0]);
        ctx.fill();

        // Border
        ctx.strokeStyle = "rgba(55, 65, 81, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 10);
        ctx.stroke();

        // Text
        ctx.font = "600 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#e8eaed";
        ctx.fillText(title, node.x, by + 18);
        ctx.font = "400 11px system-ui, sans-serif";
        ctx.fillStyle = "#9aa0b0";
        ctx.fillText(sub, node.x, by + 35);
      }
    }

    ctx.restore();
  }, [activeSlug, hovered]);

  // Animation loop for particles
  useEffect(() => {
    let running = true;
    function animate() {
      if (!running) return;
      draw();
      animFrameRef.current = requestAnimationFrame(animate);
    }
    // Only animate when something is highlighted
    if (hovered || activeSlug) {
      animate();
    } else {
      draw();
    }
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw, hovered, activeSlug]);

  // Init simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const container = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = links.map((l) => ({
      source: l.source,
      target: l.target,
    }));

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    // --- Phase 1: Run simulation silently until stable ---
    const sim = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(120)
          .strength(0.4)
      )
      .force("charge", d3.forceManyBody().strength(-200).distanceMax(400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(45))
      .alphaDecay(0.03)
      .velocityDecay(0.55)
      .stop(); // Don't auto-run — we tick manually

    // Pre-compute layout (300 ticks is plenty to stabilize)
    for (let i = 0; i < 300; i++) sim.tick();

    // Fix all nodes in place so they don't drift
    for (const n of simNodes) {
      n.fx = n.x;
      n.fy = n.y;
    }

    simRef.current = sim;

    // --- Phase 2: Compute zoom-to-fit transform ---
    const padding = 60;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of simNodes) {
      if (n.x != null && n.y != null) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x);
        maxY = Math.max(maxY, n.y);
      }
    }
    const gw = maxX - minX + padding * 2;
    const gh = maxY - minY + padding * 2;
    const fitScale = Math.min(width / gw, height / gh, 1.5);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const fitTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(fitScale)
      .translate(-cx, -cy);
    transformRef.current = fitTransform;

    // --- Phase 3: Set up zoom ---
    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.15, 4])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        draw();
      });

    const sel = d3.select(canvas);
    (sel as d3.Selection<HTMLCanvasElement, unknown, null, undefined>).call(
      zoom as unknown as (
        s: d3.Selection<HTMLCanvasElement, unknown, null, undefined>
      ) => void
    );
    // Apply initial transform
    (sel as d3.Selection<HTMLCanvasElement, unknown, null, undefined>).call(
      (zoom as unknown as d3.ZoomBehavior<HTMLCanvasElement, unknown>).transform,
      fitTransform
    );

    // Draw once immediately
    draw();

    // Mouse interactions
    function getNodeAtPos(mx: number, my: number): SimNode | null {
      const t = transformRef.current;
      const x = (mx - t.x) / t.k;
      const y = (my - t.y) / t.k;
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        if (n.x == null || n.y == null) continue;
        const r = 5 + Math.min(n.linkCount * 1.2, 10) + 6;
        if ((n.x - x) ** 2 + (n.y! - y) ** 2 < r * r) return n;
      }
      return null;
    }

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAtPos(e.clientX - rect.left, e.clientY - rect.top);
      setHovered(node?.id ?? null);
      canvas.style.cursor = node ? "pointer" : "grab";
    });

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAtPos(e.clientX - rect.left, e.clientY - rect.top);
      if (node) onSelect(node.id);
    });

    function handleResize() {
      if (!canvas) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      draw();
    }
    window.addEventListener("resize", handleResize);

    return () => {
      sim.stop();
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [nodes, links, onSelect, draw]);

  return (
    <div className="relative w-full h-full min-h-[500px] bg-bg-primary rounded-xl border border-border-primary overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-bg-primary/80 backdrop-blur-md border border-border-primary rounded-xl p-3 space-y-1.5">
        {Object.entries(CATEGORY_COLORS)
          .filter(([cat]) => nodes.some((n) => n.category === cat))
          .map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-2 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
              />
              <span className="text-text-secondary">{cat}</span>
            </div>
          ))}
      </div>

      {/* Hint */}
      <div className="absolute top-4 right-4 bg-bg-primary/80 backdrop-blur-md border border-border-primary rounded-xl px-3 py-2 text-xs text-text-tertiary">
        悬停高亮关联 · 点击跳转 · 滚轮缩放
      </div>
    </div>
  );
}
