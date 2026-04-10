"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as d3 from "d3";
import type { GraphNode, GraphLink } from "@/lib/github";

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

const CAT_COLORS: Record<string, string> = {
  root: "#f59e0b",
  concepts: "#7c8eff",
  entities: "#c084fc",
  changelog: "#4ade80",
  guides: "#60a5fa",
  docs: "#60a5fa",
  api: "#fb7185",
};

interface SNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  category: string;
  linkCount: number;
}
interface SLink extends d3.SimulationLinkDatum<SNode> {
  source: SNode | string;
  target: SNode | string;
}

export default function ObsidianGraph({ nodes, links, activeSlug, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const activeRef = useRef<string | null>(activeSlug);
  const nodesRef = useRef<SNode[]>([]);
  const linksRef = useRef<SLink[]>([]);
  const simRef = useRef<d3.Simulation<SNode, SLink> | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const rafRef = useRef(0);
  const dragNodeRef = useRef<SNode | null>(null);

  activeRef.current = activeSlug;
  hoveredRef.current = hovered;

  // Continuous draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const t = transformRef.current;
    const hl = hoveredRef.current || activeRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    const sNodes = nodesRef.current;
    const sLinks = linksRef.current;

    // Build neighbor set
    const nb = new Set<string>();
    const hlLinks = new Set<number>();
    if (hl) {
      nb.add(hl);
      sLinks.forEach((l, i) => {
        const s = (l.source as SNode).id;
        const tg = (l.target as SNode).id;
        if (s === hl || tg === hl) { nb.add(s); nb.add(tg); hlLinks.add(i); }
      });
    }

    // --- Links ---
    sLinks.forEach((l, i) => {
      const s = l.source as SNode;
      const tg = l.target as SNode;
      if (s.x == null || tg.x == null) return;
      const lit = hlLinks.has(i);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y!);
      ctx.lineTo(tg.x, tg.y!);
      if (lit) {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
        ctx.lineWidth = 1.5 / t.k;
      } else {
        ctx.strokeStyle = hl ? "rgba(71, 85, 105, 0.08)" : "rgba(71, 85, 105, 0.18)";
        ctx.lineWidth = 0.7 / t.k;
      }
      ctx.stroke();
    });

    // --- Nodes ---
    const baseFontSize = 11;
    sNodes.forEach((n) => {
      if (n.x == null || n.y == null) return;
      const color = CAT_COLORS[n.category] || "#7c8eff";
      const isActive = n.id === activeRef.current;
      const isHover = n.id === hoveredRef.current;
      const inNb = nb.has(n.id);
      const dim = hl && !inNb;
      const r = (4 + Math.min(n.linkCount * 0.8, 6)) / t.k;

      // Soft glow for hover/active
      if (isHover || isActive) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color + "18";
        ctx.fill();
      }

      // Node dot
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = dim ? color + "25" : color + (isHover || isActive ? "ff" : "bb");
      ctx.fill();

      // Active ring
      if (isActive) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 2 / t.k, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff88";
        ctx.lineWidth = 1.2 / t.k;
        ctx.stroke();
      }

      // Label
      const fs = (isHover || isActive ? baseFontSize + 1 : baseFontSize) / t.k;
      if (fs * t.k > 4) { // only show if readable
        ctx.font = `${isHover || isActive ? 600 : 400} ${fs}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label = n.title.length > 28 ? n.title.slice(0, 26) + "…" : n.title;
        const ly = n.y + r + 3 / t.k;

        // Text bg for readability
        if (inNb || !hl) {
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = "rgba(10, 11, 14, 0.55)";
          ctx.fillRect(n.x - tw / 2 - 2 / t.k, ly - 1 / t.k, tw + 4 / t.k, fs + 3 / t.k);
        }

        ctx.fillStyle = dim ? "rgba(148, 163, 184, 0.15)" :
                         (isHover || isActive) ? "#e2e8f0" : "rgba(148, 163, 184, 0.7)";
        ctx.fillText(label, n.x, ly);
      }
    });

    ctx.restore();
  }, []);

  // Animation loop
  useEffect(() => {
    let running = true;
    function loop() {
      if (!running) return;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }
    loop();
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [draw]);

  // Simulation setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const container = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth;
    const H = container.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const sNodes: SNode[] = nodes.map((n) => ({ ...n }));
    const sLinks: SLink[] = links.map((l) => ({ source: l.source, target: l.target }));
    nodesRef.current = sNodes;
    linksRef.current = sLinks;

    // Obsidian-like gentle physics
    const sim = d3.forceSimulation(sNodes)
      .force("link", d3.forceLink<SNode, SLink>(sLinks).id(d => d.id).distance(90).strength(0.3))
      .force("charge", d3.forceManyBody().strength(-120).distanceMax(350))
      .force("center", d3.forceCenter(W / 2, H / 2).strength(0.05))
      .force("collision", d3.forceCollide().radius(25))
      .alphaDecay(0.015)
      .velocityDecay(0.4)
      .alphaMin(0.005); // Keep a tiny bit of life

    simRef.current = sim;

    // Zoom + pan
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 6])
      .on("zoom", (e) => { transformRef.current = e.transform; });

    const sel = d3.select(canvas);
    (sel as d3.Selection<HTMLCanvasElement, unknown, null, undefined>).call(
      zoom as unknown as (s: d3.Selection<HTMLCanvasElement, unknown, null, undefined>) => void
    );

    // Auto-fit after initial settling
    setTimeout(() => {
      const pad = 50;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of sNodes) {
        if (n.x != null && n.y != null) {
          x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y);
          x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y);
        }
      }
      if (x0 < Infinity) {
        const gw = x1 - x0 + pad * 2;
        const gh = y1 - y0 + pad * 2;
        const s = Math.min(W / gw, H / gh, 1.8);
        const tx = d3.zoomIdentity
          .translate(W / 2, H / 2).scale(s).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
        (sel as d3.Selection<HTMLCanvasElement, unknown, null, undefined>)
          .transition().duration(600)
          .call((zoom as unknown as d3.ZoomBehavior<HTMLCanvasElement, unknown>).transform, tx);
      }
    }, 1500);

    // Hit test
    function nodeAt(mx: number, my: number): SNode | null {
      const t = transformRef.current;
      const x = (mx - t.x) / t.k;
      const y = (my - t.y) / t.k;
      for (let i = sNodes.length - 1; i >= 0; i--) {
        const n = sNodes[i];
        if (n.x == null || n.y == null) continue;
        const r = (4 + Math.min(n.linkCount * 0.8, 6)) / t.k + 8 / t.k;
        if ((n.x - x) ** 2 + (n.y! - y) ** 2 < r * r) return n;
      }
      return null;
    }

    // Hover
    canvas.addEventListener("mousemove", (e) => {
      if (dragNodeRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
      setHovered(n?.id ?? null);
      canvas.style.cursor = n ? "pointer" : "default";
    });

    // Click
    canvas.addEventListener("click", (e) => {
      if (dragNodeRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (n) onSelect(n.id);
    });

    // Drag nodes (Obsidian-style: drag to reposition)
    let dragStarted = false;
    canvas.addEventListener("mousedown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (n) {
        dragNodeRef.current = n;
        dragStarted = false;
        n.fx = n.x;
        n.fy = n.y;
        sim.alphaTarget(0.1).restart();
        e.stopPropagation();
      }
    });
    canvas.addEventListener("mousemove", (e) => {
      const n = dragNodeRef.current;
      if (!n) return;
      dragStarted = true;
      const t = transformRef.current;
      const rect = canvas.getBoundingClientRect();
      n.fx = (e.clientX - rect.left - t.x) / t.k;
      n.fy = (e.clientY - rect.top - t.y) / t.k;
      canvas.style.cursor = "grabbing";
    });
    function endDrag() {
      const n = dragNodeRef.current;
      if (n) {
        n.fx = null;
        n.fy = null;
        sim.alphaTarget(0);
        dragNodeRef.current = null;
      }
    }
    canvas.addEventListener("mouseup", (e) => {
      if (dragStarted) {
        e.stopPropagation();
        e.preventDefault();
      }
      endDrag();
    });
    canvas.addEventListener("mouseleave", endDrag);

    // Resize
    function onResize() {
      if (!canvas) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    window.addEventListener("resize", onResize);

    return () => {
      sim.stop();
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [nodes, links, onSelect, draw]);

  return (
    <div className="relative w-full h-full min-h-[500px] bg-bg-primary overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-bg-primary/70 backdrop-blur border border-border-primary rounded-lg p-2.5 space-y-1">
        {Object.entries(CAT_COLORS)
          .filter(([c]) => nodes.some((n) => n.category === c))
          .map(([c, color]) => (
            <div key={c} className="flex items-center gap-2 text-[11px]">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-text-tertiary">{c}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
