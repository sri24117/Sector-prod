// WordPress connector — Skill 2's Phase 1 default (skills/seo-geo-aio-implementor.md §2).
// Auth: WordPress Application Passwords (HTTP Basic) — buildable now, no external gate.
// Applies fixes through the companion plugin (plugins/wordpress/sector-companion),
// which renders JSON-LD SERVER-SIDE in wp_head. That matters: GPTBot/ClaudeBot/
// PerplexityBot don't execute JS, so a client-side injected snippet would NOT
// reach the AI-crawler audience (skill §3). Server-rendered output does.
//
// Implements only what Slice 3 needs: verify credentials + apply JSON-LD.
// No fetch/publish/schedule — say so per the Connector contract.

export interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

import { fetch } from "undici";
import { guardedAgent } from "@sector/shared/net-guard";

const TIMEOUT_MS = 10_000;

function authHeader(c: WordPressCredentials): string {
  return "Basic " + Buffer.from(`${c.username}:${c.applicationPassword}`).toString("base64");
}

function endpoint(siteUrl: string, path: string): string {
  return new URL(path, siteUrl.endsWith("/") ? siteUrl : siteUrl + "/").toString();
}

export class WordPressError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "WordPressError";
  }
}

// Redirects are never followed: that would forward the Basic-auth header to another host.
// Instead tell the user which address to connect with (typically apex -> www, http -> https).
async function wpFetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) {
  // Guarded agent: the site address is user-supplied, so every connection is SSRF-checked on the IP dialled.
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "manual", dispatcher: guardedAgent() });
  const location = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && location) {
    const target = new URL(location, url);
    const siteRoot = new URL(target.pathname.replace(/wp-json\/.*$/, ""), target).toString();
    throw new WordPressError(`This site redirects to ${siteRoot} — connect using that address instead.`, res.status);
  }
  return res;
}

/** Confirms the credentials are valid AND that the companion plugin is installed. */
export async function verifyWordPressCredentials(c: WordPressCredentials): Promise<{ ok: true; userName: string }> {
  const me = await wpFetch(endpoint(c.siteUrl, "/wp-json/wp/v2/users/me"), { headers: { authorization: authHeader(c) } });
  if (me.status === 401 || me.status === 403) throw new WordPressError("WordPress rejected the credentials.", me.status);
  if (!me.ok) throw new WordPressError(`WordPress returned ${me.status} for credential check.`, me.status);
  const body = (await me.json()) as { name?: string };

  const plugin = await wpFetch(endpoint(c.siteUrl, "/wp-json/sector/v1/status"), { headers: { authorization: authHeader(c) } });
  if (!plugin.ok) throw new WordPressError("The SEctOr companion plugin is not installed or not active on this site.", plugin.status);
  return { ok: true, userName: body.name ?? c.username };
}

/** Writes the JSON-LD document that the companion plugin will render in <head>. */
export async function applyJsonLdSchema(c: WordPressCredentials, jsonLd: Record<string, unknown>): Promise<void> {
  const res = await wpFetch(endpoint(c.siteUrl, "/wp-json/sector/v1/schema"), {
    method: "POST",
    headers: { authorization: authHeader(c), "content-type": "application/json" },
    body: JSON.stringify({ jsonLd }),
  });
  if (!res.ok) throw new WordPressError(`Companion plugin refused the schema update (${res.status}).`, res.status);
}
