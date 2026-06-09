import { NextResponse, type NextRequest } from "next/server";
import { repairBrandSnapshots } from "@/lib/engine";

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
    return NextResponse.json({ ok: false, error: "brandId required" }, { status: 400 });
  }

  if (!brandId) {
    return NextResponse.json({ ok: false, error: "brandId required" }, { status: 400 });
  }

  try {
    const result = await repairBrandSnapshots(brandId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Repair failed" },
      { status: 500 },
    );
  }
}
