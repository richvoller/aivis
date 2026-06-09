import "server-only";
import { cookies } from "next/headers";
import { getBrand, getDefaultBrand, listBrands } from "./queries";
import type { Brand } from "./types";

export const BRAND_COOKIE = "aivis_brand_id";

/** Resolve the currently-selected brand from the cookie, or the first brand. */
export async function getCurrentBrand(): Promise<Brand | null> {
  const store = await cookies();
  const id = store.get(BRAND_COOKIE)?.value;
  if (id) {
    const brand = await getBrand(id);
    if (brand) return brand;
  }
  return getDefaultBrand();
}

export async function getBrandsAndCurrent(): Promise<{ brands: Brand[]; current: Brand | null }> {
  const [brands, current] = await Promise.all([listBrands(), getCurrentBrand()]);
  // If cookie pointed at a deleted brand, fall back to the first available.
  const resolved = current ?? brands[0] ?? null;
  return { brands, current: resolved };
}
