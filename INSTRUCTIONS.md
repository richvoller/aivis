# Aivis - Usage Instructions

This guide explains how to set up and use the Aivis AI visibility tracking application.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Running the Application](#running-the-application)
3. [Brand Management](#brand-management)
4. [Prompt Management](#prompt-management)
5. [Brand Profile & AI Research](#brand-profile--ai-research)
6. [Understanding the Data Flow](#understanding-the-data-flow)
7. [Scheduled Jobs](#scheduled-jobs)

---

## Environment Setup

### Prerequisites

- Node.js 18+
- Docker (for local Supabase)
- Supabase CLI (`npm install -g supabase`)

### 1. Local Supabase Setup

Start the local Supabase instance:

```bash
npx supabase start
```

This will:
- Start PostgreSQL, Studio, and API containers
- Display your local API URL and anon/service role keys
- Seed the database with initial data

### 2. Environment Variables

Create a `.env.local` file in the project root with the following:

```env
# Supabase (from `npx supabase start` output)
NEXT_PUBLIC_SUPABASE_URL=your_local_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_supabase_service_role_key

# DataForSEO API credentials
DATAFORSEO_LOGIN=your_login
DATAFORSEO_PASSWORD=your_password
DATAFORSEO_MOCK_MODE=false

# AI Provider Keys (for brand profile research)
PERPLEXITY_API_KEY=your_perplexity_api_key
OPENAI_API_KEY=your_openai_api_key

# Job secret for API route protection
JOB_SECRET=your_random_secret_string
```

**Note:** The AI keys are only required for the "Re-analyze Brand" feature. The core visibility tracking works with DataForSEO only.

### 3. Install Dependencies

```bash
npm install
```

---

## Running the Application

### Development Mode

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Production Build

```bash
npm run build
npm start
```

### Accessing Supabase Studio

After starting Supabase, access Studio at the URL shown in the terminal (typically http://localhost:54323).

---

## Brand Management

### Adding a Brand

1. Navigate to the **Brands** page
2. Click **Add brand**
3. Fill in:
   - **Brand name** (e.g., "Acme CRM")
   - **Domain** (e.g., "acmecrm.com")
   - **Description** (optional notes)
4. Click **Create brand**

### Editing a Brand

1. Go to the **Brands** page
2. Click the **pencil icon** on the brand card
3. Modify the fields and save

### Deleting a Brand

1. Go to the **Brands** page
2. Click the **trash icon** on the brand card
3. Confirm deletion (this removes all associated data)

### Switching Between Brands

Use the brand switcher in the top-right corner to select which brand's data to view across the application.

---

## Brand Profile & AI Research

The brand profile feature uses AI to automatically research and populate detailed information about your brand.

### Accessing Brand Settings

1. Go to the **Brands** page
2. Click the **settings icon** on a brand card
3. This opens the Brand Settings page for that brand

### Manual Profile Editing

The Brand Settings page has sections for:
- **Brand Information** - Tagline, value proposition, mission statement
- **Company Details** - Industry, headquarters, founded year, company size
- **Products & Services** - Key offerings
- **Key Facts & People** - Important facts and team members
- **Detection & Prompt Generation** - Brand aliases and categories
- **Content Generation Preferences** - Language, tone, writing style, banned phrases
- **Default Location & Language** - Country and language defaults

Edit any field and click **Save changes**.

### AI-Powered Re-analysis

To automatically populate the profile using AI:

1. Ensure `PERPLEXITY_API_KEY` and `OPENAI_API_KEY` are set in `.env.local`
2. Click **Re-analyze (AI)** on the Brand Settings page
3. The system will:
   - Fetch text from the brand's website
   - Research the brand using Perplexity Sonar
   - Extract structured profile data using OpenAI
   - Populate all profile fields automatically
   - Record research sources with citations

**Profile Status:**
- `none` - No analysis has been run
- `analyzing` - Analysis in progress
- `ready` - Profile successfully populated
- `error` - Analysis failed (error message shown)

### Brand Aliases

Brand aliases improve mention detection. Add alternative names, legal entity names, or product names that should be counted as mentions of your brand.

Examples:
- "Acme CRM" → aliases: "Acme", "Acme Inc.", "Acme Software"
- "Salesforce" → aliases: "SFDC", "Salesforce.com"

These aliases are used by the parser when analyzing LLM responses.

### Generating Prompts from Categories

If you've defined categories for your brand, you can auto-generate prompts:

1. Add categories in the **Detection & Prompt Generation** section
2. Click **Generate Prompts**
3. The system creates prompts like "What are the best CRM options for Acme CRM?"
4. Visit the **Prompts** page to review and activate them

---

## Prompt Management

### Adding a Prompt

1. Navigate to the **Prompts** page
2. Click **Add prompt**
3. Fill in:
   - **Prompt text** - The question to ask AI platforms
   - **Category** - Optional grouping (e.g., "CRM", "Marketing")
   - **Platform configs** - Select which platforms and models to use
4. Click **Create prompt**

### Configuring Platform Models

For each prompt, you can configure:
- **ChatGPT** - Model name (default: `gpt-4o`)
- **Claude** - Model name (default: `claude-3-5-sonnet-20241022`)
- **Gemini** - Model name (default: `gemini-pro`)
- **Perplexity** - Model name (default: `sonar-medium-online`)

Toggle the **Active** switch to include/exclude a platform from tracking.

### Running a Prompt Manually

Click **Run Now** on a prompt to execute it across all active platforms immediately.

### Viewing Results

Results are shown on the **Responses** page, filtered by platform, mention status, and sentiment.

---

## Competitor Management

### Adding a Competitor

1. Navigate to the **Competitors** page
2. Click **Add competitor**
3. Fill in:
   - **Domain** (e.g., "hubspot.com")
   - **Name** (optional, defaults to domain)
4. Click **Add competitor**

Competitors are tracked in the Share of Voice benchmarking to compare your brand's visibility against competitors.

---

## Understanding the Data Flow

### 1. Prompt Execution

When a prompt is run (manually or via scheduled job):

1. The engine loads the brand context (name, domain, competitors)
2. It calls DataForSEO API for each configured platform/model
3. DataForSEO sends the prompt to the AI platform and returns the response
4. The parser extracts:
   - Whether the brand was mentioned
   - Sentiment (positive/negative/neutral)
   - Brand position in the response
   - Competitors mentioned
   - Cited URLs
   - Fan-out queries (internal research queries)
5. A snapshot is persisted to the database

### 2. Brand Mention Detection

The parser uses multiple strategies:
- **DataForSEO brand entities** - Authoritative when present
- **String matching** - Matches brand name, domain root, and custom aliases

With brand aliases configured, detection becomes more accurate by recognizing alternative names and legal entities.

### 3. Sentiment Classification

Sentiment is determined using a lightweight keyword heuristic on the context surrounding the first brand mention:
- **Positive words**: best, top, leading, excellent, recommended, etc.
- **Negative words**: worst, poor, weak, limited, expensive, buggy, etc.

This is deterministic and fast (no additional API calls).

---

## Scheduled Jobs

The application has two scheduled jobs for automated data collection:

### 1. Nightly LLM Responses Job

**Route:** `POST /api/jobs/responses`

**Purpose:** Run all active prompts for a brand across all platforms daily.

**Usage:**

```bash
curl -X POST http://localhost:3000/api/jobs/responses \
  -H "Content-Type: application/json" \
  -d '{"secret": "your_job_secret", "brand_id": "optional_brand_id"}'
```

- Omit `brand_id` to run for all brands
- Include `brand_id` to run for a specific brand only

**Scheduling:** Set up a cron job to run this nightly.

### 2. Weekly Mentions Job

**Route:** `POST /api/jobs/mentions`

**Purpose:** Pull share-of-voice data and top cited domains for benchmarking.

**Usage:**

```bash
curl -X POST http://localhost:3000/api/jobs/mentions \
  -H "Content-Type: application/json" \
  -d '{"secret": "your_job_secret", "brand_id": "optional_brand_id"}'
```

**Scheduling:** Set up a cron job to run this weekly.

---

## Pages Overview

- **Overview** - KPI dashboard with visibility score, trend chart, platform breakdown
- **Brands** - Manage brands and access detailed brand settings
- **Competitors** - Add/remove competitors for share-of-voice tracking
- **Prompts** - Create and configure prompts to track across AI platforms
- **Responses** - Explore LLM responses with filters and detailed analysis
- **Benchmarking** - Share of voice comparison over time
- **Citations** - Analysis of cited domains (own vs third-party)
- **Fan-Out Queries** - Internal research queries generated by LLMs
- **Categories** - Visibility performance by prompt category
- **Action Items** - Recommendations for improving visibility

---

## Troubleshooting

### Supabase Issues

If the local Supabase instance isn't responding:

```bash
npx supabase stop
npx supabase start
```

### Migration Issues

To reset the database and re-seed:

```bash
npx supabase db reset
```

### Build Errors

If you encounter build errors after updates:

```bash
rm -rf .next node_modules
npm install
npm run build
```

### AI Research Not Working

The "Re-analyze (AI)" button is disabled if:
- `PERPLEXITY_API_KEY` is missing
- `OPENAI_API_KEY` is missing

Check your `.env.local` file and ensure both keys are set.

### Mock Mode

For development without DataForSEO credentials, set:

```env
DATAFORSEO_MOCK_MODE=true
```

This generates mock responses for testing the UI and parser.

---

## Data Privacy

- All data is stored in your local Supabase instance
- No data is sent to external services except:
  - DataForSEO API (for LLM responses)
  - Perplexity API (for brand research, when using re-analyze)
  - OpenAI API (for brand research, when using re-analyze)
- You control your data and can delete brands and all associated data at any time
