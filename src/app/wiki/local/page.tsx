"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { WikiData } from "@/lib/github";
import WikiViewer from "@/components/WikiViewer";

function LocalWikiContent() {
  const searchParams = useSearchParams();
  const dirPath = searchParams.get("path") || "";
  const [data, setData] = useState<WikiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!dirPath) {
      setError("未指定本地路径");
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/wiki/local?path=${encodeURIComponent(dirPath)}`
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to load local wiki");
        }
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dirPath]);

  const folderName = dirPath.split("/").filter(Boolean).pop() || "local";

  return (
    <WikiViewer
      data={data}
      loading={loading}
      error={error}
      label={folderName}
      owner="local"
      repo={folderName}
    />
  );
}

export default function LocalWikiPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <Loader2 className="w-8 h-8 text-accent-vivid animate-spin" />
          <p className="text-text-secondary text-sm">正在加载...</p>
        </div>
      }
    >
      <LocalWikiContent />
    </Suspense>
  );
}
