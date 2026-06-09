import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS, type Platform, type Sentiment } from "@/lib/constants";
import { cn } from "@/lib/utils";

const PLATFORM_BADGE: Record<Platform, string> = {
  chatgpt: "bg-[#10a37f]/15 text-[#0d8a6a] dark:text-[#34d3aa]",
  claude: "bg-[#d97757]/15 text-[#c25b3a] dark:text-[#e89b80]",
  gemini: "bg-[#4285f4]/15 text-[#3367d6] dark:text-[#8ab4f8]",
  perplexity: "bg-[#20b8cd]/15 text-[#1a93a5] dark:text-[#5fd5e3]",
};

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        PLATFORM_BADGE[platform],
      )}
    >
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

export function SentimentBadge({ sentiment }: { sentiment: Sentiment | null }) {
  if (!sentiment) return <span className="text-xs text-muted-foreground">—</span>;
  const variant =
    sentiment === "positive" ? "success" : sentiment === "negative" ? "destructive" : "muted";
  return (
    <Badge variant={variant} className="capitalize">
      {sentiment}
    </Badge>
  );
}

export function MentionBadge({ mentioned }: { mentioned: boolean | null }) {
  if (mentioned) return <Badge variant="success">Mentioned</Badge>;
  return <Badge variant="muted">Absent</Badge>;
}
