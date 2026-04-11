"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch } from "lucide-react";
import { parseGitHubUrl } from "@/lib/github";

const EXAMPLES = [
  { label: "Hermes Wiki", url: "cclank/Hermes-Wiki" },
  { label: "TiDB Docs", url: "pingcap/docs" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      setError("请输入有效的 GitHub 仓库地址，如 owner/repo");
      return;
    }
    setError("");
    router.push(`/wiki/${parsed.owner}/${parsed.repo}`);
  }

  function handleExample(repoUrl: string) {
    const parsed = parseGitHubUrl(repoUrl);
    if (parsed) router.push(`/wiki/${parsed.owner}/${parsed.repo}`);
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center relative">
      {/* Subtle Morandi glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(194,168,130,0.03)_0%,transparent_70%)]" />
      </div>

      <main className="relative z-10 flex flex-col items-center gap-16 px-6 py-24 max-w-md w-full">
        {/* Brand — quiet confidence */}
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="w-10 h-10 rounded-full border border-border-secondary flex items-center justify-center">
            <span className="text-accent-vivid text-lg font-light">W</span>
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-text-primary">
            WikiView
          </h1>
          <p className="text-sm text-text-tertiary leading-relaxed">
            将 GitHub Wiki 仓库转化为可视化阅读体验
          </p>
        </div>

        {/* Input — clean */}
        <form onSubmit={handleSubmit} className="w-full">
          <div className="flex items-center bg-bg-secondary border border-border-primary rounded-lg overflow-hidden focus-within:border-border-secondary transition-colors">
            <GitBranch className="w-4 h-4 text-text-tertiary ml-4 shrink-0" />
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
              placeholder="owner/repo"
              className="flex-1 bg-transparent px-3 py-3.5 text-text-primary placeholder:text-text-tertiary outline-none text-sm"
            />
            <button
              type="submit"
              className="mr-1.5 px-4 py-2 bg-accent-vivid text-white rounded-md text-sm font-medium flex items-center gap-1.5 hover:brightness-110 transition cursor-pointer shrink-0"
            >
              打开
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {error && (
            <p className="mt-3 text-xs text-accent-rose text-center">{error}</p>
          )}
        </form>

        {/* Examples */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text-tertiary">试试</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.url}
              onClick={() => handleExample(ex.url)}
              className="px-3 py-1.5 border border-border-primary rounded-md text-xs text-text-tertiary hover:text-text-secondary hover:border-border-secondary transition-colors cursor-pointer"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Features — understated */}
        <div className="w-full border-t border-border-primary pt-8">
          <div className="flex justify-between text-center text-[11px] text-text-tertiary">
            <div className="flex flex-col gap-1">
              <span className="text-text-secondary text-xs">全文搜索</span>
              <span>⌘K 快速检索</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-text-secondary text-xs">知识图谱</span>
              <span>关系可视化</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-text-secondary text-xs">脑图</span>
              <span>层级结构</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-text-secondary text-xs">统计</span>
              <span>数据洞察</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
