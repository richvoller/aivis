import "server-only";
import type { Platform } from "../constants";
import { DEFAULT_MODELS } from "../constants";
import {
  mockCrossAggregated,
  mockLlmResponse,
  mockMentionSearch,
  mockTopDomains,
  mockTopPages,
} from "./mock";
import type {
  CrossAggregatedRow,
  LlmResponseRequest,
  MentionSearchRow,
  NormalisedLlmResponse,
  TopDomainRow,
  TopPageRow,
} from "./types";

export interface BrandContext {
  brandName: string;
  brandDomain: string;
  competitorNames: string[];
}

export function isMockMode(): boolean {
  const forced = process.env.DATAFORSEO_USE_MOCK === "true";
  const hasCreds = !!process.env.DATAFORSEO_LOGIN && !!process.env.DATAFORSEO_PASSWORD;
  return forced || !hasCreds;
}

function authHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  const token = Buffer.from(`${login}:${password}`).toString("base64");
  return `Basic ${token}`;
}

function baseUrl(): string {
  return process.env.DATAFORSEO_BASE_URL?.replace(/\/$/, "") ?? "https://api.dataforseo.com";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST to a DataForSEO endpoint with the standard `[task]` array body, Basic
 * auth and exponential-backoff retry. Returns the parsed JSON envelope.
 */
async function post<T = unknown>(path: string, task: Record<string, unknown>, attempt = 0): Promise<T> {
  const url = `${baseUrl()}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([task]),
      cache: "no-store",
    });

    if (res.status === 429 || res.status >= 500) {
      throw new Error(`DataForSEO ${res.status}`);
    }
    const json = (await res.json()) as T;
    return json;
  } catch (err) {
    if (attempt < 3) {
      await sleep(2 ** attempt * 500);
      return post<T>(path, task, attempt + 1);
    }
    throw err;
  }
}

/** Pull the first `tasks[].result[]` array out of a DataForSEO envelope. */
function firstResult(envelope: unknown): unknown[] {
  const tasks = (envelope as { tasks?: Array<{ result?: unknown[] }> })?.tasks;
  const result = tasks?.[0]?.result;
  return Array.isArray(result) ? result : [];
}

/**
 * Defensively extract text / sources / fan-out queries from a raw LLM
 * Responses payload. DataForSEO's exact field names can vary by platform and
 * version, so we probe several known shapes and fall back gracefully.
 */
export function normaliseLlmResponse(
  platform: Platform,
  model_name: string,
  envelope: unknown,
): NormalisedLlmResponse {
  const result = firstResult(envelope)[0] as Record<string, unknown> | undefined;
  const items = (result?.items as Array<Record<string, unknown>>) ?? [];

  const textParts: string[] = [];
  const cited = new Set<string>();
  const fanOut = new Set<string>();
  const brands = new Set<string>();

  const collectText = (v: unknown) => {
    if (typeof v === "string" && v.trim()) textParts.push(v.trim());
  };

  // result-level text fields
  collectText(result?.text);
  collectText((result?.message as Record<string, unknown> | undefined)?.content);

  for (const item of items) {
    collectText(item.text);
    collectText(item.content);
    collectText((item.message as Record<string, unknown> | undefined)?.content);

    // sources / annotations / citations
    const sourceArrays = [item.sources, item.annotations, item.citations, item.references];
    for (const arr of sourceArrays) {
      if (Array.isArray(arr)) {
        for (const s of arr as Array<Record<string, unknown>>) {
          const u = (s?.url ?? s?.link ?? s?.source ?? s) as unknown;
          if (typeof u === "string" && /^https?:\/\//.test(u)) cited.add(u);
        }
      }
    }

    // fan-out / research queries
    const fanArrays = [item.fan_out_queries, item.queries, item.research_queries, item.sub_queries];
    for (const arr of fanArrays) {
      if (Array.isArray(arr)) {
        for (const q of arr) {
          const text = typeof q === "string" ? q : (q as Record<string, unknown>)?.query;
          if (typeof text === "string" && text.trim()) fanOut.add(text.trim());
        }
      }
    }

    // brand entities
    const entArrays = [item.brand_entities, item.entities];
    for (const arr of entArrays) {
      if (Array.isArray(arr)) {
        for (const e of arr) {
          const name = typeof e === "string" ? e : (e as Record<string, unknown>)?.name;
          if (typeof name === "string" && name.trim()) brands.add(name.trim());
        }
      }
    }
  }

  return {
    platform,
    model_name,
    response_text: textParts.join("\n\n"),
    cited_urls: [...cited],
    fan_out_queries: [...fanOut],
    brand_entities: [...brands],
    money_spent: (result?.money_spent as number) ?? null,
    raw: envelope,
  };
}

// ---------------------------------------------------------------------------
// LLM Responses API
// ---------------------------------------------------------------------------
export async function getLLMResponse(
  req: LlmResponseRequest,
  ctx: BrandContext,
): Promise<NormalisedLlmResponse> {
  if (isMockMode()) {
    return mockLlmResponse({
      platform: req.platform,
      model_name: req.model_name,
      user_prompt: req.user_prompt,
      brandName: ctx.brandName,
      brandDomain: ctx.brandDomain,
      competitorNames: ctx.competitorNames,
    });
  }

  const task: Record<string, unknown> = {
    model_name: req.model_name,
    user_prompt: req.user_prompt,
    max_output_tokens: req.max_output_tokens ?? 2048,
    temperature: req.temperature ?? 0.7,
  };
  if (req.system_message) task.system_message = req.system_message;
  if (req.use_reasoning) task.use_reasoning = true;

  const envelope = await post(
    `/v3/ai_optimization/${req.platform}/llm_responses/live`,
    task,
  );
  return normaliseLlmResponse(req.platform, req.model_name, envelope);
}

export async function getModels(platform: Platform): Promise<string[]> {
  if (isMockMode()) return [DEFAULT_MODELS[platform]];
  try {
    const res = await fetch(`${baseUrl()}/v3/ai_optimization/${platform}/llm_responses/models`, {
      headers: { Authorization: authHeader() },
      cache: "no-store",
    });
    const json = await res.json();
    const result = firstResult(json);
    const names = result
      .map((r) => (r as Record<string, unknown>)?.model_name)
      .filter((n): n is string => typeof n === "string");
    return names.length ? names : [DEFAULT_MODELS[platform]];
  } catch {
    return [DEFAULT_MODELS[platform]];
  }
}

// ---------------------------------------------------------------------------
// LLM Mentions API (Google AIO + ChatGPT dataset)
// ---------------------------------------------------------------------------
export async function searchMentions(
  keyword: string,
  platform: "google" | "chat_gpt",
): Promise<MentionSearchRow> {
  if (isMockMode()) return mockMentionSearch(keyword, platform);

  const envelope = await post("/v3/ai_optimization/llm_mentions/search/live", {
    keyword,
    platform,
  });
  const row = firstResult(envelope)[0] as Record<string, unknown> | undefined;
  return {
    keyword,
    platform,
    mention_count: (row?.mention_count as number) ?? 0,
    ai_search_volume: (row?.ai_search_volume as number) ?? null,
    monthly_searches: (row?.monthly_searches as number) ?? null,
    cited_sources: [],
    non_cited_sources: [],
  };
}

export async function getCrossAggregated(
  domains: string[],
  platform: "google" | "chat_gpt" = "google",
): Promise<CrossAggregatedRow[]> {
  if (isMockMode()) return mockCrossAggregated(domains, platform);

  const envelope = await post(
    "/v3/ai_optimization/llm_mentions/cross_aggregated_metrics/live",
    { targets: domains, platform },
  );
  const rows = firstResult(envelope) as Array<Record<string, unknown>>;
  const total = rows.reduce((s, r) => s + ((r.mention_count as number) ?? 0), 0) || 1;
  return rows.map((r) => ({
    domain: (r.target as string) ?? (r.domain as string) ?? "",
    mention_count: (r.mention_count as number) ?? 0,
    share_of_voice: Number(((((r.mention_count as number) ?? 0) / total) * 100).toFixed(1)),
    platform,
  }));
}

export async function getTopDomains(
  keyword: string,
  platform: "google" | "chat_gpt" = "google",
): Promise<TopDomainRow[]> {
  if (isMockMode()) return mockTopDomains(keyword, platform);
  const envelope = await post("/v3/ai_optimization/llm_mentions/top_domains/live", {
    keyword,
    platform,
  });
  return (firstResult(envelope) as Array<Record<string, unknown>>).map((r) => ({
    domain: (r.domain as string) ?? "",
    mention_count: (r.mention_count as number) ?? 0,
    platform,
  }));
}

export async function getTopPages(
  keyword: string,
  platform: "google" | "chat_gpt" = "google",
): Promise<TopPageRow[]> {
  if (isMockMode()) return mockTopPages(keyword, platform);
  const envelope = await post("/v3/ai_optimization/llm_mentions/top_pages/live", {
    keyword,
    platform,
  });
  return (firstResult(envelope) as Array<Record<string, unknown>>).map((r) => ({
    url: (r.url as string) ?? "",
    domain: (r.domain as string) ?? "",
    mention_count: (r.mention_count as number) ?? 0,
    platform,
  }));
}
