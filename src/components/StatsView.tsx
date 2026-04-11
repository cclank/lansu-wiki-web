"use client";

import { useMemo } from "react";
import {
  FileText,
  Link2,
  Tag,
  BarChart3,
  TrendingUp,
  Layers,
  AlertTriangle,
  LinkIcon,
  FileQuestion,
  HeartPulse,
} from "lucide-react";
import type { WikiData } from "@/lib/github";

interface StatsViewProps {
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

    // --- Health check ---
    // Slug lookup
    const slugByName = new Map<string, string>();
    for (const p of data.pages) {
      const name = p.path.split("/").pop()!.replace(/\.md$/, "").toLowerCase();
      slugByName.set(name, p.slug);
    }

    // Dead links: [[link]] targets that don't exist
    const deadLinks: { source: string; sourceTitle: string; target: string }[] = [];
    for (const page of data.pages) {
      for (const link of page.links) {
        if (!slugByName.has(link)) {
          deadLinks.push({ source: page.slug, sourceTitle: page.title, target: link });
        }
      }
    }

    // Orphan pages: no incoming links from any page
    const incomingSet = new Set<string>();
    for (const link of data.graph.links) {
      incomingSet.add(link.target);
    }
    const orphanPages = data.pages
      .filter((p) => !incomingSet.has(p.slug))
      .map((p) => ({ slug: p.slug, title: p.title }));

    // Short pages (< 100 words)
    const shortPages = data.pages
      .map((p) => ({ slug: p.slug, title: p.title, words: p.content.split(/\s+/).length }))
      .filter((p) => p.words < 100);

    // Health score
    const issues = deadLinks.length + orphanPages.length + shortPages.length;
    const healthScore = Math.max(0, Math.round((1 - issues / (totalPages * 3)) * 100));

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
      deadLinks,
      orphanPages,
      shortPages,
      healthScore,
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
              color: "text-accent-gold",
              bg: "bg-accent-gold/10",
            },
            {
              icon: Link2,
              label: "链接总数",
              value: stats.totalLinks,
              color: "text-accent-blue",
              bg: "bg-accent-blue/10",
            },
            {
              icon: BarChart3,
              label: "总字数",
              value:
                stats.totalWords > 1000
                  ? `${(stats.totalWords / 1000).toFixed(1)}K`
                  : stats.totalWords,
              color: "text-accent-emerald",
              bg: "bg-accent-emerald/10",
            },
            {
              icon: TrendingUp,
              label: "链接密度",
              value: stats.linkDensity,
              color: "text-accent-purple",
              bg: "bg-accent-gold/10",
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
              <Layers className="w-4 h-4 text-accent-gold" />
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
                      idx < 3 ? "text-accent-gold font-bold" : "text-text-tertiary"
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
                      className="h-full rounded-full bg-accent-gold"
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
                <Tag className="w-4 h-4 text-accent-gold" />
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
                      className="px-3 py-1.5 rounded-lg border border-accent-gold/20 text-sm transition-transform hover:scale-105 cursor-default"
                      style={{
                        background: `rgba(194, 168, 130, ${intensity * 0.1})`,
                        color: `rgba(194, 168, 130, ${0.5 + intensity * 0.5})`,
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

        {/* Wiki Health */}
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <HeartPulse className="w-4 h-4 text-accent-vivid" />
            <h3 className="text-sm font-medium text-text-primary">Wiki 健康度</h3>
          </div>

          {/* Health score ring + summary */}
          <div className="flex items-center gap-6 mb-5">
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--bg-tertiary)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none"
                  stroke={stats.healthScore >= 80 ? "#72b886" : stats.healthScore >= 50 ? "#c9985e" : "#d48a8a"}
                  strokeWidth="3"
                  strokeDasharray={`${stats.healthScore * 0.974} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-text-primary">{stats.healthScore}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <LinkIcon className="w-3 h-3 text-accent-rose" />
                <span className="text-text-tertiary">死链 {stats.deadLinks.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileQuestion className="w-3 h-3 text-accent-amber" />
                <span className="text-text-tertiary">孤儿页 {stats.orphanPages.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-accent-gold" />
                <span className="text-text-tertiary">过短页 {stats.shortPages.length}</span>
              </div>
            </div>
          </div>

          {/* Issue lists */}
          <div className="space-y-4">
            {stats.deadLinks.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-accent-rose mb-2 flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" /> 死链
                </h4>
                <div className="space-y-1">
                  {stats.deadLinks.slice(0, 8).map((dl, i) => (
                    <button
                      key={`${dl.source}-${dl.target}-${i}`}
                      onClick={() => onSelect(dl.source)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-bg-hover transition-colors cursor-pointer text-left"
                    >
                      <span className="text-text-secondary truncate">{dl.sourceTitle}</span>
                      <span className="text-text-tertiary shrink-0">→</span>
                      <span className="text-accent-rose truncate">{dl.target}</span>
                    </button>
                  ))}
                  {stats.deadLinks.length > 8 && (
                    <p className="text-[10px] text-text-tertiary px-3">
                      还有 {stats.deadLinks.length - 8} 个...
                    </p>
                  )}
                </div>
              </div>
            )}

            {stats.orphanPages.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-accent-amber mb-2 flex items-center gap-1">
                  <FileQuestion className="w-3 h-3" /> 孤儿页（无入链）
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {stats.orphanPages.slice(0, 12).map((op) => (
                    <button
                      key={op.slug}
                      onClick={() => onSelect(op.slug)}
                      className="px-2.5 py-1 rounded-md text-[11px] bg-accent-amber/5 text-accent-amber border border-accent-amber/15 hover:bg-accent-amber/10 transition-colors cursor-pointer"
                    >
                      {op.title}
                    </button>
                  ))}
                  {stats.orphanPages.length > 12 && (
                    <span className="text-[10px] text-text-tertiary self-center">
                      +{stats.orphanPages.length - 12}
                    </span>
                  )}
                </div>
              </div>
            )}

            {stats.shortPages.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-accent-gold mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> 过短页面（&lt;100 字）
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {stats.shortPages.slice(0, 12).map((sp) => (
                    <button
                      key={sp.slug}
                      onClick={() => onSelect(sp.slug)}
                      className="px-2.5 py-1 rounded-md text-[11px] bg-accent-gold/5 text-accent-gold border border-accent-gold/15 hover:bg-accent-gold/10 transition-colors cursor-pointer"
                    >
                      {sp.title} ({sp.words}字)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {stats.deadLinks.length === 0 && stats.orphanPages.length === 0 && stats.shortPages.length === 0 && (
              <p className="text-xs text-accent-emerald text-center py-2">Wiki 状态良好，未发现问题</p>
            )}
          </div>
        </div>

        {/* Footer stats */}
        <div className="text-center text-xs text-text-tertiary py-4">
          平均每页{" "}
          {Math.round(stats.totalWords / stats.totalPages)} 字{" · "}
          平均 {(stats.totalLinks / stats.totalPages).toFixed(1)} 条链接/页
        </div>
      </div>
    </div>
  );
}
