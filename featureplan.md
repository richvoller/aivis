# AI Search Optimisation Internal Tool — Build Plan

> **Version 2 — Corrected & Final**
> Incorporates accurate DataForSEO API structure: LLM Responses API (live calls to Claude, Gemini, Perplexity, ChatGPT) as the primary monitoring engine, with LLM Mentions API (Google AIO + ChatGPT dataset) for discovery and benchmarking.

***

## Executive Summary

This document is a complete build plan for an internal AI search optimisation and prompt tracking tool modelled on [RankPrompt](https://rankprompt.com), powered by the DataForSEO AI Optimization API suite, and built on a Next.js + Supabase + Google Cloud stack deployed to Vercel.

**Core purpose:** Track how client brands appear (or don't appear) in AI-generated responses across ChatGPT, Claude, Gemini, and Perplexity — on a schedule, over time — and turn that data into actionable GEO (Generative Engine Optimisation) strategy.

***

## Part 1: What RankPrompt Actually Does

RankPrompt is a dedicated Answer Engine Optimisation (AEO) platform that monitors how brands are mentioned, cited, or recommended in major LLM responses, and turns that into structured reports and recommendations.[^1][^2]

### Core Feature Set

**AI Visibility Tracking & Scoring**
- Assigns an "AI Visibility Score" — a quantified metric for brand mention frequency and prominence across AI platforms[^2]
- Tracks brand presence across ChatGPT, Gemini, Perplexity, Claude, Grok, and Google AI Mode[^2]
- Monitors prompt rank changes over time with stored historical data[^2]

**Prompt Intelligence**
- Analyses real user intents and prompts, mapping them to visibility gaps[^1]
- Identifies which prompts include your brand vs. which show competitors instead[^1]
- Tracks "prompt-level" rank changes over time[^2]

**Competitor Benchmarking**
- Compares brand share of voice against up to N competitors[^1]
- Weekly/monthly trend comparison[^2]

**Citation Discovery & Analysis**
- Detects which third-party pages AI models cite when answering prompts about your space[^2]
- Maps citation sources by topic and intent[^2]
- Identifies high-impact pages to target for citation inclusion[^3]

**Content & Optimisation Recommendations**
- Suggests AI-retrievable content formats (structured lists, comparisons, factual briefs)[^2]
- Generates prioritised to-do list of fixes based on visibility data[^4]

**Monitoring & Reporting**
- Scheduled scans with automated weekly/monthly reports[^2]
- Alerts for visibility shifts[^2]

**Known Limitations (from independent reviews)**
RankPrompt's rank checker has been reported as unreliable — flagging sites as "Not Ranked" when they appear as #1 in a direct LLM query. Several features are marked "coming soon" at $30/month. Building internally means owning the data pipeline and eliminating these reliability gaps entirely.[^5]

***

## Part 2: The DataForSEO AI Optimization API Suite — Accurate Picture

DataForSEO's AI Optimization API suite contains **four distinct APIs**. Understanding which does what is critical to the architecture.[^6]

### The Four APIs

| API | What It Does | Platforms Covered |
|---|---|---|
| **LLM Responses API** | Makes **live calls** to each LLM with your prompt — returns the full structured response, sources, fan-out queries, reasoning chains | ChatGPT, Claude, Gemini, Perplexity[^6][^7] |
| **LLM Mentions API** | Searches a **pre-collected database** of AI responses for keyword/brand/domain mentions — with aggregated metrics | Google AIO (~247.6M prompts), ChatGPT (~21.9M prompts)[^8][^9] |
| **LLM Scraper API** | Scrapes ChatGPT search results directly — includes sponsored results[^10][^11] | ChatGPT only |
| **AI Keyword Data API** | Returns AI search volume and trend data for keywords across LLMs[^6] | ChatGPT, Google AIO |

### The Correct Workflow for This Tool

```
DISCOVERY (run periodically)
  LLM Mentions API → find what prompts/keywords your brand appears in
  AI Keyword Data API → find AI search volume for those keywords

MONITORING (run on schedule — this is the CORE)
  LLM Responses API → send tracked prompts to all 4 LLMs → store full responses
  Parse responses for: brand mentioned, sentiment, position, sources cited, competitors mentioned

BENCHMARKING (run weekly)
  LLM Mentions Cross Aggregated → compare brand vs competitors in Google AIO + ChatGPT dataset
  LLM Mentions Top Domains/Pages → find citation gap opportunities
```

### LLM Responses API — Key Details

Each platform has its **own dedicated endpoint**:[^7]
- `POST /v3/ai_optimization/chatgpt/llm_responses/live`
- `POST /v3/ai_optimization/claude/llm_responses/live`
- `POST /v3/ai_optimization/gemini/llm_responses/live`
- `POST /v3/ai_optimization/perplexity/llm_responses/live`

**Key request parameters** (from playground examples):
```json
{
  "model_name": "claude-sonnet-4-6",
  "user_prompt": "Your tracked prompt here",
  "max_output_tokens": 2048,
  "temperature": 0.7,
  "system_message": "You are a helpful assistant."
}
```

**Model selection:** Each platform endpoint has a companion `/models` endpoint that returns available model names. This means the UI should let users select which model per platform to use for tracking. Model names are platform-specific (e.g. `claude-sonnet-4-6`, `sonar-reasoning-pro` for Perplexity).[^12]

**Advanced features available:**
- `use_reasoning: true` — enables step-by-step reasoning chain output for Claude and Gemini[^12]
- `fan_out_queries` — the internal "research queries" the LLM generates before forming an answer, available for all four platforms[^13]
- Brand entity extraction — structured brand mention data returned automatically[^10]

### LLM Mentions API — Key Details

Five endpoints:[^9]
1. **Search Mentions** — full Q&A, cited sources, non-cited sources, AI search volume per keyword
2. **Aggregated Metrics** — total impressions, trends, most-cited domains (big picture view)
3. **Cross Aggregated Metrics** — multiple brands/domains side by side (competitor benchmarking)
4. **Top Domains** — most frequently cited domains for a keyword
5. **Top Pages** — most frequently cited individual URLs for a keyword

**Platform coverage:** Google AIO + ChatGPT only. All endpoints are live calls (~2 second response).[^8][^6][^9]

### Pricing

| Item | Cost |
|---|---|
| Minimum monthly commitment | $100 (credit usable across all DataForSEO APIs)[^8] |
| LLM Mentions: per request | $0.10 + $0.001 per row[^8] |
| LLM Responses: pricing | Per-call; check DataForSEO dashboard for current rates |
| Rate limits | 2,000 API calls/min, 30 simultaneous requests |

***

## Part 3: Tech Stack Recommendations

Given the existing setup (Google Cloud, Vercel, Next.js, Supabase), the stack below aligns with existing tools while being purpose-built for this data-heavy requirement.

### Full Recommended Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 15 (App Router) on Vercel | Existing stack; optimal for data dashboards[^14] |
| **UI Components** | shadcn/ui + Tailwind CSS | Copy-owned components, full control, excellent for internal tools[^15] |
| **Charts** | Recharts (via shadcn charts) | Line, bar, pie, area — built into shadcn, no extra dependency[^16] |
| **Data Tables** | TanStack Table v8 | Sorting, filtering, pagination for response/mention tables[^17] |
| **Primary Database** | Supabase (Postgres) | Stores brands, prompts, response snapshots, citations, competitors[^18] |
| **Job Scheduling** | Supabase Cron (pg_cron) | Triggers nightly/weekly DataForSEO batch jobs — no external scheduler needed[^19][^20] |
| **Background Processing** | Google Cloud Run | Handles batch LLM Responses jobs beyond Vercel's 60s function timeout[^21] |
| **Message Queue** | Google Cloud Pub/Sub | Decouples API fetch jobs; triggers Cloud Run workers reliably[^22] |
| **Historical Archive** | Google BigQuery | Long-term trend analysis across many brands/prompts over months[^23] |
| **Secret Management** | Google Secret Manager | DataForSEO API credentials stored securely[^24] |
| **Auth** | Supabase Auth | Email/password or Google OAuth — sufficient for internal tool[^18] |
| **State Management** | TanStack Query (React Query) | Caching and background refetching of dashboard data |
| **Forms** | Zod + React Hook Form | Prompt/brand/competitor config forms[^17] |
| **Deployment** | Vercel (web app) + Google Cloud (workers) | UI on Vercel; heavy processing on Cloud Run |

### Why Split Vercel + Google Cloud?

Vercel Pro functions time out at 60 seconds. LLM Responses calls can take up to 120 seconds per request, and a nightly batch job running 50 prompts × 4 platforms would be a multi-minute operation. The correct split:[^25][^6]

- **Vercel** → UI, auth, lightweight API proxying, manual single-prompt live lookups
- **Google Cloud Run** → scheduled batch jobs (nightly response collection, weekly mentions aggregation)
- **Cloud Pub/Sub** → queues individual prompt jobs so Cloud Run scales horizontally
- **Supabase Cron** → fires the nightly trigger via HTTP webhook to Cloud Run[^19]

***

## Part 4: Database Schema

### Core Tables

```sql
-- Brands/projects being tracked
brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  domain      text NOT NULL,
  created_at  timestamptz DEFAULT now()
)

-- Competitor domains per brand
competitors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid REFERENCES brands ON DELETE CASCADE,
  domain      text NOT NULL,
  name        text
)

-- Prompts to run against LLMs per brand
tracked_prompts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid REFERENCES brands ON DELETE CASCADE,
  prompt_text     text NOT NULL,
  category        text,          -- 'informational' | 'commercial' | 'navigational' | 'brand'
  location_code   int,           -- for LLM Mentions geo targeting
  language_code   text DEFAULT 'en',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
)

-- Per-platform model config per prompt (which model to use per LLM)
prompt_platform_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id     uuid REFERENCES tracked_prompts ON DELETE CASCADE,
  platform      text NOT NULL,   -- 'chatgpt' | 'claude' | 'gemini' | 'perplexity'
  model_name    text NOT NULL,   -- e.g. 'claude-sonnet-4-6', 'sonar-reasoning-pro'
  is_active     boolean DEFAULT true
)

-- Full LLM response snapshot (core tracking table)
response_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid REFERENCES brands,
  prompt_id           uuid REFERENCES tracked_prompts,
  platform            text NOT NULL,   -- 'chatgpt' | 'claude' | 'gemini' | 'perplexity'
  model_name          text NOT NULL,
  fetched_at          timestamptz DEFAULT now(),
  -- Parsed signal fields
  brand_mentioned     boolean,
  brand_sentiment     text,            -- 'positive' | 'neutral' | 'negative'
  brand_position      int,             -- position of first brand mention in response
  response_text       text,            -- full response text
  -- Competitor presence
  competitors_mentioned  text[],       -- array of competitor domains found in response
  -- Sources/citations
  cited_urls          text[],          -- URLs cited in the response
  fan_out_queries     text[],          -- internal queries the LLM generated
  -- Raw data — always store for re-processing
  raw_response        jsonb
)

-- LLM Mentions API snapshots (discovery + Google AIO benchmarking)
mention_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid REFERENCES brands,
  prompt_id           uuid REFERENCES tracked_prompts,
  fetched_at          timestamptz DEFAULT now(),
  platform            text,            -- 'chat_gpt' | 'google'
  mention_count       int,
  ai_search_volume    int,
  monthly_searches    int,
  raw_response        jsonb
)

-- Top cited domains from LLM Mentions API (citation gap analysis)
citation_domains (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid REFERENCES brands,
  snapshot_date   date,
  domain          text,
  mention_count   int,
  is_own_domain   boolean DEFAULT false,
  platform        text
)

-- Competitor share of voice (from Cross Aggregated Metrics)
competitor_sov_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid REFERENCES brands,
  snapshot_date       date,
  domain              text,            -- competitor or own domain
  mention_count       int,
  share_of_voice      numeric,         -- percentage
  platform            text
)
```

**Key design decisions:**
- `raw_response jsonb` is on every snapshot table — always store the full DataForSEO response so metrics can be re-derived later without re-calling the API[^3]
- `prompt_platform_config` lets you independently control which model each platform uses per prompt — giving full flexibility as models evolve
- Parsed signal fields (`brand_mentioned`, `brand_sentiment`, `brand_position`) are extracted at ingestion time so the UI can query them without parsing JSON on every request

***

## Part 5: System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    VERCEL (Next.js 15)                        │
│                                                              │
│  Dashboard    Prompt Manager    Live Lookup    Competitors   │
│  (charts,     (CRUD brands,     (single        (add/remove   │
│   KPI cards)   prompts, config)  on-demand      domains)     │
│                                  LLM call)                   │
│       │               │               │                      │
│       └───────────────┴───────────────┘                      │
│                        │ reads snapshots                      │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              SUPABASE (Postgres)                             │
│                                                              │
│  brands · competitors · tracked_prompts                      │
│  prompt_platform_config                                      │
│  response_snapshots · mention_snapshots                      │
│  citation_domains · competitor_sov_snapshots                 │
│                                                              │
│  [Supabase Cron - nightly]  ──▶  HTTP webhook               │
│  [Supabase Cron - weekly]   ──▶  HTTP webhook               │
└──────────────────────────────────────────────────────────────┘
                         │ webhooks
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              GOOGLE CLOUD                                    │
│                                                              │
│  Cloud Pub/Sub                                               │
│  (job queue — one message per prompt × platform)            │
│       │                                                      │
│       ▼                                                      │
│  Cloud Run (batch worker)                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │  For each prompt × platform:                        │     │
│  │  1. POST to LLM Responses API (Claude/Gemini/etc.) │     │
│  │  2. Parse brand_mentioned, sentiment, sources       │     │
│  │  3. Write response_snapshot to Supabase             │     │
│  │  4. Archive raw to BigQuery                         │     │
│  └────────────────────────────────────────────────────┘     │
│       │                                                      │
│       ▼                                                      │
│  Cloud Run (mentions worker — weekly)                       │
│  ┌────────────────────────────────────────────────────┐     │
│  │  1. LLM Mentions Search (per tracked prompt)        │     │
│  │  2. Cross Aggregated Metrics (brand vs competitors) │     │
│  │  3. Top Domains + Top Pages (citation analysis)     │     │
│  │  4. Write to mention_snapshots, citation_domains    │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  BigQuery  (long-term historical archive)                   │
│  Secret Manager  (DataForSEO API credentials)              │
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼
               DataForSEO AI Optimization API
               ┌─────────────┬──────────────┐
               │ LLM Responses│ LLM Mentions │
               │ (live calls) │ (dataset)    │
               │ ChatGPT      │ Google AIO   │
               │ Claude       │ ChatGPT      │
               │ Gemini       │              │
               │ Perplexity   │              │
               └─────────────┴──────────────┘
```

***

## Part 6: Dashboard Features & Views

Ordered by build priority.

### Priority 1 — Core MVP

**1. Overview Dashboard**
- AI Visibility Score per brand (brand_mentioned count / total snapshots × 100)
- KPI cards: Mention rate %, Total snapshots taken, Platforms tracked, Last updated
- Visibility trend line chart (30/60/90 day) — one line per platform
- Platform breakdown donut chart (ChatGPT vs Claude vs Gemini vs Perplexity)

**2. Prompt Manager**
- Table of all tracked prompts with category, status, last-checked date
- Add/edit/delete prompts
- Per-prompt: configure which platform + model to use
- Manual "Run Now" button — triggers a live single LLM Responses call and shows result instantly

**3. Response Explorer**
- Filterable table of all `response_snapshots`
- Filters: platform, date range, brand_mentioned (yes/no), sentiment
- Click any row → full response text displayed, with brand mentions highlighted
- Show fan-out queries for that response (what the LLM researched before answering)

**4. Competitor Management**
- Add/remove competitor domains per brand
- Feeds into the weekly Cross Aggregated Metrics job

### Priority 2 — Competitive & Citation Intelligence

**5. Competitor Benchmarking**
- Share of Voice chart: brand vs all competitors, per platform, over time
- Source: `competitor_sov_snapshots` from weekly LLM Mentions Cross Aggregated job
- Sortable table: competitor → mention count → SoV % → weekly delta

**6. Citation Analysis**
- Top cited domains table (from LLM Mentions Top Domains)
- Top cited pages table (from LLM Mentions Top Pages)
- Own domain vs third-party split
- Gap indicator: domains competitors are cited on but your brand isn't

**7. Fan-Out Query Explorer**
- Table of all `fan_out_queries` extracted from LLM Responses snapshots
- Grouped by prompt — shows what the LLM "researched" before answering your tracked prompt
- Surface these as keyword targeting opportunities

### Priority 3 — Insights & Reporting

**8. Prompt Category Performance**
- Group prompts by category (informational / commercial / navigational / brand)
- Visibility score and mention rate per category
- Identify weakest intent type for each brand

**9. Snapshot History & Date Comparison**
- Calendar heatmap of all data collection runs
- Select two dates: diff view showing what changed in brand visibility between them
- Sentiment shift tracking: was the brand described positively/neutrally/negatively?

**10. Action Items**
- Auto-generated recommendations based on gap analysis:
  - "Brand not appearing for 8 commercial prompts on Claude — review commercial page content"
  - "Competitor X is cited on [domain.com] for this topic — you have no coverage there"
- Mark tasks complete, track progress over sprints

**11. CSV Export**
- Export any table view for client reporting
- Export full snapshot history per brand per date range

***

## Part 7: Phase-by-Phase Build Plan

### Phase 0 — Foundation (Week 1–2)

- [ ] Scaffold Next.js 15 project (App Router) with shadcn/ui + Tailwind
- [ ] Set up Supabase: apply schema from Part 4, configure Row Level Security
- [ ] Set up Supabase Auth (email/password for internal access)
- [ ] Set up Google Cloud project: enable Cloud Run, Pub/Sub, BigQuery, Secret Manager
- [ ] Store DataForSEO credentials in Secret Manager
- [ ] Test DataForSEO Sandbox: fire a Claude LLM Responses call and a LLM Mentions Search call manually
- [ ] Confirm available model names per platform by calling each `/models` endpoint

### Phase 1 — Data Pipeline (Week 2–4)

- [ ] Build DataForSEO API wrapper (Node.js module):
  - `getLLMResponse(platform, model, prompt)` — calls the correct platform endpoint
  - `searchMentions(keyword, platform)` — LLM Mentions Search
  - `getAggregatedMetrics(domain)` — LLM Mentions Aggregated
  - `getCrossAggregated(domains[])` — LLM Mentions Cross Aggregated
  - `getTopDomains(keyword)` — LLM Mentions Top Domains
  - `getTopPages(keyword)` — LLM Mentions Top Pages
- [ ] Build response parser: extracts `brand_mentioned`, `sentiment`, `cited_urls`, `fan_out_queries`, `competitors_mentioned` from raw LLM response text
- [ ] Build Cloud Run batch worker (nightly LLM Responses job):
  - Reads all active `tracked_prompts` × `prompt_platform_config`
  - Pushes one Pub/Sub message per prompt × platform
  - Worker processes messages: calls API → parses → writes `response_snapshots`
- [ ] Build Cloud Run mentions worker (weekly):
  - Reads all active prompts, fires LLM Mentions calls
  - Writes `mention_snapshots`, `citation_domains`, `competitor_sov_snapshots`
- [ ] Configure Supabase Cron: nightly trigger at 02:00 UTC → Cloud Run webhook
- [ ] Verify BigQuery pipeline receives raw snapshots

### Phase 2 — Core UI (Week 3–5)

- [ ] Overview Dashboard: KPI cards + Recharts trend line + platform donut
- [ ] Prompt Manager: full CRUD with platform/model config per prompt
- [ ] Response Explorer: table with filters + full response modal
- [ ] "Run Now" live lookup: calls LLM Responses via Next.js API route, displays result in real time
- [ ] Brand and competitor management screens

### Phase 3 — Competitive Intelligence (Week 5–7)

- [ ] Share of Voice chart (Recharts area/bar) from competitor_sov_snapshots
- [ ] Top Domains / Top Pages citation tables
- [ ] Fan-Out Query Explorer
- [ ] Prompt category tagging and category-level performance view

### Phase 4 — Insights Layer (Week 7–9)

- [ ] Snapshot history calendar view + date comparison diff
- [ ] Sentiment tracking over time (per prompt, per platform)
- [ ] Auto-generated Action Items based on gap rules
- [ ] CSV export for all major table views

### Phase 5 — Operational Hardening (Week 9–10)

- [ ] API error handling and retry logic in batch worker (exponential backoff)
- [ ] DataForSEO cost tracking view (monitor spend vs. $100 monthly credit)
- [ ] Rate limiting guard in worker (respect 30 concurrent / 2,000/min limits)
- [ ] Cloud Logging + alerting for failed batch runs
- [ ] Dark mode (native to shadcn/ui)

***

## Part 8: Key Technical Decisions

### Storing Raw JSONB Responses

Every DataForSEO response — both LLM Responses and LLM Mentions — is stored in full as `jsonb`. This means: if the parsing logic is updated (e.g. a new way to extract sentiment, or a new field DataForSEO adds), all historical data can be re-processed without re-calling the API and incurring new costs. Never throw away raw API responses.[^3]

### Response Parsing Strategy

The LLM Responses API returns structured data — not just raw text. Brand mention detection should use a combination of:
1. **DataForSEO's built-in `brand_entities` field** — structured brand mentions extracted automatically[^10]
2. **String matching** on `response_text` for the brand domain/name as a fallback
3. **Sentiment inference** — either a simple positive/neutral/negative classification via a lightweight regex pattern on context sentences, or a secondary LLM call (keep costs in mind)

### Supabase Cron vs Vercel Cron

Vercel Cron Jobs on the Pro plan are limited and don't handle stateful batch processing well. Supabase Cron (pg_cron) runs natively within Postgres, integrates with the rest of the Supabase stack, and triggers HTTP webhooks reliably. It's simpler and cheaper than maintaining a separate scheduler.[^26][^20][^19]

### Share of Voice Calculation

\[ \text{SoV} = \frac{\text{brand mention count}}{\text{brand mentions} + \sum \text{competitor mentions}} \times 100 \]

The Cross Aggregated Metrics endpoint returns mention counts per domain in a single API call, making this a straightforward calculation done at ingestion time before writing to `competitor_sov_snapshots`.[^8]

***

## Part 9: Cost Estimate (Monthly)

| Item | Estimated Monthly Cost |
|---|---|
| DataForSEO minimum commitment | $100 (credit, not a fee)[^8] |
| DataForSEO LLM Responses usage (50 prompts × 4 platforms, daily) | ~$20–60 estimated |
| DataForSEO LLM Mentions usage (weekly benchmarking) | ~$10–20 estimated |
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Google Cloud Run (batch workers) | $5–15 |
| Google Cloud Pub/Sub + Scheduler | ~$1–2 |
| BigQuery (early stage, low volume) | $0–10 |
| **Total (internal, low volume)** | **~$180–250/month** |

LLM Responses calls are the dominant variable cost. Keep tracked prompt lists lean — every prompt × 4 platforms × 30 days = 120 API calls per prompt per month. Prioritise the most strategically important prompts first.

***

## Part 10: Advantages of Building vs. Using RankPrompt

| Area | RankPrompt | This Build |
|---|---|---|
| Data reliability | Reported inaccuracies[^5] | Direct DataForSEO pipeline — full control |
| Raw response access | No | Full JSONB stored, always re-processable |
| Platform coverage | 6 platforms (some unreliable) | ChatGPT, Claude, Gemini, Perplexity (confirmed) |
| Model selection | Fixed | Per-prompt model config, updateable |
| Reasoning chain access | No | Fan-out queries + reasoning via DataForSEO[^13][^12] |
| Cost at scale | $29/month per user (per-seat) | Pay-as-you-go API cost only |
| Custom scoring | None | Build any visibility formula required |
| Agency workflow integration | Not designed for it | Built for your exact internal process |
| GA4 / analytics correlation | Claimed | Native integration with your analytics stack |

---

## References

1. [Rank Prompt vs Semrush: Which Tool Helps You Win in AI Search?](https://rankprompt.com/rankprompt-vs-semrush-which-tool-helps-you-win-in-ai-search/) - Rank Prompt is a platform built for Answer Engine Optimization (AEO). It scans your brand across AI ...

2. [Official Information About Rank Prompt | LLM Info](https://rankprompt.com/llm-info/) - Structured information about Rank Prompt for AI assistants: AI visibility, AEO, prompt-level analyti...

3. [Why I Built an Open Source AEO Tool - Sarah's Newsletter](https://sarahsnewsletter.substack.com/p/why-i-built-an-open-source-aeo-tool) - An open-source tool to track how your brand shows up in LLMs ・ analyzes your website ・ generates div...

4. [Rank Prompt Launches as Pioneering Platform to Optimize Brand ...](https://www.prnewswire.com/news-releases/rank-prompt-launches-as-pioneering-platform-to-optimize-brand-visibility-in-ai-search-engines-302481610.html) - Rank Prompt is a revolutionary, new platform created to help businesses and entrepreneurs understand...

5. [RankPrompt Review: $30 for Broken Features and Bad Data failed ...](https://www.reddit.com/r/seotodolist/comments/1npod0b/rankprompt_review_30_for_broken_features_and_bad/) - RankPrompt Review: $30 for Broken Features and Bad Data failed attemp to promise on a great SEO AI t...

6. [AI Optimization API: Overview - DataForSEO Docs](https://docs.dataforseo.com/v3/ai_optimization-overview/) - LLM Responses API enables real-time generation of structured responses from leading LLMs, including ...

7. [DataForSEO AI Optimization API integrations - N8N](https://n8n.io/integrations/dataforseo-ai-optimization-api/) - Retrieves structured responses from a specific ChatGPT AI model, based on the input parameters ... P...

8. [LLM Mentions API - DataForSEO](https://dataforseo.com/apis/ai-optimization-api/llm-mentions-api) - Use the Search Mentions endpoint to specify a keyword or domain and explore how and in which context...

9. [Introducing DataForSEO LLM Mentions API: Track AI ...](https://www.linkedin.com/posts/kateshvchnk_aisearch-llm-seodata-activity-7394036868901752833-jSPF) - We built the DataForSEO LLM Mentions API — to finally show what AI actually says about you. It retur...

10. [Brand Entity Extraction in ChatGPT LLM Scraper API - DataForSEO](https://dataforseo.com/update/brand-entity-extraction-in-chatgpt-llm-scraper-api) - LLM Scraper API from our AI Optimization API suite now automatically surfaces brand entities detecte...

11. [Updates – DataForSEO](https://dataforseo.com/updates) - As of today, May 5, 2026, support for DataForSEO API v2 has officially ended. ... Reasoning Support ...

12. [Reasoning Support in LLM Responses: ChatGPT, Claude, and Gemini](https://dataforseo.com/update/reasoning-support-in-llm-responses-chatgpt-claude-and-gemini) - We’re excited to announce that the LLM Responses API now supports reasoning for specific models. Now...

13. [Fan-Out Queries and Brand Entities in LLM Mentions ... - DataForSEO](https://dataforseo.com/update/fan-out-queries-and-brand-entities) - Identify brand mentions instantly without manual extraction or custom post-processing. Get started. ...

14. [Hands on: AI Visibility Checker Agent - Ship AI 2025 - Vercel](https://vercel.com/ship/ai/session/hands-on-ai-visibility-checker-agent) - A hands-on session refactoring the sample AI Visibility Checker into new AI SDK features using Next....

15. [The End of Wireframing: How shadcn/ui Enables 10x Faster ...](https://www.acceli.com/blog/shadcn-ui-accelerated-development) - Modern component libraries like shadcn/ui are fundamentally changing how enterprise dashboards, intr...

16. [Chart - Shadcn UI](https://ui.shadcn.com/docs/components/chart) - Introducing Charts. A collection of chart components that you can copy and paste into your apps. Cha...

17. [GitHub - marleyDip/NextJS-Admin-Dashboard-ShadCN-Tailwind-CSS](https://github.com/marleyDip/NextJS-Admin-Dashboard-ShadCN-Tailwind-CSS) - This project demonstrates how to design a scalable, modern dashboard with reusable UI components. It...

18. [Supabase | The Postgres Development Platform.](https://supabase.com) - Supabase is the Postgres development platform. Start your project with a Postgres database, Authenti...

19. [Supabase Cron | Schedule Recurring Jobs in Postgres](https://supabase.com/modules/cron) - Supabase Cron is a Postgres Module that uses the pg_cron database extension to manage recurring task...

20. [Supabase Cron](https://supabase.com/blog/supabase-cron) - Supabase Cron stores the scheduling logic within Postgres and runs your Jobs accordingly while integ...

21. [Background Tasks for Google Cloud Run hosted Backend - Reddit](https://www.reddit.com/r/googlecloud/comments/1am4xtb/background_tasks_for_google_cloud_run_hosted/) - I use Google Cloud Run to host my backend. I want to start running background tasks. Should I use an...

22. [Cloud run for background tasks - Google Developer forums](https://discuss.google.dev/t/cloud-run-for-background-tasks/149595) - Alternatively, you can use Pub/Sub to trigger a Cloud Function or another Cloud Run service dedicate...

23. [How To Send Data From Your Next JS Site to Google BigQuery](https://www.rudderstack.com/guides/send-data-from-your-next-js-site-to-google-bigquery/) - RudderStack's Javascript SDK makes it easy to send data from your Next.js site to Google BigQuery an...

24. [Deploy Next.js Supabase App to Cloud Run using Artifact Registry ...](https://dev.to/jamescroissant/deploy-nextjs-supabase-app-to-cloud-run-using-artifact-registry-and-secrets-manager-cm9) - This article summarizes the process of setting up a Google Cloud Project, storing secrets in Google ...

25. [Best way to deal with long background jobs when deploying Next.js to Vercel?](https://www.reddit.com/r/nextjs/comments/uhhmga/best_way_to_deal_with_long_background_jobs_when/) - Best way to deal with long background jobs when deploying Next.js to Vercel?

26. [Background Processing : r/nextjs - Reddit](https://www.reddit.com/r/nextjs/comments/1cf0q8c/background_processing/) - If you don't want to host a separate server, then you can use a scheduler as a service type service ...

