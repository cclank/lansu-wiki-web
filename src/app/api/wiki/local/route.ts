import { NextRequest } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import { join, relative } from "path";
import { buildWikiData } from "@/lib/github";

async function collectMdFiles(
  dir: string,
  base: string
): Promise<{ path: string; content: string }[]> {
  const results: { path: string; content: string }[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      results.push(...(await collectMdFiles(fullPath, base)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const content = await readFile(fullPath, "utf-8");
      const relPath = relative(base, fullPath);
      results.push({ path: relPath, content });
    }
  }

  return results;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const dirPath = searchParams.get("path");

  if (!dirPath) {
    return Response.json({ error: "Missing path parameter" }, { status: 400 });
  }

  // Resolve ~ to home directory
  const resolved = dirPath.startsWith("~")
    ? join(process.env.HOME || "/", dirPath.slice(1))
    : dirPath;

  try {
    const info = await stat(resolved);
    if (!info.isDirectory()) {
      return Response.json(
        { error: "Path is not a directory" },
        { status: 400 }
      );
    }

    const files = await collectMdFiles(resolved, resolved);

    if (files.length === 0) {
      return Response.json(
        { error: "No .md files found in directory" },
        { status: 404 }
      );
    }

    // Use directory name as repo name
    const dirName = resolved.split("/").filter(Boolean).pop() || "local";
    const wikiData = buildWikiData("local", dirName, files);

    return Response.json(wikiData);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
