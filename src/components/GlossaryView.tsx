"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { WikiData } from "@/lib/github";

interface GlossaryViewProps {
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

interface GlossaryEntry {
  term: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  mentionedIn: { slug: string; title: string }[];
}

function extractFirstParagraph(content: string): string {
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
      const clean = trimmed
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\[\[([^\]]+)\]\]/g, "$1")
        .replace(/[*_`~]/g, "");
      if (clean.length > 10) {
        return clean.length > 200 ? clean.slice(0, 197) + "…" : clean;
      }
    }
  }
  return "";
}

function getGroupKey(term: string): string {
  const first = term.charAt(0);
  // Latin letters
  if (/[a-zA-Z]/.test(first)) return first.toUpperCase();
  // CJK characters
  if (/[\u4e00-\u9fff]/.test(first)) return "中";
  return "#";
}

export default function GlossaryView({ data, onSelect }: GlossaryViewProps) {
  const [query, setQuery] = useState("");

  // Build glossary entries from page titles + tags
  const entries = useMemo(() => {
    const termMap = new Map<string, GlossaryEntry>();

    // Each page title becomes a term
    for (const page of data.pages) {
      const key = page.title.toLowerCase();
      if (!termMap.has(key)) {
        termMap.set(key, {
          term: page.title,
          slug: page.slug,
          title: page.title,
          category: page.category,
          summary: extractFirstParagraph(page.content),
          mentionedIn: [],
        });
      }
    }

    // Find mentions: if page A links to page B via [[wiki-link]], B is mentioned in A
    for (const page of data.pages) {
      for (const link of page.links) {
        const target = data.pages.find(
          (p) =>
            p.path
              .split("/")
              .pop()!
              .replace(/\.md$/, "")
              .toLowerCase() === link
        );
        if (target) {
          const entry = termMap.get(target.title.toLowerCase());
          if (entry && entry.slug !== page.slug) {
            const alreadyAdded = entry.mentionedIn.some((m) => m.slug === page.slug);
            if (!alreadyAdded) {
              entry.mentionedIn.push({ slug: page.slug, title: page.title });
            }
          }
        }
      }
    }

    // Add tags as separate entries if they map to pages
    for (const page of data.pages) {
      if (Array.isArray(page.frontmatter.tags)) {
        for (const tag of page.frontmatter.tags as string[]) {
          const key = tag.toLowerCase();
          if (!termMap.has(key)) {
            // Tag-only entry, link to the page that has it
            termMap.set(key, {
              term: tag,
              slug: page.slug,
              title: page.title,
              category: page.category,
              summary: "",
              mentionedIn: [],
            });
          }
        }
      }
    }

    return [...termMap.values()].sort((a, b) =>
      a.term.localeCompare(b.term, "zh-CN")
    );
  }, [data]);

  // Filtered
  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q)
    );
  }, [entries, query]);

  // Group by first letter
  const groups = useMemo(() => {
    const map = new Map<string, GlossaryEntry[]>();
    for (const entry of filtered) {
      const key = getGroupKey(entry.term);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    // Sort groups: A-Z first, then 中, then #
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      if (a === "中") return /[A-Z]/.test(b) ? 1 : -1;
      if (b === "中") return /[A-Z]/.test(a) ? -1 : 1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  // Index letters for quick jump
  const indexLetters = useMemo(() => groups.map(([key]) => key), [groups]);

  return (
    <div className="p-6 overflow-y-auto h-full sidebar-scroll">
      <div className="max-w-4xl mx-auto">
        {/* Search + index */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex items-center gap-2 bg-bg-secondary border border-border-primary rounded-lg px-3 py-2 flex-1">
            <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索术语..."
              className="bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none w-full"
            />
            <span className="text-[10px] text-text-tertiary shrink-0">
              {filtered.length} 项
            </span>
          </div>
        </div>

        {/* Letter index */}
        {indexLetters.length > 1 && (
          <div className="flex flex-wrap gap-1 mb-6">
            {indexLetters.map((letter) => (
              <a
                key={letter}
                href={`#glossary-${letter}`}
                className="w-7 h-7 flex items-center justify-center rounded-md text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                {letter}
              </a>
            ))}
          </div>
        )}

        {/* Grouped entries */}
        <div className="space-y-8">
          {groups.map(([letter, groupEntries]) => (
            <div key={letter} id={`glossary-${letter}`}>
              <div className="sticky top-0 bg-bg-primary/90 backdrop-blur-sm z-10 py-2 mb-3 border-b border-border-primary">
                <span className="text-lg font-bold text-text-primary">{letter}</span>
                <span className="text-xs text-text-tertiary ml-2">{groupEntries.length}</span>
              </div>
              <div className="space-y-2">
                {groupEntries.map((entry) => {
                  const color = CATEGORY_COLORS[entry.category] || "#3b82f6";
                  return (
                    <div
                      key={entry.slug + entry.term}
                      className="bg-bg-secondary border border-border-primary rounded-xl p-4 hover:border-border-secondary transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              onClick={() => onSelect(entry.slug)}
                              className="text-sm font-medium text-text-primary hover:text-accent-vivid transition-colors cursor-pointer truncate"
                            >
                              {entry.term}
                            </button>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                              style={{ background: color + "15", color }}
                            >
                              {entry.category}
                            </span>
                          </div>
                          {entry.summary && (
                            <p className="text-xs text-text-tertiary leading-relaxed line-clamp-2">
                              {entry.summary}
                            </p>
                          )}
                          {entry.mentionedIn.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <span className="text-[10px] text-text-tertiary">被引用:</span>
                              {entry.mentionedIn.slice(0, 4).map((m) => (
                                <button
                                  key={m.slug}
                                  onClick={() => onSelect(m.slug)}
                                  className="text-[10px] text-accent-vivid hover:underline cursor-pointer"
                                >
                                  {m.title.length > 20 ? m.title.slice(0, 18) + "…" : m.title}
                                </button>
                              ))}
                              {entry.mentionedIn.length > 4 && (
                                <span className="text-[10px] text-text-tertiary">
                                  +{entry.mentionedIn.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center text-text-tertiary text-sm py-16">
            无匹配术语
          </div>
        )}
      </div>
    </div>
  );
}
