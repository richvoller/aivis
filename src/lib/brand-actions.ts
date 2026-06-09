"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { BRAND_COOKIE } from "./current-brand";

/** Persist the selected brand to a cookie and refresh server-rendered data. */
export async function selectBrand(brandId: string): Promise<void> {
  const store = await cookies();
  store.set(BRAND_COOKIE, brandId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
