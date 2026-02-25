#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = "https://api.github.com";
const RATE_LIMIT_MS = 200;
let last = 0;

function headers(): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": "mcp-github-api/1.0.0", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function ghFetch(path: string): Promise<any> {
  const now = Date.now(); if (now - last < RATE_LIMIT_MS) await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - (now - last)));
  last = Date.now();
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text().then(t => t.slice(0, 300))}`);
  return res.json();
}

const server = new McpServer({ name: "mcp-github-api", version: "1.0.0" });

server.tool("search_repos", "Search GitHub repositories.", {
  query: z.string(), sort: z.enum(["stars", "forks", "updated", "help-wanted-issues"]).default("stars"),
  perPage: z.number().min(1).max(100).default(10),
}, async ({ query, sort, perPage }) => {
  const d = await ghFetch(`/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&per_page=${perPage}`);
  const items = d.items?.map((r: any) => ({
    fullName: r.full_name, description: r.description?.slice(0, 200), stars: r.stargazers_count,
    forks: r.forks_count, language: r.language, url: r.html_url, updated: r.updated_at,
  }));
  return { content: [{ type: "text" as const, text: JSON.stringify({ total: d.total_count, items }, null, 2) }] };
});

server.tool("get_repo", "Get repository details.", {
  owner: z.string(), repo: z.string(),
}, async ({ owner, repo }) => {
  const d = await ghFetch(`/repos/${owner}/${repo}`);
  return { content: [{ type: "text" as const, text: JSON.stringify({
    fullName: d.full_name, description: d.description, stars: d.stargazers_count, forks: d.forks_count,
    language: d.language, license: d.license?.spdx_id, openIssues: d.open_issues_count,
    topics: d.topics, defaultBranch: d.default_branch, url: d.html_url,
  }, null, 2) }] };
});

server.tool("list_issues", "List repository issues.", {
  owner: z.string(), repo: z.string(), state: z.enum(["open", "closed", "all"]).default("open"),
  labels: z.string().optional(), perPage: z.number().min(1).max(100).default(20),
}, async ({ owner, repo, state, labels, perPage }) => {
  const p = new URLSearchParams({ state, per_page: String(perPage) });
  if (labels) p.set("labels", labels);
  const d = await ghFetch(`/repos/${owner}/${repo}/issues?${p}`);
  return { content: [{ type: "text" as const, text: JSON.stringify(d.map((i: any) => ({
    number: i.number, title: i.title, state: i.state, labels: i.labels?.map((l: any) => l.name),
    author: i.user?.login, comments: i.comments, created: i.created_at,
  })), null, 2) }] };
});

server.tool("get_user", "Get GitHub user profile.", {
  username: z.string(),
}, async ({ username }) => {
  const d = await ghFetch(`/users/${username}`);
  return { content: [{ type: "text" as const, text: JSON.stringify({
    login: d.login, name: d.name, bio: d.bio, company: d.company, location: d.location,
    publicRepos: d.public_repos, followers: d.followers, following: d.following, url: d.html_url,
  }, null, 2) }] };
});

server.tool("search_code", "Search code across GitHub (requires auth).", {
  query: z.string(), perPage: z.number().min(1).max(100).default(10),
}, async ({ query, perPage }) => {
  const d = await ghFetch(`/search/code?q=${encodeURIComponent(query)}&per_page=${perPage}`);
  const items = d.items?.map((c: any) => ({
    name: c.name, path: c.path, repo: c.repository?.full_name, url: c.html_url,
  }));
  return { content: [{ type: "text" as const, text: JSON.stringify({ total: d.total_count, items }, null, 2) }] };
});

server.tool("get_trending", "Get trending repositories (scrapes GitHub trending page data via search).", {
  language: z.string().optional().describe("e.g. 'typescript', 'python'"),
  since: z.enum(["daily", "weekly", "monthly"]).default("daily"),
}, async ({ language, since }) => {
  const date = new Date(); date.setDate(date.getDate() - (since === "daily" ? 1 : since === "weekly" ? 7 : 30));
  const dateStr = date.toISOString().split("T")[0];
  let q = `created:>${dateStr}`;
  if (language) q += `+language:${language}`;
  const d = await ghFetch(`/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=20`);
  const items = d.items?.map((r: any) => ({
    fullName: r.full_name, description: r.description?.slice(0, 150), stars: r.stargazers_count,
    language: r.language, url: r.html_url,
  }));
  return { content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }] };
});

async function main() { const t = new StdioServerTransport(); await server.connect(t); }
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
