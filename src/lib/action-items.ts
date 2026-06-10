import "server-only";
import { revalidatePath } from "next/cache";
import { PLATFORM_LABELS, type Severity } from "./constants";
import { getAdminClient } from "./supabase/admin";
import {
  getCategoryPerformance,
  getFanOutQueries,
  getOverview,
  getSnapshotCitationDomains,
  getSnapshotSov,
  listCitationDomains,
  listCompetitors,
  listPromptsWithConfig,
  listSnapshots,
} from "./queries";
import type { Brand, Competitor, ResponseSnapshot, TrackedPrompt } from "./types";
import { normaliseDomain, pct } from "./utils";

export type ActionCategory = "visibility" | "citation" | "sentiment" | "competitor" | "content";

export interface DraftActionItem {
  title: string;
  detail: string;
  severity: Severity;
  category: ActionCategory;
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "to", "of", "in", "on", "with", "is", "are",
  "your", "you", "what", "how", "can", "best", "top", "vs", "vs.", "uk", "us",
]);

function sortDrafts(items: DraftActionItem[]): DraftActionItem[] {
  return [...items].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

function truncate(text: string, max = 120): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function promptMentionStats(
  snapshots: ResponseSnapshot[],
  prompts: TrackedPrompt[],
): Array<{ prompt: TrackedPrompt; total: number; mentioned: number; rate: number }> {
  const byId = new Map(prompts.map((p) => [p.id, p]));
  const stats = new Map<string, { total: number; mentioned: number }>();

  for (const s of snapshots) {
    if (!s.prompt_id) continue;
    if (!stats.has(s.prompt_id)) stats.set(s.prompt_id, { total: 0, mentioned: 0 });
    const e = stats.get(s.prompt_id)!;
    e.total += 1;
    if (s.brand_mentioned) e.mentioned += 1;
  }

  return [...stats.entries()]
    .map(([id, { total, mentioned }]) => {
      const prompt = byId.get(id);
      if (!prompt) return null;
      return {
        prompt,
        total,
        mentioned,
        rate: total ? (mentioned / total) * 100 : 0,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.rate - b.rate);
}

function fanOutUncovered(
  fanOut: Array<{ query: string; count: number }>,
  promptTexts: string[],
): Array<{ query: string; count: number }> {
  const corpus = promptTexts.join(" ").toLowerCase();
  return fanOut.filter(({ query }) => {
    const words = query
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
    if (!words.length) return false;
    const hits = words.filter((w) => corpus.includes(w)).length;
    return hits / words.length < 0.35;
  });
}

/** Pure gap analysis — no external API calls. */
export function analyzeVisibilityGaps(args: {
  brand: Brand;
  competitors: Competitor[];
  snapshots: ResponseSnapshot[];
  prompts: TrackedPrompt[];
  overview: Awaited<ReturnType<typeof getOverview>>;
  citationDomains: Awaited<ReturnType<typeof getSnapshotCitationDomains>>;
  industryCitations: Awaited<ReturnType<typeof listCitationDomains>>;
  responseSov: Awaited<ReturnType<typeof getSnapshotSov>>;
  categories: Awaited<ReturnType<typeof getCategoryPerformance>>;
  fanOut: Awaited<ReturnType<typeof getFanOutQueries>>;
}): DraftActionItem[] {
  const {
    brand,
    competitors,
    snapshots,
    prompts,
    overview,
    citationDomains,
    industryCitations,
    responseSov,
    categories,
    fanOut,
  } = args;

  const items: DraftActionItem[] = [];
  const ownDomain = normaliseDomain(brand.domain);
  const total = snapshots.length;

  if (total < 4) {
    return [
      {
        title: "Collect more response data",
        detail:
          `Only ${total} response snapshot${total === 1 ? "" : "s"} so far. Run collection on your tracked prompts ` +
          "to unlock platform, citation, and competitor recommendations.",
        severity: "low",
        category: "visibility",
      },
    ];
  }

  const mentionRate = overview.kpis.mentionRate;

  if (mentionRate < 25) {
    items.push({
      title: "Low overall AI visibility",
      detail:
        `${brand.name} is mentioned in only ${pct(mentionRate, 0)} of collected responses (${overview.kpis.totalSnapshots} snapshots). ` +
        "Prioritise authoritative content on your site that answers the exact questions in your tracked prompts.",
      severity: "high",
      category: "visibility",
    });
  } else if (mentionRate < 50) {
    items.push({
      title: "Moderate visibility — room to improve",
      detail:
        `${brand.name} appears in ${pct(mentionRate, 0)} of responses. Compare high-performing prompts in Categories ` +
        "and expand coverage on prompts where competitors appear but you do not.",
      severity: "medium",
      category: "visibility",
    });
  }

  const bestPlatform = [...overview.breakdown].sort((a, b) => b.rate - a.rate)[0];
  for (const row of overview.breakdown) {
    if (row.total < 3) continue;
    if (row.rate === 0) {
      items.push({
        title: `Absent on ${PLATFORM_LABELS[row.platform]}`,
        detail:
          `${brand.name} was not mentioned in any of ${row.total} ${PLATFORM_LABELS[row.platform]} responses. ` +
          "Review whether this platform favours web-grounded answers and ensure your site has crawlable, citable pages for these topics.",
        severity: "high",
        category: "visibility",
      });
    } else if (bestPlatform && bestPlatform.rate >= 40 && row.rate < 15 && row.platform !== bestPlatform.platform) {
      items.push({
        title: `Weak on ${PLATFORM_LABELS[row.platform]} vs ${PLATFORM_LABELS[bestPlatform.platform]}`,
        detail:
          `Mention rate on ${PLATFORM_LABELS[row.platform]} is ${pct(row.rate, 0)} (${row.mentioned}/${row.total}) ` +
          `compared with ${pct(bestPlatform.rate, 0)} on ${PLATFORM_LABELS[bestPlatform.platform]}. ` +
          "Check Responses for this platform to see which competitors are being recommended instead.",
        severity: "high",
        category: "visibility",
      });
    }
  }

  const ownSov = responseSov.find((r) => r.is_own);
  const leadingCompetitor = responseSov.find((r) => !r.is_own && r.mentions > (ownSov?.mentions ?? 0));
  if (leadingCompetitor && (ownSov?.mentions ?? 0) < leadingCompetitor.mentions) {
    items.push({
      title: `${leadingCompetitor.domain} mentioned more often than you`,
      detail:
        `In collected responses, ${leadingCompetitor.domain} appears ${leadingCompetitor.mentions} times vs ` +
        `${ownSov?.mentions ?? 0} for ${ownDomain}. Review Responses where competitors are cited and close the positioning gap.`,
      severity: leadingCompetitor.mentions >= (ownSov?.mentions ?? 0) * 2 ? "high" : "medium",
      category: "competitor",
    });
  }

  if (!competitors.length) {
    items.push({
      title: "Add known competitors",
      detail:
        "No competitors are configured. Add competitor domains on the Competitors page so share-of-voice " +
        "and mention tracking can flag who is winning your prompts.",
      severity: "medium",
      category: "competitor",
    });
  }

  const promptStats = promptMentionStats(snapshots, prompts);
  const blindPrompts = promptStats.filter((p) => p.total >= 2 && p.mentioned === 0);
  for (const { prompt, total: t } of blindPrompts.slice(0, 3)) {
    items.push({
      title: "Invisible on a tracked prompt",
      detail:
        `"${truncate(prompt.prompt_text)}" — ${brand.name} was not mentioned in any of ${t} collected responses. ` +
        "Create or optimise a page that directly answers this query, then re-collect to measure impact.",
      severity: "high",
      category: "content",
    });
  }

  const commercial = categories.find((c) => c.category === "commercial");
  const informational = categories.find((c) => c.category === "informational");
  if (commercial && commercial.total >= 4 && commercial.rate < 20) {
    items.push({
      title: "Weak on commercial-intent prompts",
      detail:
        `Commercial prompts have a ${pct(commercial.rate, 0)} mention rate` +
        (informational && informational.rate > commercial.rate + 25
          ? ` vs ${pct(informational.rate, 0)} on informational queries.`
          : ".") +
        " Strengthen product and comparison pages — LLMs favour clear, citable commercial content for buying queries.",
      severity: "high",
      category: "content",
    });
  }

  const ownCitations = citationDomains.find((d) => d.is_own_domain)?.mention_count ?? 0;
  const topThirdParty = citationDomains.filter((d) => !d.is_own_domain).slice(0, 5);
  if (topThirdParty.length && ownCitations === 0) {
    const top = topThirdParty.slice(0, 3).map((d) => d.domain).join(", ");
    items.push({
      title: "Your domain is never cited",
      detail:
        `LLMs cite third-party domains (${top}) but not ${ownDomain} in collected responses. ` +
        "Publish definitive guides, specs, or comparison content that models can reference with a direct URL.",
      severity: "high",
      category: "citation",
    });
  }

  for (const cited of topThirdParty.slice(0, 3)) {
    const isCompetitor = competitors.some(
      (c) => normaliseDomain(c.domain) === cited.domain,
    );
    if (isCompetitor && cited.mention_count >= 2) {
      const name = competitors.find((c) => normaliseDomain(c.domain) === cited.domain)?.name ?? cited.domain;
      items.push({
        title: `Competitor cited: ${cited.domain}`,
        detail:
          `${name} (${cited.domain}) is cited ${cited.mention_count} times across your responses while your visibility on those prompts may be low. ` +
          "See Citations and Responses for pages earning those links.",
        severity: "medium",
        category: "citation",
      });
    }
  }

  const reviewSites = ["g2.com", "capterra.com", "trustpilot.com", "producthunt.com"];
  for (const site of reviewSites) {
    const hit = citationDomains.find((d) => d.domain === site || d.domain.endsWith(`.${site}`));
    if (hit && hit.mention_count >= 2 && ownCitations < hit.mention_count) {
      items.push({
        title: `Citation gap on ${site}`,
        detail:
          `Models cite ${site} ${hit.mention_count} times in your prompt space. If ${brand.name} has reviews or listings there, ` +
          "ensure profiles are complete; if not, this is a third-party coverage opportunity.",
        severity: "medium",
        category: "citation",
      });
    }
  }

  const industryGap = industryCitations
    .filter((d) => !d.is_own_domain)
    .find(
      (d) =>
        (d.mention_count ?? 0) >= 5 &&
        !citationDomains.some(
          (c) => normaliseDomain(c.domain) === normaliseDomain(d.domain),
        ),
    );
  if (industryGap) {
    items.push({
      title: `Industry cites ${industryGap.domain} — you don't`,
      detail:
        `The LLM Mentions dataset shows ${industryGap.domain} as a top cited domain for your space, ` +
        "but it does not appear in your collected responses. Consider coverage or partnerships on that domain.",
      severity: "medium",
      category: "citation",
    });
  }

  const negative = snapshots.filter((s) => s.brand_mentioned && s.brand_sentiment === "negative");
  if (negative.length >= 1) {
    items.push({
      title: "Negative sentiment detected",
      detail:
        `${brand.name} was mentioned with negative framing in ${negative.length} response${negative.length === 1 ? "" : "s"}. ` +
        "Review those responses and address factual gaps or positioning issues in your public content.",
      severity: "medium",
      category: "sentiment",
    });
  }

  const uncovered = fanOutUncovered(
    fanOut.slice(0, 15),
    prompts.map((p) => p.prompt_text),
  );
  for (const { query, count } of uncovered.slice(0, 2)) {
    items.push({
      title: "Fan-out query not covered by your prompts",
      detail:
        `LLMs internally research "${truncate(query, 90)}" (${count} occurrence${count === 1 ? "" : "s"}) ` +
        "but none of your tracked prompts target it. Add a prompt on the Prompts page or expand site content for this angle.",
      severity: "medium",
      category: "content",
    });
  }

  const seen = new Set<string>();
  return sortDrafts(items.filter((item) => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  })).slice(0, 12);
}

export async function generateActionItemsForBrand(brandId: string): Promise<number> {
  const supabase = getAdminClient();

  const { data: brand, error: brandErr } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();
  if (brandErr) throw brandErr;

  const [competitors, snapshots, prompts, overview, citationDomains, industryCitations, categories, fanOut] =
    await Promise.all([
      listCompetitors(brandId),
      listSnapshots(brandId, { limit: 5000 }),
      listPromptsWithConfig(brandId),
      getOverview(brandId, 90),
      getSnapshotCitationDomains(brandId, (brand as Brand).domain),
      listCitationDomains(brandId),
      getCategoryPerformance(brandId),
      getFanOutQueries(brandId),
    ]);

  const responseSov = await getSnapshotSov(brandId, brand as Brand, competitors);

  const drafts = analyzeVisibilityGaps({
    brand: brand as Brand,
    competitors,
    snapshots,
    prompts,
    overview,
    citationDomains,
    industryCitations,
    responseSov,
    categories,
    fanOut,
  });

  await supabase
    .from("action_items")
    .delete()
    .eq("brand_id", brandId)
    .eq("is_done", false);

  if (drafts.length) {
    const { error: insertErr } = await supabase.from("action_items").insert(
      drafts.map((d) => ({
        brand_id: brandId,
        title: d.title,
        detail: d.detail,
        severity: d.severity,
        category: d.category,
      })),
    );
    if (insertErr) throw insertErr;
  }

  return drafts.length;
}

/** Regenerate open recommendations from latest snapshots (no API cost). */
export async function refreshActionItemsForBrand(brandId: string): Promise<number> {
  const count = await generateActionItemsForBrand(brandId);
  revalidatePath("/action-items");
  revalidatePath("/", "layout");
  return count;
}
