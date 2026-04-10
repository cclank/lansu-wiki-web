"use client";

import { useEffect, useRef, useCallback } from "react";
import type { GraphNode, GraphLink } from "@/lib/github";

interface CosmosGraphProps {
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

export default function CosmosGraph({
  nodes,
  links,
  activeSlug,
  onSelect,
}: CosmosGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);

  const initGraph = useCallback(async () => {
    const container = containerRef.current;
    if (!container || nodes.length === 0) return;

    // Dynamic import for SSR safety
    const ForceGraph3DModule = await import("3d-force-graph");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ForceGraph3D = ForceGraph3DModule.default as any;
    const THREE = await import("three");

    // Clear previous
    if (graphRef.current) {
      graphRef.current._destructor?.();
      container.innerHTML = "";
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    const graphData = {
      nodes: nodes.map((n) => ({
        id: n.id,
        title: n.title,
        category: n.category,
        linkCount: n.linkCount,
        isActive: n.id === activeSlug,
      })),
      links: links.map((l) => ({ source: l.source, target: l.target })),
    };

    const graph = ForceGraph3D()(container)
      .width(width)
      .height(height)
      .graphData(graphData)
      .backgroundColor("#0a0b0e")
      // Node styling
      .nodeThreeObject((node: Record<string, unknown>) => {
        const category = node.category as string;
        const linkCount = node.linkCount as number;
        const isActive = node.isActive as boolean;
        const color = CATEGORY_COLORS[category] || "#3b82f6";
        const size = 3 + Math.min(linkCount * 1.5, 12);

        const group = new THREE.Group();

        // Core sphere
        const geometry = new THREE.SphereGeometry(size, 24, 24);
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(color),
          emissive: new THREE.Color(color),
          emissiveIntensity: isActive ? 0.8 : 0.3,
          transparent: true,
          opacity: isActive ? 1 : 0.85,
        });
        const sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);

        // Glow ring for active node
        if (isActive) {
          const ringGeo = new THREE.RingGeometry(size + 2, size + 4, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          group.add(ring);
        }

        // Outer glow sphere
        const glowGeo = new THREE.SphereGeometry(size * 1.6, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: isActive ? 0.15 : 0.06,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        group.add(glow);

        return group;
      })
      // Labels
      .nodeLabel(
        (node: Record<string, unknown>) =>
          `<div style="background:rgba(10,11,14,0.9);color:#e8eaed;padding:6px 12px;border-radius:8px;font-size:13px;border:1px solid #374151;backdrop-filter:blur(8px)">
            <strong>${node.title}</strong><br/>
            <span style="color:#9aa0b0;font-size:11px">${node.category} · ${node.linkCount} links</span>
          </div>`
      )
      // Link styling
      .linkColor(() => "rgba(100, 116, 139, 0.2)")
      .linkWidth(0.5)
      .linkDirectionalParticles(2)
      .linkDirectionalParticleWidth(1.5)
      .linkDirectionalParticleSpeed(0.005)
      .linkDirectionalParticleColor(
        (link: Record<string, unknown>) => {
          const sourceNode = link.source as Record<string, unknown>;
          const category = sourceNode?.category as string;
          return CATEGORY_COLORS[category] || "#3b82f6";
        }
      )
      // Interaction
      .onNodeClick((node: Record<string, unknown>) => {
        const id = node.id as string;
        onSelect(id);

        // Camera fly-to animation
        const distance = 120;
        const pos = node as { x?: number; y?: number; z?: number };
        const distRatio =
          1 +
          distance /
            Math.hypot(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);

        graph.cameraPosition(
          {
            x: (pos.x ?? 0) * distRatio,
            y: (pos.y ?? 0) * distRatio,
            z: (pos.z ?? 0) * distRatio,
          },
          { x: pos.x ?? 0, y: pos.y ?? 0, z: pos.z ?? 0 },
          1500
        );
      })
      .onNodeHover((node: Record<string, unknown> | null) => {
        container.style.cursor = node ? "pointer" : "default";
      })
      // Force config
      .d3AlphaDecay(0.02)
      .d3VelocityDecay(0.3);

    // Add lights
    const scene = graph.scene();
    const ambientLight = new THREE.AmbientLight(0x404060, 2);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x3b82f6, 1, 1000);
    pointLight.position.set(100, 100, 100);
    scene.add(pointLight);
    const pointLight2 = new THREE.PointLight(0x8b5cf6, 0.5, 1000);
    pointLight2.position.set(-100, -50, -100);
    scene.add(pointLight2);

    // Auto-rotate camera
    let angle = 0;
    const radius = 350;
    const controls = graph.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    graphRef.current = graph;

    // Fit to view after stabilization
    setTimeout(() => {
      graph.zoomToFit(1000, 50);
    }, 2000);

    return () => {
      graph._destructor?.();
    };
  }, [nodes, links, activeSlug, onSelect]);

  useEffect(() => {
    const cleanup = initGraph();
    return () => {
      cleanup?.then((fn) => fn?.());
    };
  }, [initGraph]);

  // Handle resize
  useEffect(() => {
    function handleResize() {
      if (graphRef.current && containerRef.current) {
        graphRef.current
          .width(containerRef.current.clientWidth)
          .height(containerRef.current.clientHeight);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-bg-primary/80 backdrop-blur-md border border-border-primary rounded-xl p-3 space-y-1.5">
        {Object.entries(CATEGORY_COLORS)
          .filter(([cat]) =>
            nodes.some((n) => n.category === cat)
          )
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

      {/* Controls hint */}
      <div className="absolute top-4 right-4 bg-bg-primary/80 backdrop-blur-md border border-border-primary rounded-xl px-3 py-2 text-xs text-text-tertiary space-y-0.5">
        <div>🖱 拖拽旋转</div>
        <div>🔍 滚轮缩放</div>
        <div>👆 点击节点飞入</div>
      </div>
    </div>
  );
}
