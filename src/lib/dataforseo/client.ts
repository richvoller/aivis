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
  CrossAggregatedTarget,
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

const FETCH_TIMEOUT_MS = Number(process.env.DATAFORSEO_TIMEOUT_MS ?? 120_000);

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
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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

/** DataForSEO URL segment — internal `chatgpt` maps to API `chat_gpt`. */
export function apiPlatformSegment(platform: Platform): string {
  return platform === "chatgpt" ? "chat_gpt" : platform;
}

function firstTask(envelope: unknown): Record<string, unknown> | undefined {
  const tasks = (envelope as { tasks?: Array<Record<string, unknown>> })?.tasks;
  return tasks?.[0];
}

/** Pull the first `tasks[].result[]` array out of a DataForSEO envelope. */
function firstResult(envelope: unknown): unknown[] {
  const result = firstTask(envelope)?.result;
  return Array.isArray(result) ? result : [];
}

function assertTaskOk(envelope: unknown): void {
  const task = firstTask(envelope);
  const code = task?.status_code as number | undefined;
  if (code && code !== 20000) {
    throw new Error(`DataForSEO ${code}: ${task?.status_message ?? "request failed"}`);
  }
}

const MENTIONS_LOCATION_CODE = Number(process.env.DATAFORSEO_LOCATION_CODE ?? 2840);
const MENTIONS_LANGUAGE_CODE = process.env.DATAFORSEO_LANGUAGE_CODE ?? "en";

