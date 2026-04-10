"use client";

import { useMemo } from "react";
import {
  FileText,
  Link2,
  Tag,
  BarChart3,
  TrendingUp,
  Layers,
} from "lucide-react";
import type { WikiData } from "@/lib/github";

interface StatsViewProps {
  data: WikiData;
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

export default function StatsView({ data, onSelect }: StatsViewProps) {
  const stats = useMemo(() => {
    const totalPages = data.pages.length;
    const totalLinks = data.graph.links.length;
    const totalWords = data.pages.reduce(
      (sum, p) => sum + p.content.split(/\s+/).length,
      0
    );

    // Tag frequency
    const tagFreq = new Map<string, number>();
    for (const page of data.pages) {
      if (Array.isArray(page.frontmatter.tags)) {
        for (const tag of page.frontmatter.tags as string[]) {
          tagFreq.set(tag, (tagFreq.get(tag) || 0) + 1);
        }
      }
    }
    const topTags = [...tagFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    // Most connected pages
    const connectionCount = new Map<string, number>();
    for (const link of data.graph.links) {
      connectionCount.set(
        link.source,
        (connectionCount.get(link.source) || 0) + 1
      );
      connectionCount.set(
        link.target,
        (connectionCount.get(link.target) || 0) + 1
      );
    }
    const topConnected = [...connectionCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([slug, count]) => ({
        slug,
        title: data.pages.find((p) => p.slug === slug)?.title || slug,
        count,
      }));

    // Category distribution
    const catDistrib = Object.entries(data.categories).map(([cat, pages]) => ({
      category: cat,
      count: pages.length,
      percentage: Math.round((pages.length / totalPages) * 100),
    }));
    catDistrib.sort((a, b) => b.count - a.count);

    // Largest pages (by word count)
    const largestPages = data.pages
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        words: p.content.split(/\s+/).length,
      }))
      .sort((a, b) => b.words - a.words)
      .slice(0, 8);

    // Link density
    const linkDensity =
      totalPages > 1
        ? (totalLinks / (totalPages * (totalPages - 1))).toFixed(3)
        : "0";

    // Pages with no outgoing links (orphans)
    const orphanCount = data.pages.filter((p) => p.links.length === 0).length;

    return {
      totalPages,
      totalLinks,
      totalWords,
      topTags,
      topConnected,
      catDistrib,
      largestPages,
      linkDensity,
      orphanCount,
    };
  }, [data]);

  return (
    <div className="p-6 overflow-y-auto h-full sidebar-scroll">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: FileText,
              label: "页面总数",
              value: stats.totalPages,
              color: "text-accent-blue",
              bg: "bg-accent-blue/10",
            },
            {
              icon: Link2,
              label: "链接总数",
              value: stats.totalLinks,
              color: "text-accent-purple",
              bg: "bg-accent-purple/10",
            },
            {
              icon: BarChart3,
              label: "总字数",
              value:
                stats.totalWords > 1000
                  ? `${(stats.totalWords / 1000).toFixed(1)}K`
                  : stats.totalWords,
              color: "text-accent-cyan",
              bg: "bg-accent-cyan/10",
            },
            {
              icon: TrendingUp,
              label: "链接密度",
              value: stats.linkDensity,
              color: "text-accent-emerald",
              bg: "bg-accent-emerald/10",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-bg-secondary border border-border-primary rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <span className="text-xs text-text-tertiary">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold text-text-primary">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category distribution */}
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-accent-amber" />
              <h3 className="text-sm font-medium text-text-primary">
                分类分布
              </h3>
            </div>
            <div className="space-y-3">
              {stats.catDistrib.map((cat) => {
                const color =
                  CATEGORY_COLORS[cat.category] || "#3b82f6";
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text-secondary">
                        {cat.category}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        {cat.count} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${cat.percentage}%`,
                          background: `linear-gradient(90deg, ${color}, ${color}88)`,
                          boxShadow: `0 0 8px ${color}40`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Most connected pages */}
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="w-4 h-4 text-accent-purple" />
              <h3 className="text-sm font-medium text-text-primary">
                最热门页面
              </h3>
            </div>
            <div className="space-y-2">
              {stats.topConnected.map((page, idx) => (
                <button
                  key={page.slug}
                  onClick={() => onSelect(page.slug)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer text-left"
                >
                  <span
                    className={`text-xs font-mono w-5 text-center ${
                      idx < 3 ? "text-accent-amber font-bold" : "text-text-tertiary"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-sm text-text-secondary truncate flex-1">
                    {page.title}
                  </span>
                  <span className="text-xs text-text-tertiary shrink-0">
                    {page.count} links
                  </span>
                  {/* Mini bar */}
                  <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full rounded-full bg-accent-purple"
                      style={{
                        width: `${
                          (page.count /
                            (stats.topConnected[0]?.count || 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tag cloud */}
          {stats.topTags.length > 0 && (
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-4 h-4 text-accent-cyan" />
                <h3 className="text-sm font-medium text-text-primary">
                  标签云
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.topTags.map(([tag, count]) => {
                  const maxCount = stats.topTags[0]?.[1] || 1;
                  const intensity = 0.3 + (count / maxCount) * 0.7;
                  return (
                    <span
                      key={tag}
                      className="px-3 py-1.5 rounded-lg border border-accent-cyan/20 text-sm transition-transform hover:scale-105 cursor-default"
                      style={{
                        background: `rgba(6, 182, 212, ${intensity * 0.12})`,
                        color: `rgba(6, 182, 212, ${0.5 + intensity * 0.5})`,
                        fontSize: `${11 + (count / maxCount) * 5}px`,
                      }}
                    >
                      #{tag}
                      <span className="ml-1 opacity-60 text-[10px]">
                        {count}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Largest pages */}
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-accent-emerald" />
              <h3 className="text-sm font-medium text-text-primary">
                最长页面
              </h3>
            </div>
            <div className="space-y-2">
              {stats.largestPages.map((page) => (
                <button
                  key={page.slug}
                  onClick={() => onSelect(page.slug)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer text-left"
                >
                  <span className="text-sm text-text-secondary truncate flex-1">
                    {page.title}
                  </span>
                  <span className="text-xs text-text-tertiary shrink-0">
                    {page.words > 1000
                      ? `${(page.words / 1000).toFixed(1)}K`
                      : page.words}{" "}
                    字
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer stats */}
        <div className="text-center text-xs text-text-tertiary py-4">
          {stats.orphanCount > 0 && (
            <span>
              {stats.orphanCount} 个孤立页面（无外链）
              {" · "}
            </span>
          )}
          平均每页{" "}
          {Math.round(stats.totalWords / stats.totalPages)} 字{" · "}
          平均 {(stats.totalLinks / stats.totalPages).toFixed(1)} 条链接/页
        </div>
      </div>
    </div>
  );
}
