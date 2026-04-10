import { NextRequest } from "next/server";
import { fetchRepoTree, fetchFileContent, buildWikiData } from "@/lib/github";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (!owner || !repo) {
    return Response.json({ error: "Missing owner or repo" }, { status: 400 });
  }

  try {
    // Fetch file tree
    const tree = await fetchRepoTree(owner, repo);

    // Fetch all markdown file contents in parallel (batch of 10)
    const files: { path: string; content: string }[] = [];
    const batchSize = 10;

    for (let i = 0; i < tree.length; i += batchSize) {
      const batch = tree.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const content = await fetchFileContent(owner, repo, file.path);
            return { path: file.path, content };
          } catch {
            return null;
          }
        })
      );
      files.push(
        ...(results.filter(Boolean) as { path: string; content: string }[])
      );
    }

    // Build wiki data
    const wikiData = buildWikiData(owner, repo, files);

    return Response.json(wikiData);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
