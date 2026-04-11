"use client";

import { useEffect, useState, use } from "react";
import type { WikiData } from "@/lib/github";
import WikiViewer from "@/components/WikiViewer";

export default function GitHubWikiPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = use(params);
  const [data, setData] = useState<WikiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [owner, repo]);

  return (
    <WikiViewer
      data={data}
      loading={loading}
      error={error}
      label={`${owner}/${repo}`}
      owner={owner}
      repo={repo}
    />
  );
}
