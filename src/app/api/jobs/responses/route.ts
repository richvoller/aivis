import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { runResponsesForBrand } from "@/lib/engine";

/**
 * Nightly LLM Responses batch job (local stand-in for the Cloud Run worker).
 *
 * Trigger:
 *   curl -X POST http://localhost:3000/api/jobs/responses \
 *     -H "authorization: Bearer $JOB_SECRET" -H "content-type: application/json" \
 *     -d '{"brandId":"<optional>"}'
 *
 * When deployed, point Supabase Cron (pg_cron HTTP webhook) or Cloud Scheduler
 * at this endpoint. The core logic in runResponsesForBrand is portable to a
 * Cloud Run worker unchanged.
 */
function authorised(req: NextRequest): boolean {
  const secret = process.env.JOB_SECRET;
  if (!secret) return true; // no secret configured -> allow (local dev)
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let brandId: string | undefined;
  try {
    const body = await req.json();
    brandId = body?.brandId;
  } catch {
    // empty body is fine — run all brands
  }

  const supabase = getAdminClient();
  const brandIds: string[] = [];
  if (brandId) {
    brandIds.push(brandId);
  } else {
    const { data } = await supabase.from("brands").select("id");
    brandIds.push(...(data ?? []).map((b) => b.id));
  }

  const results: Record<string, number> = {};
  for (const id of brandIds) {
    results[id] = await runResponsesForBrand(id);
  }

  const total = Object.values(results).reduce((s, n) => s + n, 0);
  return NextResponse.json({ ok: true, brands: brandIds.length, snapshots: total, results });
}
