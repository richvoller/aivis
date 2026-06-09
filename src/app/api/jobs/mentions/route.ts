import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { runMentionsForBrand } from "@/lib/engine";

/**
 * Weekly LLM Mentions benchmarking job (local stand-in for the Cloud Run
 * mentions worker). Computes share of voice + citation domains.
 *
 * Trigger:
 *   curl -X POST http://localhost:3000/api/jobs/mentions \
 *     -H "authorization: Bearer $JOB_SECRET"
 */
function authorised(req: NextRequest): boolean {
  const secret = process.env.JOB_SECRET;
  if (!secret) return true;
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
    // empty body -> run all brands
  }

  const supabase = getAdminClient();
  const brandIds: string[] = [];
  if (brandId) {
    brandIds.push(brandId);
  } else {
    const { data } = await supabase.from("brands").select("id");
    brandIds.push(...(data ?? []).map((b) => b.id));
  }

  for (const id of brandIds) {
    await runMentionsForBrand(id);
  }

  return NextResponse.json({ ok: true, brands: brandIds.length });
}
