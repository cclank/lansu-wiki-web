"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ArrowRight,
  GitBranch,
  Search,
  Network,
  Sparkles,
} from "lucide-react";
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
    if (parsed) {
      router.push(`/wiki/${parsed.owner}/${parsed.repo}`);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-blue/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-purple/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-cyan/3 rounded-full blur-3xl" />
      </div>

      <main className="relative z-10 flex flex-col items-center gap-12 px-6 py-20 max-w-3xl w-full">
        {/* Logo & Title */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-accent-blue to-accent-purple shadow-lg shadow-accent-blue/20">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-text-primary">
              Wiki<span className="bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">View</span>
            </h1>
          </div>
          <p className="text-lg text-text-secondary max-w-md leading-relaxed">
            将任意 GitHub Wiki 仓库转化为精美、可视化的阅读体验
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="w-full max-w-xl">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-accent-blue to-accent-purple rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
            <div className="relative flex items-center bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden focus-within:border-accent-blue/50 transition-colors">
              <GitBranch className="w-5 h-5 text-text-tertiary ml-4 shrink-0" />
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError("");
                }}
                placeholder="github.com/owner/repo 或 owner/repo"
                className="flex-1 bg-transparent px-3 py-4 text-text-primary placeholder:text-text-tertiary outline-none text-base"
              />
              <button
                type="submit"
                className="mr-2 px-5 py-2.5 bg-gradient-to-r from-accent-blue to-accent-purple text-white rounded-xl font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
              >
                打开
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          {error && (
            <p className="mt-3 text-sm text-accent-rose text-center">{error}</p>
          )}
        </form>

        {/* Examples */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs text-text-tertiary uppercase tracking-wider">
            试试这些
          </span>
          <div className="flex gap-3 flex-wrap justify-center">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.url}
                onClick={() => handleExample(ex.url)}
                className="px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-accent-blue/40 transition-colors cursor-pointer"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl mt-4">
          {[
            {
              icon: Search,
              title: "全文搜索",
              desc: "快速检索所有页面内容",
              color: "text-accent-cyan",
            },
            {
              icon: Network,
              title: "知识图谱",
              desc: "可视化页面间的链接关系",
              color: "text-accent-purple",
            },
            {
              icon: Sparkles,
              title: "增强阅读",
              desc: "目录导航、分类浏览",
              color: "text-accent-amber",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col items-center gap-2 p-5 bg-bg-secondary/50 border border-border-primary rounded-xl text-center"
            >
              <feature.icon className={`w-6 h-6 ${feature.color}`} />
              <h3 className="text-sm font-medium text-text-primary">
                {feature.title}
              </h3>
              <p className="text-xs text-text-tertiary">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
