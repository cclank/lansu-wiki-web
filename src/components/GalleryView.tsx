"use client";

import { useState, useMemo } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import type { WikiData } from "@/lib/github";

interface GalleryViewProps {
  data: WikiData;
  onSelect: (slug: string) => void;
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

type SortKey = "title" | "words" | "links" | "category";

/** Extract h2 headings as topic keywords */
function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      const text = m[1]
        .replace(/[*_`~#]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim();
      if (text && text.length <= 40) headings.push(text);
    }
  }
  return headings;
}

/** Extract unique keywords from content: headings + wiki-links + tags */
function extractKeywords(
  content: string,
  links: string[],
  tags: string[],
): { headings: string[]; concepts: string[]; tags: string[] } {
  const headings = extractHeadings(content).slice(0, 6);

  // wiki-links as concepts (deduplicate against headings & tags)
  const headingSet = new Set(headings.map((h) => h.toLowerCase()));
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  const concepts = [...new Set(links)]
    .filter((l) => !headingSet.has(l.toLowerCase()) && !tagSet.has(l.toLowerCase()))
    .slice(0, 6);

  return { headings, concepts, tags };
}

export default function GalleryView({ data, onSelect }: GalleryViewProps) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("links");
  const [filterCat, setFilterCat] = useState<string | null>(null);

  // Connection counts
  const connectionMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const link of data.graph.links) {
      map.set(link.source, (map.get(link.source) || 0) + 1);
      map.set(link.target, (map.get(link.target) || 0) + 1);
    }
    return map;
  }, [data.graph.links]);

  // Cards data
  const cards = useMemo(() => {
    return data.pages.map((p) => {
      const rawTags = Array.isArray(p.frontmatter.tags)
        ? (p.frontmatter.tags as string[])
        : [];
      const kw = extractKeywords(p.content, p.links, rawTags);
      return {
        slug: p.slug,
        title: p.title,
        category: p.category,
        words: p.content.split(/\s+/).length,
        connections: connectionMap.get(p.slug) || 0,
        headings: kw.headings,
        concepts: kw.concepts,
        tags: kw.tags,
      };
    });
  }, [data.pages, connectionMap]);

  // Available categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const c of cards) cats.add(c.category);
    return [...cats].sort();
  }, [cards]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let result = cards;
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)) ||
          c.headings.some((h) => h.toLowerCase().includes(q)) ||
          c.concepts.some((l) => l.toLowerCase().includes(q))
      );
    }
    if (filterCat) {
      result = result.filter((c) => c.category === filterCat);
    }
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "words":
          return b.words - a.words;
        case "links":
          return b.connections - a.connections;
        case "category":
          return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
      }
    });
    return result;
  }, [cards, query, sortBy, filterCat]);

  return (
    <div className="p-6 overflow-y-auto h-full sidebar-scroll">
      <div className="max-w-6xl mx-auto">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Search */}
          <div className="flex items-center gap-2 bg-bg-secondary border border-border-primary rounded-lg px-3 py-2 flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索关键词、标签..."
              className="bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none w-full"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 bg-bg-secondary border border-border-primary rounded-lg px-2 py-1.5">
            <ArrowUpDown className="w-3 h-3 text-text-tertiary" />
            {(
              [
                { key: "links", label: "关联" },
                { key: "words", label: "字数" },
                { key: "title", label: "标题" },
                { key: "category", label: "分类" },
              ] as { key: SortKey; label: string }[]
            ).map((s) => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                  sortBy === s.key
                    ? "bg-accent-vivid/10 text-accent-vivid"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterCat(null)}
              className={`px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer border ${
                !filterCat
                  ? "border-accent-vivid/20 text-accent-vivid bg-accent-vivid/5"
                  : "border-transparent text-text-tertiary hover:text-text-secondary"
              }`}
            >
              全部
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(filterCat === cat ? null : cat)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer border ${
                  filterCat === cat
                    ? "border-border-secondary text-text-primary"
                    : "border-transparent text-text-tertiary hover:text-text-secondary"
                }`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: CATEGORY_COLORS[cat] || "#3b82f6" }}
                />
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs text-text-tertiary mb-4">
          {filtered.length} / {cards.length} 页
        </p>

        {/* Card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((card) => {
            const color = CATEGORY_COLORS[card.category] || "#3b82f6";
            const hasKeywords = card.headings.length > 0 || card.concepts.length > 0 || card.tags.length > 0;
            return (
              <button
                key={card.slug}
                onClick={() => onSelect(card.slug)}
                className="bg-bg-secondary border border-border-primary rounded-xl overflow-hidden hover:border-border-secondary transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer text-left group"
              >
                {/* Category color bar */}
                <div className="h-1" style={{ background: color }} />
                <div className="p-4">
                  {/* Title + category */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-sm font-medium text-text-primary group-hover:text-accent-vivid transition-colors line-clamp-2">
                      {card.title}
                    </h3>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: color + "15", color }}
                    >
                      {card.category}
                    </span>
                  </div>

                  {hasKeywords && (
                    <div className="space-y-2 mb-3">
                      {/* Headings as page structure */}
                      {card.headings.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {card.headings.map((h) => (
                            <span
                              key={h}
                              className="text-[11px] text-text-secondary bg-bg-tertiary px-1.5 py-0.5 rounded"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Tags */}
                      {card.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {card.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] text-accent-vivid bg-accent-vivid/8 px-1.5 py-0.5 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Concepts (wiki-links) */}
                      {card.concepts.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {card.concepts.map((c) => (
                            <span
                              key={c}
                              className="text-[10px] text-accent-blue bg-accent-blue/8 px-1.5 py-0.5 rounded"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[10px] text-text-tertiary pt-2 border-t border-border-primary">
                    <span>{card.words > 1000 ? `${(card.words / 1000).toFixed(1)}K` : card.words} 字</span>
                    <span>{card.connections} 关联</span>
                    {card.headings.length > 0 && <span>{card.headings.length} 章节</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center text-text-tertiary text-sm py-16">
            无匹配页面
          </div>
        )}
      </div>
    </div>
  );
}
