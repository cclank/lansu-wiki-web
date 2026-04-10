"use client";

import { useEffect, useState, useMemo, useCallback, use } from "react";
import {
  BookOpen,
  Search,
  Network,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Menu,
  X,
} from "lucide-react";
import type { WikiData } from "@/lib/github";
import Sidebar from "@/components/Sidebar";
import MarkdownContent from "@/components/MarkdownContent";
import TableOfContents from "@/components/TableOfContents";
import KnowledgeGraph from "@/components/KnowledgeGraph";
import SearchDialog from "@/components/SearchDialog";
import Link from "next/link";

type ViewMode = "read" | "graph";

export default function WikiPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = use(params);
  const [data, setData] = useState<WikiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("read");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  // Fetch wiki data
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/wiki?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to load wiki");
        }
        const wikiData: WikiData = await res.json();
        setData(wikiData);

        // Auto-select first page (prefer README/index, then first page)
        const readmePage = wikiData.pages.find(
          (p) =>
            p.path.toLowerCase() === "readme.md" ||
            p.path.toLowerCase() === "index.md"
        );
        if (readmePage) {
          setActiveSlug(readmePage.slug);
        } else if (wikiData.pages.length > 0) {
          setActiveSlug(wikiData.pages[0].slug);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [owner, repo]);

  // Reading progress
  useEffect(() => {
    function handleScroll() {
      const contentEl = document.getElementById("wiki-content-area");
      if (!contentEl) return;
      const { scrollTop, scrollHeight, clientHeight } = contentEl;
      const progress = scrollTop / (scrollHeight - clientHeight);
      setReadingProgress(Math.min(Math.max(progress, 0), 1));
    }
    const el = document.getElementById("wiki-content-area");
    el?.addEventListener("scroll", handleScroll);
    return () => el?.removeEventListener("scroll", handleScroll);
  }, [activeSlug]);

  // Keyboard shortcut for search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activePage = useMemo(
    () => data?.pages.find((p) => p.slug === activeSlug) ?? null,
    [data, activeSlug]
  );

  const slugByName = useMemo(() => {
    const map = new Map<string, string>();
    if (data) {
      for (const p of data.pages) {
        const name = p.path.split("/").pop()!.replace(/\.md$/, "").toLowerCase();
        map.set(name, p.slug);
      }
    }
    return map;
  }, [data]);

  const handleNavigate = useCallback((slug: string) => {
    setActiveSlug(slug);
    setViewMode("read");
    setSidebarOpen(false);
    // Scroll to top
    document.getElementById("wiki-content-area")?.scrollTo(0, 0);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <Loader2 className="w-8 h-8 text-accent-blue animate-spin" />
        <p className="text-text-secondary text-sm">
          正在加载 {owner}/{repo} ...
        </p>
        <div className="flex gap-2 mt-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="skeleton w-24 h-3"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <AlertCircle className="w-10 h-10 text-accent-rose" />
        <p className="text-text-primary font-medium">加载失败</p>
        <p className="text-text-secondary text-sm max-w-md text-center">
          {error}
        </p>
        <Link
          href="/"
          className="mt-4 px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          返回首页
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Reading progress */}
      {viewMode === "read" && (
        <div
          className="reading-progress"
          style={{ width: `${readingProgress * 100}%` }}
        />
      )}

      {/* Header */}
      <header className="shrink-0 h-14 bg-bg-secondary/80 backdrop-blur-md border-b border-border-primary flex items-center px-4 gap-3 z-20">
        {/* Mobile menu toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors cursor-pointer"
        >
          {sidebarOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>

        <Link
          href="/"
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent-blue" />
          <span className="text-sm font-medium text-text-primary">
            {owner}/{repo}
          </span>
          <span className="text-xs text-text-tertiary">
            · {data.pages.length} 页
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-text-tertiary hover:text-text-secondary hover:border-border-secondary transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">搜索</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 bg-bg-hover rounded text-[10px] font-mono">
              ⌘K
            </kbd>
          </button>

          {/* View mode toggle */}
          <div className="flex items-center bg-bg-tertiary border border-border-primary rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("read")}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === "read"
                  ? "bg-accent-blue/10 text-accent-blue"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">阅读</span>
            </button>
            <button
              onClick={() => setViewMode("graph")}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === "graph"
                  ? "bg-accent-purple/10 text-accent-purple"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">图谱</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:relative z-40 lg:z-auto h-[calc(100vh-3.5rem)] transition-transform duration-200`}
        >
          <Sidebar
            categories={data.categories}
            activeSlug={activeSlug}
            onSelect={handleNavigate}
          />
        </div>

        {/* Content area */}
        {viewMode === "read" ? (
          <div className="flex flex-1 overflow-hidden">
            <div
              id="wiki-content-area"
              className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 scroll-smooth"
            >
              {activePage ? (
                <div className="max-w-3xl mx-auto">
                  <MarkdownContent
                    page={activePage}
                    owner={owner}
                    repo={repo}
                    onNavigate={handleNavigate}
                    slugByName={slugByName}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-3">
                  <BookOpen className="w-10 h-10 opacity-30" />
                  <p className="text-sm">选择左侧页面开始阅读</p>
                </div>
              )}
            </div>

            {/* TOC */}
            {activePage && (
              <div className="pr-6 pt-8 hidden xl:block">
                <TableOfContents content={activePage.content} />
              </div>
            )}
          </div>
        ) : (
          /* Graph view */
          <div className="flex-1 p-4">
            <KnowledgeGraph
              nodes={data.graph.nodes}
              links={data.graph.links}
              activeSlug={activeSlug}
              onSelect={handleNavigate}
            />
          </div>
        )}
      </div>

      {/* Search dialog */}
      <SearchDialog
        pages={data.pages}
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleNavigate}
      />
    </div>
  );
}
