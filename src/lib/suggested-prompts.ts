import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { PromptCategory } from "./constants";
import { PROMPT_CATEGORIES } from "./constants";
import type { Brand, Competitor } from "./types";

export interface SuggestedPrompt {
  prompt_text: string;
  category: PromptCategory;
  rationale: string;
}

const SuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      prompt_text: z.string(),
      category: z.enum(PROMPT_CATEGORIES),
      rationale: z.string(),
    }),
  ),
});

function normalisePrompt(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupeSuggestions(
  suggestions: SuggestedPrompt[],
  existingPrompts: string[],
): SuggestedPrompt[] {
  const existing = new Set(existingPrompts.map(normalisePrompt));
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const key = normalisePrompt(s.prompt_text);
    if (existing.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function primaryTopic(brand: Brand): string {
  if (brand.categories.length) return brand.categories[0];
  if (brand.industry) return brand.industry;
  if (brand.products.length) return brand.products[0].name;
  if (brand.services.length) return brand.services[0].name;
  return "software";
}

function buildTemplateSuggestions(brand: Brand, competitors: Competitor[]): SuggestedPrompt[] {
  const topic = primaryTopic(brand);
  const topicLower = topic.toLowerCase();
  const audience =
    brand.company_size?.toLowerCase().includes("enterprise")
      ? "enterprise teams"
      : "small businesses";
  const competitor = competitors[0]?.name ?? competitors[0]?.domain?.split(".")[0] ?? "leading alternatives";
  const product =
    brand.products[0]?.name ?? brand.services[0]?.name ?? topic;
  const descHint = brand.description ? ` Context: ${brand.description}` : "";

  const out: SuggestedPrompt[] = [
    {
      prompt_text: `What is the best ${topicLower} for ${audience}?`,
      category: "commercial",
      rationale: `Commercial intent — how AI recommends ${topicLower} options to ${audience}.`,
    },
    {
      prompt_text: `How do I choose a ${topicLower} platform?`,
      category: "informational",
      rationale: "Informational intent — early-stage research queries.",
    },
    {
      prompt_text: `What is ${brand.name} and what does it do?`,
      category: "navigational",
      rationale: "Navigational intent — brand awareness and positioning.",
    },
    {
      prompt_text: `${brand.name} vs ${competitor} — which is better?`,
      category: "brand",
      rationale: "Direct brand comparison against a known competitor.",
    },
    {
      prompt_text: `Top ${topicLower} tools for sales teams in 2026`,
      category: "commercial",
      rationale: "List-style commercial query common in AI answers.",
    },
    {
      prompt_text: `Is ${brand.name} worth it for ${audience}?`,
      category: "commercial",
      rationale: "Evaluation query — surfaces sentiment and recommendation language.",
    },
    {
      prompt_text: `What are the main alternatives to ${brand.name}?`,
      category: "brand",
      rationale: "Surfaces competitor set when users ask for alternatives.",
    },
    {
      prompt_text: `How does ${product} compare to other ${topicLower} solutions?${descHint}`,
      category: "informational",
      rationale: "Product-level comparison using brand knowledge.",
    },
  ];

  for (const cat of brand.categories.slice(1, 4)) {
    out.push({
      prompt_text: `What are the best ${cat.toLowerCase()} options?`,
      category: "commercial",
      rationale: `Category-specific commercial query from brand profile (${cat}).`,
    });
  }

  for (const comp of competitors.slice(1, 3)) {
    const name = comp.name ?? comp.domain.split(".")[0];
    out.push({
      prompt_text: `${brand.name} or ${name} — which should I choose?`,
      category: "brand",
      rationale: `Head-to-head against ${name}.`,
    });
  }

  return out;
}

async function buildAiSuggestions(
  brand: Brand,
  competitors: Competitor[],
  existingPrompts: string[],
): Promise<SuggestedPrompt[] | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;

  const context = {
    name: brand.name,
    domain: brand.domain,
    description: brand.description,
    industry: brand.industry,
    tagline: brand.tagline,
    value_proposition: brand.value_proposition,
    categories: brand.categories,
    products: brand.products.map((p) => p.name),
    services: brand.services.map((s) => s.name),
    competitors: competitors.map((c) => c.name ?? c.domain),
    existing_prompts: existingPrompts,
  };

  const openaiModel = process.env.OPENAI_MODEL || "gpt-4o";
  const { object } = await generateObject({
    model: openai(openaiModel),
    schema: SuggestionsSchema,
    prompt: `You are an AI visibility strategist. Suggest 8–12 realistic user prompts that people would ask ChatGPT, Claude, Gemini, or Perplexity when researching this brand and its market.

Brand context (JSON):
${JSON.stringify(context, null, 2)}

Rules:
- Mix categories: informational, commercial, navigational, brand
- Prompts must sound like real user questions, not marketing copy
- Do NOT duplicate any existing_prompts (rephrase if similar intent)
- Cover: best-of lists, comparisons, how-to-choose, brand-specific, alternatives
- Use the brand's industry, products, and categories when available
- Include competitor comparisons where competitors are known
- Each rationale: one short sentence explaining why this prompt matters for visibility tracking`,
  });

  return object.suggestions;
}

export async function generateSuggestedPrompts(
  brand: Brand,
  competitors: Competitor[],
  existingPrompts: string[],
): Promise<{ suggestions: SuggestedPrompt[]; source: "ai" | "templates" }> {
  let suggestions: SuggestedPrompt[] = [];
  let source: "ai" | "templates" = "templates";

  try {
    const ai = await buildAiSuggestions(brand, competitors, existingPrompts);
    if (ai?.length) {
      suggestions = ai;
      source = "ai";
    }
  } catch {
    // Fall through to templates
  }

  if (!suggestions.length) {
    suggestions = buildTemplateSuggestions(brand, competitors);
  }

  return {
    suggestions: dedupeSuggestions(suggestions, existingPrompts).slice(0, 12),
    source,
  };
}
