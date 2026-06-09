import "server-only";
import { collectAllCitations } from "./citations";
import { getAdminClient } from "./supabase/admin";
import { PLATFORMS, type Platform } from "./constants";
import type {
  ActionItem,
  Brand,
  CitationDomain,
  Competitor,
  CompetitorSovSnapshot,
  PromptWithConfig,
  ResponseSnapshot,
} from "./types";
import { formatDate, normaliseDomain } from "./utils";

export async function listBrands(): Promise<Brand[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("brands").select("*").order("created_at");
  if (error) throw error;
  return data as Brand[];
}

export async function getBrand(brandId: string): Promise<Brand | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("brands").select("*").eq("id", brandId).maybeSingle();
  if (error) throw error;
  return data as Brand | null;
}

/** First brand, used as the default selection. */
export async function getDefaultBrand(): Promise<Brand | null> {
  const brands = await listBrands();
  return brands[0] ?? null;
}

export async function listCompetitors(brandId: string): Promise<Competitor[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at");
  if (error) throw error;
  return data as Competitor[];
}

export async function listPromptsWithConfig(brandId: string): Promise<PromptWithConfig[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("tracked_prompts")
    .select("*, prompt_platform_config(*)")
    .eq("brand_id", brandId)
    .order("created_at");
  if (error) throw error;
  return data as PromptWithConfig[];
}

export interface SnapshotFilters {
  platform?: Platform;
  brandMentioned?: boolean;
  sentiment?: string;
  promptId?: string;
  since?: string; // ISO date
  limit?: number;
}

export async function listSnapshots(
  brandId: string,
  filters: SnapshotFilters = {},
): Promise<ResponseSnapshot[]> {
  const supabase = getAdminClient();
  let q = supabase
    .from("response_snapshots")
    .select("*")
    .eq("brand_id", brandId)
    .order("fetched_at", { ascending: false });

  if (filters.platform) q = q.eq("platform", filters.platform);
  if (filters.brandMentioned !== undefined) q = q.eq("brand_mentioned", filters.brandMentioned);
  if (filters.sentiment) q = q.eq("brand_sentiment", filters.sentiment);
  if (filters.promptId) q = q.eq("prompt_id", filters.promptId);
  if (filters.since) q = q.gte("fetched_at", filters.since);
  q = q.limit(filters.limit ?? 500);

  const { data, error } = await q;
  if (error) throw error;
  return data as ResponseSnapshot[];
}

export async function getSnapshot(id: string): Promise<ResponseSnapshot | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("response_snapshots")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as ResponseSnapshot | null;
}

// ---------------------------------------------------------------------------
// Dashboard aggregations (computed in JS from fetched rows)
// ---------------------------------------------------------------------------
export interface OverviewKpis {
  visibilityScore: number; // mention rate as a 0-100 score
  mentionRate: number;
  totalSnapshots: number;
  platformsTracked: number;
  lastUpdated: string | null;
}

export interface TrendPoint {
  date: string;
  chatgpt: number;
  claude: number;
  gemini: number;
  perplexity: number;
}

export interface PlatformBreakdown {
  platform: Platform;
  total: number;
  mentioned: number;
  rate: number;
}

export interface OverviewData {
  kpis: OverviewKpis;
  trend: TrendPoint[];
  breakdown: PlatformBreakdown[];
}

