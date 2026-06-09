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
  chatgpt: "gpt-4o",
  claude: "claude-sonnet-4-6",
  gemini: "gemini-2.0-flash",
  perplexity: "sonar-reasoning-pro",
};

export const PLATFORM_MODEL_OPTIONS: Record<Platform, string[]> = {
  chatgpt: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o3"],
  claude: ["claude-sonnet-4-6", "claude-opus-4-1", "claude-haiku-4-5"],
  gemini: ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash"],
  perplexity: ["sonar", "sonar-pro", "sonar-reasoning-pro"],
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
