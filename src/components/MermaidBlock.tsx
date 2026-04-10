"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidBlockProps {
  code: string;
}

export default function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            darkMode: true,
            background: "#12141a",
            primaryColor: "#3b82f6",
            primaryTextColor: "#e8eaed",
            primaryBorderColor: "#374151",
            secondaryColor: "#8b5cf6",
            tertiaryColor: "#1a1d26",
            lineColor: "#6b7280",
            textColor: "#e8eaed",
            mainBkg: "#1a1d26",
            nodeBorder: "#3b82f6",
            clusterBkg: "#12141a",
            clusterBorder: "#374151",
            titleColor: "#e8eaed",
            edgeLabelBackground: "#12141a",
            nodeTextColor: "#e8eaed",
          },
          flowchart: { curve: "basis", padding: 15 },
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: 14,
        });

        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: result } = await mermaid.render(id, code.trim());
        if (!cancelled) {
          setSvg(result);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Mermaid render error");
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    // Fallback to plain code block
    return (
      <pre className="diagram-block">
        <code>{code}</code>
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="diagram-block flex items-center justify-center py-8">
        <div className="skeleton w-48 h-4" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="diagram-block mermaid-rendered"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