export async function getOverview(brandId: string, days = 30): Promise<OverviewData> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const snapshots = await listSnapshots(brandId, { since, limit: 5000 });

  const total = snapshots.length;
  const mentioned = snapshots.filter((s) => s.brand_mentioned).length;
  const mentionRate = total ? (mentioned / total) * 100 : 0;
  const platformsTracked = new Set(snapshots.map((s) => s.platform)).size;
  const lastUpdated = snapshots[0]?.fetched_at ?? null;

  // Trend grouped by day
  const byDay = new Map<string, { total: Record<Platform, number>; hit: Record<Platform, number> }>();
  const emptyCounts = () =>
    Object.fromEntries(PLATFORMS.map((p) => [p, 0])) as Record<Platform, number>;

  for (const s of snapshots) {
    const day = s.fetched_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, { total: emptyCounts(), hit: emptyCounts() });
    const entry = byDay.get(day)!;
    entry.total[s.platform] += 1;
    if (s.brand_mentioned) entry.hit[s.platform] += 1;
  }

  const trend: TrendPoint[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total: t, hit }]) => {
      const rate = (p: Platform) => (t[p] ? Math.round((hit[p] / t[p]) * 100) : 0);
      return {
        date,
        chatgpt: rate("chatgpt"),
        claude: rate("claude"),
        gemini: rate("gemini"),
        perplexity: rate("perplexity"),
      };
    });

  // Platform breakdown
  const breakdown: PlatformBreakdown[] = PLATFORMS.map((platform) => {
    const rows = snapshots.filter((s) => s.platform === platform);
    const t = rows.length;
    const m = rows.filter((s) => s.brand_mentioned).length;
    return { platform, total: t, mentioned: m, rate: t ? (m / t) * 100 : 0 };
  });

  return {
    kpis: {
      visibilityScore: Math.round(mentionRate),
      mentionRate,
      totalSnapshots: total,
      platformsTracked,
      lastUpdated,
    },
    trend,
    breakdown,
  };
}

export async function listSovSnapshots(brandId: string): Promise<CompetitorSovSnapshot[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("competitor_sov_snapshots")
    .select("*")
    .eq("brand_id", brandId)
    .order("snapshot_date");
  if (error) throw error;
  return data as CompetitorSovSnapshot[];
}

export interface BenchmarkSchedule {
  lastRunDate: string | null;
  runCount: number;
  /** Human-readable guidance for when to run next. */
  recommendation: string;
}

