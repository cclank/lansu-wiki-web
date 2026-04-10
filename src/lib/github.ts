export interface GitHubFile {
  path: string;
  name: string;
  type: "file" | "dir";
  sha: string;
  size: number;
  download_url: string | null;
}

export interface WikiPage {
  path: string;
  slug: string;
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  category: string;
  links: string[]; // outgoing wiki links
}

export interface WikiData {
  owner: string;
  repo: string;
  pages: WikiPage[];
  readme: string;
  categories: Record<string, WikiPage[]>;
  graph: { nodes: GraphNode[]; links: GraphLink[] };
}

export interface GraphNode {
  id: string;
  title: string;
  category: string;
  linkCount: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Handle various formats:
  // https://github.com/owner/repo
  // github.com/owner/repo
  // owner/repo
  const cleaned = url.trim().replace(/\/+$/, "");

  const fullMatch = cleaned.match(
    /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)/
  );
  if (fullMatch) return { owner: fullMatch[1], repo: fullMatch[2] };

  const shortMatch = cleaned.match(/^([^/]+)\/([^/]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] };

  return null;
}

export { parseGitHubUrl };

export async function fetchRepoTree(
  owner: string,
  repo: string
): Promise<{ path: string; url: string }[]> {
  // Use the Git Trees API to get all files at once
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      next: { revalidate: 300 }, // cache for 5 mins
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.tree
    .filter(
      (item: { type: string; path: string }) =>
        item.type === "blob" && item.path.endsWith(".md")
    )
    .map((item: { path: string; url: string }) => ({
      path: item.path,
      url: item.url,
    }));
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  const res = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`,
    { next: { revalidate: 300 } }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status}`);
  }

  return res.text();
}

function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const fmLines = match[1].split("\n");
  const fm: Record<string, unknown> = {};
  for (const line of fmLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();
    // Parse arrays
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim());
    }
    fm[key] = value;
  }

  return { frontmatter: fm, body: match[2] };
}

function extractWikiLinks(content: string): string[] {
  const links: string[] = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].toLowerCase());
  }
  return [...new Set(links)];
}

function inferCategory(path: string): string {
  const parts = path.split("/");
  if (parts.length > 1) {
    return parts[parts.length - 2];
  }
  return "root";
}

function slugFromPath(path: string): string {
  return path.replace(/\.md$/, "").replace(/\//g, "__");
}

export function buildWikiData(
  owner: string,
  repo: string,
  files: { path: string; content: string }[]
): WikiData {
  const pages: WikiPage[] = [];
  let readme = "";

  for (const file of files) {
    const { frontmatter, body } = parseFrontmatter(file.content);
    const links = extractWikiLinks(file.content);
    const slug = slugFromPath(file.path);
    const category = inferCategory(file.path);

    const title =
      (frontmatter.title as string) ||
      file.path
        .split("/")
        .pop()!
        .replace(/\.md$/, "")
        .replace(/-/g, " ");

    if (
      file.path.toLowerCase() === "readme.md" ||
      file.path.toLowerCase() === "index.md"
    ) {
      readme = body;
    }

    pages.push({
      path: file.path,
      slug,
      title,
      content: body,
      frontmatter,
      category,
      links,
    });
  }

  // Build categories
  const categories: Record<string, WikiPage[]> = {};
  for (const page of pages) {
    if (!categories[page.category]) {
      categories[page.category] = [];
    }
    categories[page.category].push(page);
  }
  // Sort pages within each category
  for (const cat of Object.keys(categories)) {
    categories[cat].sort((a, b) => a.title.localeCompare(b.title));
  }

  // Build knowledge graph
  const slugSet = new Set(pages.map((p) => p.slug));
  const slugByName = new Map<string, string>();
  for (const p of pages) {
    const name = p.path.split("/").pop()!.replace(/\.md$/, "").toLowerCase();
    slugByName.set(name, p.slug);
  }

  const nodes: GraphNode[] = pages.map((p) => ({
    id: p.slug,
    title: p.title,
    category: p.category,
    linkCount: p.links.length,
  }));

  const links: GraphLink[] = [];
  for (const page of pages) {
    for (const link of page.links) {
      const targetSlug = slugByName.get(link);
      if (targetSlug && slugSet.has(targetSlug)) {
        links.push({ source: page.slug, target: targetSlug });
      }
    }
  }

  return { owner, repo, pages, readme, categories, graph: { nodes, links } };
}
