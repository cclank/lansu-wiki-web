"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import type { WikiPage } from "@/lib/github";
import type { Components } from "react-markdown";
import MermaidBlock from "./MermaidBlock";

interface MarkdownContentProps {
  page: WikiPage;
  owner: string;
  repo: string;
  onNavigate: (slug: string) => void;
  slugByName: Map<string, string>;
}

function resolveRelativeUrl(
  href: string,
  pagePath: string,
  owner: string,
  repo: string
): string {
  // Already absolute
  if (/^https?:\/\//.test(href) || href.startsWith("//")) return href;
  // Anchor-only
  if (href.startsWith("#")) return href;

  // Resolve relative to current page's directory
  const pageDir = pagePath.includes("/")
    ? pagePath.slice(0, pagePath.lastIndexOf("/"))
    : "";

  let resolved = href;
  if (href.startsWith("./")) {
    resolved = pageDir ? `${pageDir}/${href.slice(2)}` : href.slice(2);
  } else if (href.startsWith("../")) {
    const parts = pageDir.split("/");
    let h = href;
    while (h.startsWith("../") && parts.length > 0) {
      parts.pop();
      h = h.slice(3);
    }
    resolved = parts.length > 0 ? `${parts.join("/")}/${h}` : h;
  } else if (!href.startsWith("/")) {
    resolved = pageDir ? `${pageDir}/${href}` : href;
  }

  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${resolved}`;
}

// Detect ASCII diagram content (arrows, box-drawing characters)
const ASCII_DIAGRAM_CHARS = /[┌┐└┘├┤┬┴┼─│▼▲►◄↓↑→←╔╗╚╝║═]/;
const ARROW_PATTERN = /[→←↓↑▼▲│┌└├┤]/;

function isAsciiDiagram(code: string): boolean {
  const lines = code.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return false;
  // At least 20% of lines should contain diagram chars
  const diagramLines = lines.filter(
    (l) => ASCII_DIAGRAM_CHARS.test(l) || ARROW_PATTERN.test(l)
  );
  return diagramLines.length / lines.length >= 0.2;
}

export default function MarkdownContent({
  page,
  owner,
  repo,
  onNavigate,
  slugByName,
}: MarkdownContentProps) {
  // Replace [[wiki-links]] with clickable links
  const processedContent = page.content.replace(
    /\[\[([^\]]+)\]\]/g,
    (_, linkName: string) => {
      const slug = slugByName.get(linkName.toLowerCase());
      if (slug) {
        return `[${linkName}](#wiki:${slug})`;
      }
      return `\`${linkName}\``;
    }
  );

  const components: Components = {
    script: () => null,
    a: ({ href, children }) => {
      if (href?.startsWith("#wiki:")) {
        const targetSlug = href.replace("#wiki:", "");
        return (
          <button
            onClick={() => onNavigate(targetSlug)}
            className="text-text-link hover:brightness-125 transition-colors cursor-pointer bg-transparent p-0 inline"
          >
            {children}
          </button>
        );
      }
      // Internal .md link — navigate within wiki
      if (href && !href.startsWith("http") && !href.startsWith("#") && href.endsWith(".md")) {
        const pageDir = page.path.includes("/")
          ? page.path.slice(0, page.path.lastIndexOf("/"))
          : "";
        let resolved = href;
        if (href.startsWith("./")) resolved = pageDir ? `${pageDir}/${href.slice(2)}` : href.slice(2);
        else if (!href.startsWith("/") && !href.startsWith("..")) resolved = pageDir ? `${pageDir}/${href}` : href;
        const slug = resolved.replace(/\.md$/, "").replace(/\//g, "__");
        if (slugByName.has(resolved.replace(/\.md$/, "").split("/").pop()!.toLowerCase()) || true) {
          return (
            <button
              onClick={() => onNavigate(slug)}
              className="text-text-link hover:brightness-125 transition-colors cursor-pointer bg-transparent p-0 inline"
            >
              {children}
            </button>
          );
        }
      }
      // Anchor link
      if (href?.startsWith("#")) {
        return <a href={href}>{children}</a>;
      }
      return (
        <a href={href ?? undefined} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
    img: ({ src, alt }) => {
      const resolved = typeof src === "string" ? resolveRelativeUrl(src, page.path, owner, repo) : "";
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolved} alt={alt || ""} loading="lazy" />
      );
    },
    pre: ({ children, ...props }) => {
      // Extract code element and its props
      const codeChild = children as React.ReactElement<{
        className?: string;
        children?: string;
      }>;
      if (codeChild?.props) {
        const className = codeChild.props.className || "";
        const code =
          typeof codeChild.props.children === "string"
            ? codeChild.props.children
            : "";

        // Mermaid block
        if (className.includes("language-mermaid")) {
          return <MermaidBlock code={code} />;
        }

        // ASCII diagram detection for text/plain blocks
        if (
          (className.includes("language-text") ||
            className === "" ||
            !className) &&
          code &&
          isAsciiDiagram(code)
        ) {
          return (
            <div className="diagram-block ascii-diagram">
              <div className="diagram-label">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                Architecture Diagram
              </div>
              <pre className="ascii-diagram-pre">
                <code>{code}</code>
              </pre>
            </div>
          );
        }
      }

      return <pre {...props}>{children}</pre>;
    },
  };

  return (
    <div className="animate-fade-in">
      {/* Frontmatter badges */}
      {page.frontmatter && Object.keys(page.frontmatter).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {page.frontmatter.type != null && (
            <span className="px-2.5 py-1 bg-accent-purple/10 text-accent-purple border border-accent-purple/20 rounded-md text-xs font-medium">
              {String(page.frontmatter.type)}
            </span>
          )}
          {page.frontmatter.created != null && (
            <span className="px-2.5 py-1 bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20 rounded-md text-xs font-medium">
              {"创建: " + String(page.frontmatter.created)}
            </span>
          )}
          {page.frontmatter.updated != null && (
            <span className="px-2.5 py-1 bg-accent-amber/10 text-accent-amber border border-accent-amber/20 rounded-md text-xs font-medium">
              {"更新: " + String(page.frontmatter.updated)}
            </span>
          )}
          {Array.isArray(page.frontmatter.tags) &&
            (page.frontmatter.tags as string[]).map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 bg-bg-tertiary text-text-tertiary border border-border-primary rounded-md text-xs"
              >
                {"#" + tag}
              </span>
            ))}
        </div>
      )}

      {/* Markdown content */}
      <div className="wiki-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeSlug]}
          components={components}
        >
          {processedContent}
        </ReactMarkdown>
      </div>

      {/* Outgoing links */}
      {page.links.length > 0 && (
        <div className="mt-10 pt-6 border-t border-border-primary">
          <h4 className="text-sm font-medium text-text-tertiary mb-3">
            {"相关页面 (" + page.links.length + ")"}
          </h4>
          <div className="flex flex-wrap gap-2">
            {[...new Set(page.links)].map((link) => {
              const targetSlug = slugByName.get(link);
              return (
                <button
                  key={link}
                  onClick={() => targetSlug && onNavigate(targetSlug)}
                  disabled={!targetSlug}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    targetSlug
                      ? "bg-accent-blue/5 text-accent-blue border-accent-blue/20 hover:bg-accent-blue/10 cursor-pointer"
                      : "bg-bg-tertiary text-text-tertiary border-border-primary cursor-default"
                  }`}
                >
                  {link}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