function buildLlmTask(req: LlmResponseRequest, platform: Platform): Record<string, unknown> {
  // ChatGPT (chat_gpt) accepts only a minimal parameter set for current models.
  if (platform === "chatgpt") {
    const task: Record<string, unknown> = {
      model_name: req.model_name,
      user_prompt: req.user_prompt,
      // Required for fan-out queries and web-grounded answers with citations.
      web_search: true,
    };
    if (req.system_message) task.system_message = req.system_message;
    return task;
  }

  const task: Record<string, unknown> = {
    model_name: req.model_name,
    user_prompt: req.user_prompt,
    max_output_tokens: req.max_output_tokens ?? 2048,
    temperature: req.temperature ?? 0.7,
  };
  if (req.system_message) task.system_message = req.system_message;
  if (req.use_reasoning) task.use_reasoning = true;
  return task;
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

  // Fan-out queries can live at result level
  const resultFanOut = result?.fan_out_queries;
  if (Array.isArray(resultFanOut)) {
    for (const q of resultFanOut) {
      const text = typeof q === "string" ? q : (q as Record<string, unknown>)?.query;
      if (typeof text === "string" && text.trim()) fanOut.add(text.trim());
    }
  }

  for (const item of items) {
    collectText(item.text);
    collectText(item.content);
    collectText((item.message as Record<string, unknown> | undefined)?.content);

    // Current API shape: items[].sections[].text (skip internal reasoning traces)
    const sections = item.sections as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(sections)) {
      for (const section of sections) {
        const sectionType = section.type as string | undefined;
        if (sectionType === "reasoning") continue;

        collectText(section.text);
        collectText(section.content);

        const sectionSources = [
          section.annotations,
          section.citations,
          section.sources,
          section.references,
        ];
        for (const arr of sectionSources) {
          if (Array.isArray(arr)) {
            for (const s of arr as Array<Record<string, unknown>>) {
              const u = (s?.url ?? s?.link ?? s?.source) as unknown;
              if (typeof u === "string" && /^https?:\/\//.test(u)) cited.add(u);
            }
          }
        }
      }
    }

    // sources / annotations / citations (item level)
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

  const segment = apiPlatformSegment(req.platform);
  const envelope = await post(
    `/v3/ai_optimization/${segment}/llm_responses/live`,
    buildLlmTask(req, req.platform),
  );
  assertTaskOk(envelope);
  return normaliseLlmResponse(req.platform, req.model_name, envelope);
}

export async function getModels(platform: Platform): Promise<string[]> {
  if (isMockMode()) return [DEFAULT_MODELS[platform]];
  try {
    const segment = apiPlatformSegment(platform);
    const res = await fetch(`${baseUrl()}/v3/ai_optimization/${segment}/llm_responses/models`, {
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
function mentionGroupElements(
  row: Record<string, unknown> | undefined,
  field: string,
): Array<{ key: string; mentions: number }> {
  const arr = row?.[field];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((el) => el as Record<string, unknown>)
    .filter((el) => el.type === "group_element" && typeof el.key === "string")
    .map((el) => ({
      key: el.key as string,
      mentions: (el.mentions as number) ?? 0,
    }));
}

function sumMentions(groups: Array<{ mentions: number }>): number {
  return groups.reduce((s, g) => s + g.mentions, 0);
}

export async function searchMentions(
  keyword: string,
  platform: "google" | "chat_gpt",
): Promise<MentionSearchRow> {
  if (isMockMode()) return mockMentionSearch(keyword, platform);

  const envelope = await post("/v3/ai_optimization/llm_mentions/search/live", {
    platform,
    location_code: MENTIONS_LOCATION_CODE,
    language_code: MENTIONS_LANGUAGE_CODE,
    target: [{ keyword, match_type: "word_match" }],
    limit: 1,
  });
  const row = firstResult(envelope)[0] as Record<string, unknown> | undefined;
  const items = (row?.items as Array<Record<string, unknown>>) ?? [];
  const first = items[0];
  return {
    keyword,
    platform,
    mention_count: (first?.mentions as number) ?? sumMentions(mentionGroupElements(row, "platform")),
    ai_search_volume: (first?.ai_search_volume as number) ?? (row?.ai_search_volume as number) ?? null,
    monthly_searches: (first?.monthly_searches as number) ?? null,
    cited_sources: [],
    non_cited_sources: [],
  };
}

export async function getCrossAggregated(
  targets: CrossAggregatedTarget[],
  platform: "google" | "chat_gpt" = "google",
): Promise<CrossAggregatedRow[]> {
  if (isMockMode()) {
    return mockCrossAggregated(
      targets.map((t) => t.domain),
      platform,
    );
  }

  if (targets.length < 2) return [];

  const envelope = await post(
    "/v3/ai_optimization/llm_mentions/cross_aggregated_metrics/live",
    {
      platform,
      location_code: MENTIONS_LOCATION_CODE,
      language_code: MENTIONS_LANGUAGE_CODE,
      targets: targets.map((t) => ({
        aggregation_key: t.key,
        target: [
          {
            keyword: t.keyword ?? t.domain.split(".")[0],
            match_type: "word_match" as const,
          },
        ],
      })),
      internal_list_limit: 10,
    },
  );

  const result = firstResult(envelope)[0] as Record<string, unknown> | undefined;
  const items = (result?.items as Array<Record<string, unknown>>) ?? [];
  const rows: CrossAggregatedRow[] = items.map((item) => {
    const key = (item.key as string) ?? "";
    const matched = targets.find((t) => t.key === key || t.domain === key);
    const platformMentions = mentionGroupElements(item, "platform");
    const mention_count = sumMentions(platformMentions);
    return {
      domain: matched?.domain ?? key,
      mention_count,
      share_of_voice: 0,
      platform,
    };
  });

  const total = rows.reduce((s, r) => s + r.mention_count, 0) || 1;
  return rows.map((r) => ({
    ...r,
    share_of_voice: Number(((r.mention_count / total) * 100).toFixed(1)),
  }));
}

export async function getTopDomains(
  keyword: string,
  platform: "google" | "chat_gpt" = "google",
): Promise<TopDomainRow[]> {
  if (isMockMode()) return mockTopDomains(keyword, platform);
  const envelope = await post("/v3/ai_optimization/llm_mentions/top_domains/live", {
    platform,
    location_code: MENTIONS_LOCATION_CODE,
    language_code: MENTIONS_LANGUAGE_CODE,
    target: [{ keyword, match_type: "word_match" }],
    internal_list_limit: 25,
  });
  const row = firstResult(envelope)[0] as Record<string, unknown> | undefined;
  const total = (row?.total as Record<string, unknown> | undefined) ?? row;
  return mentionGroupElements(total, "sources_domain").map((row) => ({
    domain: row.key.replace(/^www\./, ""),
    mention_count: row.mentions,
    platform,
  }));
}

export async function getTopPages(
  keyword: string,
  platform: "google" | "chat_gpt" = "google",
): Promise<TopPageRow[]> {
  if (isMockMode()) return mockTopPages(keyword, platform);
  const envelope = await post("/v3/ai_optimization/llm_mentions/top_pages/live", {
    platform,
    location_code: MENTIONS_LOCATION_CODE,
    language_code: MENTIONS_LANGUAGE_CODE,
    target: [{ keyword, match_type: "word_match" }],
    internal_list_limit: 25,
  });
  const row = firstResult(envelope)[0] as Record<string, unknown> | undefined;
  const total = (row?.total as Record<string, unknown> | undefined) ?? row;
  return mentionGroupElements(total, "sources_domain").map((row) => ({
    url: row.key,
    domain: normaliseDomainFromUrl(row.key),
    mention_count: row.mentions,
    platform,
  }));
}

function normaliseDomainFromUrl(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^www\./, "");
  }
}