export function benchmarkScheduleFromSnapshots(
  snapshots: CompetitorSovSnapshot[],
): BenchmarkSchedule {
  const dates = [...new Set(snapshots.map((s) => s.snapshot_date))].sort();
  const lastRunDate = dates.at(-1) ?? null;
  const runCount = dates.length;

  if (!lastRunDate) {
    return {
      lastRunDate: null,
      runCount: 0,
      recommendation:
        "Run once after your first response collection to establish an industry baseline. " +
        "After that, run weekly or monthly — benchmarking uses a separate paid API (~$0.70 per run).",
    };
  }

  const daysSince = Math.floor(
    (Date.now() - new Date(lastRunDate).getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSince >= 30) {
    return {
      lastRunDate,
      runCount,
      recommendation: `Last run was ${daysSince} days ago — due for a monthly refresh.`,
    };
  }
  if (daysSince >= 7) {
    return {
      lastRunDate,
      runCount,
      recommendation: `Last run was ${daysSince} days ago — consider a weekly refresh.`,
    };
  }

  const nextWeekly = new Date(lastRunDate);
  nextWeekly.setDate(nextWeekly.getDate() + 7);
  return {
    lastRunDate,
    runCount,
    recommendation: `Up to date. Next recommended run: ${formatDate(nextWeekly)} (weekly) or monthly thereafter.`,
  };
}

export async function getBenchmarkSchedule(brandId: string): Promise<BenchmarkSchedule> {
  const snapshots = await listSovSnapshots(brandId);
  return benchmarkScheduleFromSnapshots(snapshots);
}

export async function listCitationDomains(brandId: string): Promise<CitationDomain[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("citation_domains")
    .select("*")
    .eq("brand_id", brandId)
    .order("mention_count", { ascending: false });
  if (error) throw error;
  return data as CitationDomain[];
}

/** Domains cited in collected LLM responses (live response snapshots). */
export async function getSnapshotCitationDomains(
  brandId: string,
  brandDomain: string,
): Promise<Array<{ domain: string; mention_count: number; is_own_domain: boolean }>> {
  const snapshots = await listSnapshots(brandId, { limit: 5000 });
  const ownRoot = normaliseDomain(brandDomain);
  const counts = new Map<string, number>();

  for (const snap of snapshots) {
    const links = collectAllCitations(snap.response_text, snap.cited_urls, snap.raw_response);
    for (const link of links) {
      const domain = normaliseDomain(link.url);
      if (!domain) continue;
      counts.set(domain, (counts.get(domain) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([domain, mention_count]) => ({
      domain,
      mention_count,
      is_own_domain: domain === ownRoot,
    }))
    .sort((a, b) => b.mention_count - a.mention_count);
}

export interface SnapshotSovRow {
  domain: string;
  is_own: boolean;
  mentions: number;
  share_of_voice: number;
}

/** Mention share computed from collected responses (brand + known competitors). */
export async function getSnapshotSov(
  brandId: string,
  brand: Brand,
  competitors: Competitor[],
): Promise<SnapshotSovRow[]> {
  const snapshots = await listSnapshots(brandId, { limit: 5000 });
  const ownDomain = normaliseDomain(brand.domain);
  const counts = new Map<string, number>();
  counts.set(ownDomain, 0);
  for (const c of competitors) counts.set(normaliseDomain(c.domain), 0);

  for (const snap of snapshots) {
    if (snap.brand_mentioned) counts.set(ownDomain, (counts.get(ownDomain) ?? 0) + 1);
    for (const d of snap.competitors_mentioned ?? []) {
      const key = normaliseDomain(d);
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const total = [...counts.values()].reduce((s, n) => s + n, 0) || 1;
  return [...counts.entries()]
    .map(([domain, mentions]) => ({
      domain,
      is_own: domain === ownDomain,
      mentions,
      share_of_voice: Number(((mentions / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.share_of_voice - a.share_of_voice);
}

export async function listActionItems(brandId: string): Promise<ActionItem[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("action_items")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ActionItem[];
}

export interface FanOutGroup {
  query: string;
  count: number;
  prompts: Set<string>;
}

export async function getFanOutQueries(brandId: string) {
  const snapshots = await listSnapshots(brandId, { limit: 5000 });
  const map = new Map<string, { count: number; promptIds: Set<string> }>();
  for (const s of snapshots) {
    for (const q of s.fan_out_queries ?? []) {
      if (!map.has(q)) map.set(q, { count: 0, promptIds: new Set() });
      const e = map.get(q)!;
      e.count += 1;
      if (s.prompt_id) e.promptIds.add(s.prompt_id);
    }
  }
  return [...map.entries()]
    .map(([query, { count, promptIds }]) => ({ query, count, promptCount: promptIds.size }))
    .sort((a, b) => b.count - a.count);
}

/** Map of prompt_id -> most recent snapshot timestamp for a brand. */
export async function getPromptLastChecked(brandId: string): Promise<Record<string, string>> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("response_snapshots")
    .select("prompt_id, fetched_at")
    .eq("brand_id", brandId)
    .order("fetched_at", { ascending: false })
    .limit(5000);
  if (error) throw error;

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.prompt_id && !map[row.prompt_id]) map[row.prompt_id] = row.fetched_at;
  }
  return map;
}

export interface CategoryPerformance {
  category: string;
  total: number;
  mentioned: number;
  rate: number;
}

export async function getCategoryPerformance(brandId: string): Promise<CategoryPerformance[]> {
  const supabase = getAdminClient();
  const { data: prompts } = await supabase
    .from("tracked_prompts")
    .select("id, category")
    .eq("brand_id", brandId);
  const catByPrompt = new Map((prompts ?? []).map((p) => [p.id, p.category ?? "uncategorised"]));

  const snapshots = await listSnapshots(brandId, { limit: 5000 });
  const map = new Map<string, { total: number; mentioned: number }>();
  for (const s of snapshots) {
    const cat = s.prompt_id ? catByPrompt.get(s.prompt_id) ?? "uncategorised" : "uncategorised";
    if (!map.has(cat)) map.set(cat, { total: 0, mentioned: 0 });
    const e = map.get(cat)!;
    e.total += 1;
    if (s.brand_mentioned) e.mentioned += 1;
  }
  return [...map.entries()]
    .map(([category, { total, mentioned }]) => ({
      category,
      total,
      mentioned,
      rate: total ? (mentioned / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
