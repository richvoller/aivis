export const PLATFORMS = ["chatgpt", "claude", "gemini", "perplexity"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

// Tailwind-friendly hex colours used across charts + badges.
export const PLATFORM_COLORS: Record<Platform, string> = {
  chatgpt: "#10a37f",
  claude: "#d97757",
  gemini: "#4285f4",
  perplexity: "#20b8cd",
};

/**
 * Default model per platform. The plan notes each platform exposes a `/models`
 * endpoint; these are sensible defaults the user can override per prompt.
 */
export const DEFAULT_MODELS: Record<Platform, string> = {
  chatgpt: "gpt-5.5",
  claude: "claude-sonnet-4-6",
  gemini: "gemini-3.5-flash",
  perplexity: "sonar-reasoning-pro",
};

/** Curated list — DataForSEO exposes more via each platform's /models endpoint. */
export const PLATFORM_MODEL_OPTIONS: Record<Platform, string[]> = {
  chatgpt: ["gpt-5.5", "gpt-5.4", "gpt-5.2", "gpt-5.1", "gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4o"],
  claude: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-opus-4-6", "claude-opus-4-5"],
  gemini: ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash"],
  perplexity: ["sonar-reasoning-pro", "sonar-pro", "sonar"],
};

export const PROMPT_CATEGORIES = [
  "informational",
  "commercial",
  "navigational",
  "brand",
] as const;
export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export const SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const SENTIMENT_COLORS: Record<Sentiment, string> = {
  positive: "#16a34a",
  neutral: "#64748b",
  negative: "#dc2626",
};

export const SEVERITIES = ["high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];
